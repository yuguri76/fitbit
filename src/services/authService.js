const crypto = require('crypto');
const axios = require('axios');
const { FITBIT_CONFIG } = require('../config');
const tokenStore = require('./tokenStore');

class AuthService {
    constructor() {
        this.tokenStore = tokenStore;
        console.log('Fitbit 설정 확인:', {
            clientId: FITBIT_CONFIG.clientId,
            redirectUri: FITBIT_CONFIG.redirectUri,
            scope: FITBIT_CONFIG.scope
        });

        this.config = FITBIT_CONFIG;
        console.log('AuthService 초기화됨');
        console.log('Fitbit 설정:', this.config);
    }

    generatePKCE() {
        console.log('PKCE 생성 시작');
        const verifier = crypto.randomBytes(32).toString('base64url');
        const challenge = crypto
            .createHash('sha256')
            .update(verifier)
            .digest('base64url');
        console.log('PKCE 생성 완료:', { verifier, challenge });
        return { verifier, challenge };
    }

    getAuthorizationUrl(userId) {
        const { verifier, challenge } = this.generatePKCE();

        // PKCE verifier 저장
        tokenStore.setPKCE(userId, verifier);

        // redirectUri에 /callback이 없는 경우 추가
        const redirectUri = this.config.redirectUri.endsWith('/callback')
            ? this.config.redirectUri
            : `${this.config.redirectUri}/callback`;

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            scope: this.config.scope,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            redirect_uri: redirectUri,
            state: userId
        });

        console.log('생성된 인증 URL 파라미터:', {
            userId,
            verifier: verifier.substring(0, 10) + '...',
            challenge: challenge.substring(0, 10) + '...',
            redirectUri: redirectUri
        });

        return `${this.config.authUrl}?${params.toString()}`;
    }

    async handleCallback(code, state) {
        try {
            console.log('handleCallback 시작:', { code, state });

            const verifier = tokenStore.getPKCE(state);
            console.log('PKCE verifier:', verifier);

            if (!verifier) {
                throw new Error('PKCE verifier not found');
            }

            // redirectUri에 /callback이 없는 경우 추가
            const redirectUri = this.config.redirectUri.endsWith('/callback')
                ? this.config.redirectUri
                : `${this.config.redirectUri}/callback`;

            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: this.config.clientId,
                code_verifier: verifier
            });

            console.log('토큰 요청 파라미터:', params.toString());

            const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

            const response = await axios.post(this.config.tokenUrl, params.toString(), {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            console.log('토큰 응답:', response.data);

            // 토큰 저장
            tokenStore.setToken(state, {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in,
                scope: response.data.scope
            });

            // PKCE verifier 삭제
            tokenStore.removePKCE(state);

            return response.data;
        } catch (error) {
            console.error('토큰 요청 중 상세 오류:', error.response?.data || error.message);
            throw error;
        }
    }

    async getValidTokens(userId) {
        const tokens = tokenStore.getToken(userId);
        if (!tokens) {
            throw new Error('토큰을 찾을 수 없습니다.');
        }

        const tokenAge = (new Date() - new Date(tokens.lastUpdated)) / 1000;
        if (tokenAge >= tokens.expiresIn - 60) {
            return this.refreshToken(userId);
        }

        return tokens;
    }

    async refreshToken(userId) {
        try {
            const tokens = tokenStore.getToken(userId);
            if (!tokens?.refreshToken) {
                throw new Error('Refresh token not found');
            }

            const params = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken
            });

            const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

            const response = await axios.post(this.config.tokenUrl, params.toString(), {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            // 새로운 토큰 저장
            tokenStore.setToken(userId, {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in,
                scope: response.data.scope
            });

            return response.data;
        } catch (error) {
            console.error('토큰 갱신 중 상세 오류:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new AuthService(); 