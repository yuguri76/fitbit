const fs = require('fs');
const path = require('path');

class TokenStore {
    constructor() {
        this.tokenFile = path.join(__dirname, '../../tokens/tokens.json');
        this.pkceFile = path.join(__dirname, '../../tokens/pkce.json');
        this.ensureDirectoryExists();
        this.loadData();
    }

    ensureDirectoryExists() {
        const tokenDir = path.dirname(this.tokenFile);
        if (!fs.existsSync(tokenDir)) {
            fs.mkdirSync(tokenDir, { recursive: true });
        }
    }

    loadData() {
        try {
            this.tokens = fs.existsSync(this.tokenFile)
                ? JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'))
                : {};

            this.pkceData = fs.existsSync(this.pkceFile)
                ? JSON.parse(fs.readFileSync(this.pkceFile, 'utf8'))
                : {};

            console.log('토큰 데이터 로드됨:', Object.keys(this.tokens));
        } catch (error) {
            console.error('토큰 데이터 로드 중 오류:', error);
            this.tokens = {};
            this.pkceData = {};
        }
    }

    saveData() {
        try {
            fs.writeFileSync(this.tokenFile, JSON.stringify(this.tokens, null, 2));
            fs.writeFileSync(this.pkceFile, JSON.stringify(this.pkceData, null, 2));
            console.log('토큰 데이터 저장됨:', Object.keys(this.tokens));
        } catch (error) {
            console.error('토큰 데이터 저장 중 오류:', error);
        }
    }

    // 토큰 관련 메서드
    setToken(userId, tokenData) {
        this.loadData(); // 최신 데이터 로드
        this.tokens[userId] = {
            ...tokenData,
            lastUpdated: new Date().toISOString()
        };
        this.saveData();
        console.log(`토큰 저장됨 - 사용자 ID: ${userId}`);
    }

    getToken(userId) {
        this.loadData(); // 최신 데이터 로드
        const token = this.tokens[userId];
        if (!token) {
            console.log(`토큰 없음 - 사용자 ID: ${userId}`);
            return null;
        }
        console.log(`토큰 조회됨 - 사용자 ID: ${userId}`);
        return token;
    }

    removeToken(userId) {
        this.loadData(); // 최신 데이터 로드
        delete this.tokens[userId];
        this.saveData();
        console.log(`토큰 삭제됨 - 사용자 ID: ${userId}`);
    }

    // PKCE 관련 메서드
    setPKCE(userId, verifier) {
        this.loadData(); // 최신 데이터 로드
        this.pkceData[userId] = {
            verifier,
            timestamp: new Date().toISOString()
        };
        this.saveData();
    }

    getPKCE(userId) {
        this.loadData(); // 최신 데이터 로드
        const data = this.pkceData[userId];
        if (!data) return null;

        // 10분이 지난 PKCE 데이터는 삭제
        const age = Date.now() - new Date(data.timestamp).getTime();
        if (age > 10 * 60 * 1000) {
            this.removePKCE(userId);
            return null;
        }

        return data.verifier;
    }

    removePKCE(userId) {
        this.loadData(); // 최신 데이터 로드
        delete this.pkceData[userId];
        this.saveData();
    }
}

module.exports = new TokenStore(); 