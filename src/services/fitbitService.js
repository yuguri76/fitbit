const axios = require('axios');
const crypto = require('crypto');
const { FITBIT_CONFIG } = require('../config');
const tokenStore = require('./tokenStore');
const authService = require('./authService');
const fitbitDataService = require('./fitbitDataService');

// 딜레이 함수 추가
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// API 요청 래퍼 함수
async function makeApiRequest(requestFn, retries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            // 첫 시도가 아니면 딜레이 추가
            if (i > 0) {
                const waitTime = initialDelay * Math.pow(2, i - 1); // 지수 백오프
                console.log(`재시도 전 ${waitTime}ms 대기 중...`);
                await delay(waitTime);
            }
            return await requestFn();
        } catch (error) {
            lastError = error;
            if (error.response?.status === 429) {
                console.log(`Rate limit 도달 (시도 ${i + 1}/${retries})`);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

class FitbitService {
    constructor() {
        this.tokenStore = {};
    }

    getAuthUrl(userId, state = null) {
        // FITBIT_CONFIG의 스코프 사용
        const scopes = FITBIT_CONFIG.scope.split(' ');
        console.log('사용할 스코프:', scopes);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: FITBIT_CONFIG.clientId,
            redirect_uri: FITBIT_CONFIG.redirectUri,
            scope: FITBIT_CONFIG.scope,  // 원본 스코프 문자열 사용
            expires_in: '604800',  // 7일
            code_challenge: this.codeChallenge,
            code_challenge_method: 'S256',
            state: state || userId
        });

        console.log('생성된 OAuth URL의 스코프:', FITBIT_CONFIG.scope);
        return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
    }

    async getAccessToken(code, userId) {
        try {
            const result = await authService.handleCallback(code, userId);
            const tokens = {
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                userId: result.user_id,
                expiresIn: result.expires_in,
                lastUpdated: new Date().toISOString()
            };

            await tokenStore.setToken(userId, tokens);
            return tokens;
        } catch (error) {
            console.error('토큰 발급 중 상세 오류:', error.response?.data || error);
            throw error;
        }
    }

    async refreshAccessToken(userId) {
        try {
            const tokens = await tokenStore.getToken(userId);
            if (!tokens) {
                throw new Error('저장된 토큰이 없습니다.');
            }

            const auth = Buffer.from(`${FITBIT_CONFIG.clientId}:${FITBIT_CONFIG.clientSecret}`).toString('base64');
            const response = await axios.post(FITBIT_CONFIG.tokenUrl,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: tokens.refreshToken
                }), {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const newTokens = {
                ...tokens,
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in,
                lastUpdated: new Date().toISOString()
            };

            await tokenStore.setToken(userId, newTokens);
            return newTokens;
        } catch (error) {
            console.error('토큰 갱신 중 오류:', error.response?.data || error);
            // 토큰이 유효하지 않은 경우 토큰을 삭제하고 재인증이 필요함을 알림
            await tokenStore.removeToken(userId);
            throw new Error('토큰이 만료되었습니다. 재인증이 필요합니다.');
        }
    }

    async getUserProfile(userId) {
        const tokens = await this.getValidTokens(userId);
        return makeApiRequest(async () => {
            const response = await axios.get(`${FITBIT_CONFIG.apiUrl}/profile.json`, {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`
                }
            });
            return response.data;
        });
    }

    async getDailyActivity(userId, date) {
        const tokens = await this.getValidTokens(userId);
        try {
            const response = await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/date/${date}.json`, {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('활동 데이터 조회 중 오류:', error);
            throw error;
        }
    }

    async getHeartRate(userId, date) {
        const tokens = await this.getValidTokens(userId);
        try {
            const response = await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/heart/date/${date}/1d.json`, {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('심박수 데이터 조회 중 오류:', error);
            throw error;
        }
    }

    async getSleep(userId, date) {
        const tokens = await this.getValidTokens(userId);
        try {
            const response = await axios.get(`${FITBIT_CONFIG.apiUrl}/sleep/date/${date}.json`, {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('수면 데이터 조회 중 오류:', error);
            throw error;
        }
    }

    async getValidTokens(userId) {
        try {
            const tokens = await tokenStore.getToken(userId);
            if (!tokens) {
                throw new Error('토큰을 찾을 수 없습니다.');
            }

            // 토큰 만료 여부 확인
            const now = Math.floor(Date.now() / 1000);
            if (tokens.expires_at && tokens.expires_at <= now) {
                console.log('토큰이 만료되어 갱신을 시도합니다.');
                const newTokens = await this.refreshAccessToken(tokens.refreshToken);
                await tokenStore.saveToken(userId, newTokens);
                return newTokens;
            }

            return tokens;
        } catch (error) {
            console.error('토큰 검증 실패:', error);
            throw error;
        }
    }

    async getActivityData(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);

            const [activities, goals, lifetime] = await Promise.all([
                makeApiRequest(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/date/${date}.json`, {
                        headers: {
                            'Authorization': `Bearer ${tokens.accessToken}`
                        }
                    });
                }),
                makeApiRequest(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/goals/daily.json`, {
                        headers: {
                            'Authorization': `Bearer ${tokens.accessToken}`
                        }
                    });
                }),
                makeApiRequest(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities.json`, {
                        headers: {
                            'Authorization': `Bearer ${tokens.accessToken}`
                        }
                    });
                })
            ]);

            const summary = activities.data.summary;
            const dailyGoals = goals.data.goals;
            const lifetimeStats = lifetime.data.lifetime;

            return {
                // 일일 활동 요약
                summary: {
                    steps: summary.steps,
                    floors: summary.floors,
                    elevation: summary.elevation,
                    calories: {
                        burned: summary.caloriesOut,
                        bmr: summary.caloriesBMR,
                        activity: summary.activityCalories
                    },
                    active_minutes: {
                        sedentary: summary.sedentaryMinutes,
                        lightly: summary.lightlyActiveMinutes,
                        fairly: summary.fairlyActiveMinutes,
                        very: summary.veryActiveMinutes
                    },
                    distance: {
                        total: summary.distances.find(d => d.activity === 'total')?.distance || 0,
                        tracker: summary.distances.find(d => d.activity === 'tracker')?.distance || 0
                    }
                },
                // 일일 목표
                goals: {
                    steps: dailyGoals.steps,
                    calories_out: dailyGoals.caloriesOut,
                    distance: dailyGoals.distance,
                    floors: dailyGoals.floors,
                    active_minutes: dailyGoals.activeMinutes
                },
                // 평생 통계
                lifetime: {
                    total_steps: lifetimeStats.total.steps,
                    total_floors: lifetimeStats.total.floors,
                    total_distance: lifetimeStats.total.distance
                },
                // 상세 활동
                activities: activities.data.activities || []
            };
        } catch (error) {
            console.error('활동 데이터 조회 실패:', error);
            throw error;
        }
    }

    async getHealthMetrics(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);

            // HRV 데이터 조회
            const hrvResponse = await axios.get(
                `${FITBIT_CONFIG.apiUrl}/hrv/date/${date}.json`,
                { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
            );

            // 호흡률 데이터 조회
            const breathingRateResponse = await axios.get(
                `${FITBIT_CONFIG.apiUrl}/br/date/${date}.json`,
                { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
            );

            // 피부 온도 데이터 조회
            const tempResponse = await axios.get(
                `${FITBIT_CONFIG.apiUrl}/temp/skin/date/${date}.json`,
                { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
            );

            // 심박수 데이터 조회
            const heartRateResponse = await axios.get(
                `${FITBIT_CONFIG.apiUrl}/activities/heart/date/${date}/1d.json`,
                { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
            );

            // 수면 데이터 조회
            const sleepResponse = await axios.get(
                `${FITBIT_CONFIG.apiUrl}/sleep/date/${date}.json`,
                { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
            );

            // 데이터 추출
            const dailyHrv = hrvResponse.data?.hrv?.[0]?.value?.dailyRmssd || 0;
            const restingHeartRate = heartRateResponse.data?.['activities-heart']?.[0]?.value?.restingHeartRate || 0;
            const deepSleepMinutes = sleepResponse.data?.sleep?.[0]?.levels?.summary?.deep?.minutes || 0;

            // 스트레스 점수 계산
            const stressScore = this.calculateStressScore(dailyHrv, restingHeartRate, deepSleepMinutes);

            const result = {
                date,
                daily_hrv: dailyHrv,
                sleep_hrv: hrvResponse.data?.hrv?.[0]?.value?.nightlyRmssd || 0,
                breathing_rate: breathingRateResponse.data?.br?.[0]?.value?.breathingRate || 0,
                skin_temperature: tempResponse.data?.tempSkin?.[0]?.value?.nightlyRelative || 0,
                stress_score: stressScore
            };

            // RDS에 저장
            await fitbitDataService.saveHealthMetrics(userId, result);

            return result;
        } catch (error) {
            console.error('건강 지표 조회 중 오류:', error);
            throw error;
        }
    }

    async getSleepData(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);
            const response = await axios.get(
                `${FITBIT_CONFIG.apiUrl}/sleep/date/${date}.json`,
                { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
            );

            let mainSleep = response.data.sleep.find(s => s.isMainSleep) || response.data.sleep[0];
            if (!mainSleep) {
                return null;
            }

            const result = {
                date,
                startTime: mainSleep.startTime,
                endTime: mainSleep.endTime,
                total_sleep_minutes: mainSleep.minutesAsleep,
                stages: mainSleep.levels?.summary || {},
                minutesAwake: mainSleep.minutesAwake,
                awakeningsCount: mainSleep.awakeningsCount,
                awakeCount: mainSleep.levels?.summary?.wake?.count || 0,
                awakeDuration: mainSleep.levels?.summary?.wake?.minutes || 0,
                restlessCount: mainSleep.restlessCount,
                restlessDuration: mainSleep.restlessDuration,
                logId: mainSleep.logId,
                timeInBed: mainSleep.timeInBed,
                minutesAsleep: mainSleep.minutesAsleep,
                efficiency: mainSleep.efficiency,
                duration: mainSleep.duration,
                quality: 0,
                isMainSleep: mainSleep.isMainSleep
            };

            // RDS에 저장
            await fitbitDataService.saveSleepData(userId, result);

            return result;
        } catch (error) {
            console.error('수면 데이터 조회 중 오류:', error);
            throw error;
        }
    }

    async getDeviceInfo(userId) {
        try {
            const tokens = await this.getValidTokens(userId);
            const response = await axios.get(`${FITBIT_CONFIG.apiUrl}/devices.json`, {
                headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
            });

            const devices = response.data.map(device => ({
                id: device.id,
                device_version: device.deviceVersion,
                battery_level: device.batteryLevel,
                last_sync_time: device.lastSyncTime,
                created_at: new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', ''),
                updated_at: new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', '')
            }));

            console.log('기기 데이터 응답:', devices);

            // RDS에 저장
            await fitbitDataService.saveDeviceData(userId, devices);

            return devices;
        } catch (error) {
            console.error('기기 정보 조회 중 오류:', error);
            throw error;
        }
    }

    async getHeartRateData(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);
            console.log('심박수 데이터 요청:', date);

            const response = await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/heart/date/${date}/1d.json`, {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`
                }
            });

            console.log('심박수 응답:', response.data);

            // 심박수 데이터 구조화
            const heartData = response.data['activities-heart'][0] || {};
            return {
                date: heartData.dateTime,
                resting_heart_rate: heartData.value?.restingHeartRate,
                heart_rate_zones: heartData.value?.heartRateZones || []
            };
        } catch (error) {
            console.error('심박수 데이터 조회 중 오류:', error.response?.data || error.message);
            throw new Error('심박수 데이터 조회 실패: ' + (error.response?.data?.errors?.[0]?.message || error.message));
        }
    }

    // 스트레스 점수 계산 함수 추가
    calculateStressScore(hrv, rhr, deepSleepMinutes) {
        // 기준값 설정
        const BASE_HRV = 40.0;        // 평균 HRV (RMSSD)
        const BASE_RHR = 65.0;        // 평균 안정시 심박수
        const BASE_DEEP_SLEEP = 90;   // 분 단위 깊은 수면 시간

        // 각 요소별 점수 계산 (0~33점씩 배분)
        const hrvScore = Math.min(Math.max((hrv / BASE_HRV) * 33, 0), 33);           // 높을수록 좋음
        const rhrScore = Math.min(Math.max((BASE_RHR / rhr) * 33, 0), 33);           // 낮을수록 좋음
        const sleepScore = Math.min(Math.max((deepSleepMinutes / BASE_DEEP_SLEEP) * 33, 0), 33);

        const totalScore = hrvScore + rhrScore + sleepScore;
        const stressScore = Math.round(100 - totalScore);  // 낮을수록 스트레스 적음

        return {
            stress_score: stressScore,
            components: {
                hrv_contribution: Math.round(hrvScore),
                rhr_contribution: Math.round(rhrScore),
                sleep_contribution: Math.round(sleepScore)
            }
        };
    }

    async getAllFitbitData(userId, date) {
        try {
            // 토큰 스코프 검증
            const isValid = await this.validateTokenScope(userId, 'heartrate');
            if (!isValid) {
                throw new Error('재인증이 필요합니다. 로그아웃 후 다시 로그인해주세요.');
            }

            const tokens = await this.getValidTokens(userId);
            const headers = {
                'Authorization': `Bearer ${tokens.accessToken}`
            };

            // API 요청을 개별적으로 처리하는 함수
            const safeApiCall = async (apiCall, defaultValue = null) => {
                try {
                    const result = await makeApiRequest(apiCall);
                    return result.data;
                } catch (error) {
                    if (error.response?.status === 404) {
                        console.log('데이터를 찾을 수 없음:', error.config.url);
                        return defaultValue;
                    }
                    if (error.response?.status === 403) {
                        console.error('접근 권한 없음 (403):', {
                            url: error.config.url,
                            scope: error.response.data?.errors?.[0]?.errorType,
                            message: error.response.data?.errors?.[0]?.message
                        });
                        return defaultValue;
                    }
                    throw error;
                }
            };

            // 각 API 호출에 대한 결과를 개별적으로 처리
            console.log('프로필 데이터 요청 시작...');
            const profileData = await safeApiCall(async () => {
                return await axios.get(`${FITBIT_CONFIG.apiUrl}/profile.json`, { headers });
            });
            console.log('프로필 데이터 요청 완료');

            console.log('HRV 데이터 요청 시작...');
            const hrvData = await safeApiCall(async () => {
                return await axios.get(`${FITBIT_CONFIG.apiUrl}/hrv/date/${date}.json`, { headers });
            }, { hrv: [] });
            console.log('HRV 데이터 요청 완료');

            // 모든 데이터 요청을 병렬로 실행
            const [
                devices,
                activities,
                heartRate,
                heartRateIntraday,
                sleep,
                bodyWeight,
                bodyFat,
                bodyTemp,
                foods,
                water,
                oxygenSaturation,
                breathingRate,
                exerciseGoals,
                weeklyGoals,
                lifetimeStats
            ] = await Promise.all([
                // 기기 정보
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/devices.json`, { headers });
                }),
                // 활동 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/date/${date}.json`, { headers });
                }),
                // 심박수 데이터 (일일)
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/heart/date/${date}/1d.json`, { headers });
                }),
                // 심박수 상세 데이터 (1분 단위)
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/heart/date/${date}/1d/1min/time/00:00/23:59.json`, { headers });
                }),
                // 수면 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/sleep/date/${date}.json`, { headers });
                }),
                // 체중 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/body/log/weight/date/${date}.json`, { headers });
                }, { weight: [] }),
                // 체지방 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/body/log/fat/date/${date}.json`, { headers });
                }, { fat: [] }),
                // 피부 온도 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/temp/skin/date/${date}.json`, { headers });
                }, { tempSkin: [] }),
                // 음식 섭취 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/foods/log/date/${date}.json`, { headers });
                }),
                // 물 섭취 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/foods/log/water/date/${date}.json`, { headers });
                }),
                // 산소 포화도 (SpO2) 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/spo2/date/${date}/${date}.json`, { headers });
                }, { spo2: [] }),
                // 호흡률 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/br/date/${date}.json`, { headers });
                }, { br: [] }),
                // 운동 목표
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/goals/daily.json`, { headers });
                }),
                // 주간 목표
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/goals/weekly.json`, { headers });
                }),
                // 평생 통계
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities.json`, { headers });
                })
            ]);

            // 수면 데이터에서 가장 최근 수면 기록 가져오기
            const latestSleep = sleep?.sleep?.[0] || null;

            // 고급 지표 데이터 추출
            const tempSkinData = bodyTemp?.tempSkin?.[0]?.value?.nightlyRelative;
            const spo2Data = oxygenSaturation?.spo2?.[0]?.value;
            const breathingRateData = breathingRate?.br?.[0]?.value?.breathingRate;
            const dailyHrvData = hrvData?.hrv?.[0]?.value;
            const restingHeartRate = heartRate?.['activities-heart']?.[0]?.value?.restingHeartRate;
            const deepSleepMinutes = latestSleep?.levels?.summary?.deep?.minutes || 0;

            // 스트레스 점수 계산
            const stressScore = this.calculateStressScore(
                dailyHrvData?.dailyRmssd || 0,
                restingHeartRate || 0,
                deepSleepMinutes
            );

            // 데이터 정리 및 반환
            return {
                profile: {
                    ...profileData?.user,
                    cardio_fitness: profileData?.user?.vo2Max || null  // 심폐 건강 점수 (VO2 Max)
                },
                devices: devices || [],
                activities: {
                    summary: activities?.summary || {},
                    goals: {
                        daily: exerciseGoals || {},
                        weekly: weeklyGoals || {}
                    },
                    lifetime: lifetimeStats?.lifetime || {}
                },
                heart: {
                    daily: heartRate?.['activities-heart'] || [],
                    intraday: heartRateIntraday?.['activities-heart-intraday']?.dataset || [],
                    hrv: dailyHrvData ? {
                        daily_rmssd: dailyHrvData.dailyRmssd,  // 전체 수면 기간 RMSSD
                        deep_rmssd: dailyHrvData.deepRmssd     // 깊은 수면 중 RMSSD
                    } : null,
                    resting_heart_rate: restingHeartRate
                },
                sleep: {
                    details: sleep?.sleep || [],
                    summary: sleep?.summary || {},
                    score: latestSleep ? {
                        efficiency: latestSleep.efficiency,
                        duration: latestSleep.duration,
                        quality: latestSleep.efficiency >= 90 ? '매우 좋음' :
                            latestSleep.efficiency >= 80 ? '좋음' :
                                latestSleep.efficiency >= 70 ? '보통' : '개선 필요'
                    } : null,
                    deep_sleep_minutes: deepSleepMinutes
                },
                body: {
                    weight: bodyWeight?.weight || [],
                    fat: bodyFat?.fat || [],
                    temperature: tempSkinData ? {
                        nightly_relative: tempSkinData
                    } : null
                },
                nutrition: {
                    foods: foods || {},
                    water: water || {}
                },
                health_metrics: {
                    spo2: spo2Data ? {
                        avg: spo2Data.avg,
                        min: spo2Data.min,
                        max: spo2Data.max
                    } : null,
                    breathing_rate: breathingRateData || null,
                    stress: stressScore
                }
            };
        } catch (error) {
            console.error('전체 Fitbit 데이터 조회 실패:', error);
            throw error;
        }
    }

    // HRV 데이터만 따로 조회하는 메소드 추가
    async getHrvData(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);
            console.log('HRV 데이터 요청:', date);

            const response = await makeApiRequest(async () => {
                return await axios.get(`${FITBIT_CONFIG.apiUrl}/hrv/date/${date}.json`, {
                    headers: {
                        'Authorization': `Bearer ${tokens.accessToken}`
                    }
                });
            });

            console.log('HRV 응답:', response.data);

            const hrvData = response.data.hrv?.[0]?.value;
            if (!hrvData) {
                return {
                    date: date,
                    message: '해당 날짜의 HRV 데이터가 없습니다.',
                    hrv_data: null
                };
            }

            return {
                date: date,
                hrv_data: {
                    daily_rmssd: hrvData.dailyRmssd,  // 전체 수면 기간 RMSSD
                    deep_rmssd: hrvData.deepRmssd     // 깊은 수면 중 RMSSD
                }
            };
        } catch (error) {
            console.error('HRV 데이터 조회 중 오류:', error.response?.data || error.message);
            throw new Error('HRV 데이터 조회 실패: ' + (error.response?.data?.errors?.[0]?.message || error.message));
        }
    }

    // 토큰 무효화 함수
    async revokeToken(token) {
        try {
            const basicAuth = Buffer.from(`${FITBIT_CONFIG.clientId}:${FITBIT_CONFIG.clientSecret}`).toString('base64');
            await axios.post('https://api.fitbit.com/oauth2/revoke',
                `token=${token}`,
                {
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            console.log('토큰 무효화 완료:', token.substring(0, 10) + '...');
            return true;
        } catch (error) {
            console.error('토큰 무효화 실패:', error.response?.data || error.message);
            return false;
        }
    }

    // 토큰 갱신 전 스코프 확인 및 필요시 재인증
    async validateTokenScope(userId, requiredScope = 'heartrate') {
        try {
            const tokens = await this.getValidTokens(userId);
            const tokenInfo = await this.introspectToken(tokens.accessToken);

            if (!tokenInfo.active) {
                console.log('토큰이 비활성 상태입니다. 재인증이 필요합니다.');
                return false;
            }

            // 스코프 문자열 파싱 (대소문자 구분 없이)
            const scopeString = tokenInfo.scope || '';
            const scopes = scopeString.match(/[A-Za-z_]+=READ/g) || [];
            const normalizedScopes = scopes.map(s => s.split('=')[0].toLowerCase());

            console.log('정규화된 스코프 목록:', normalizedScopes);
            console.log('필요한 스코프:', requiredScope.toLowerCase());

            const hasRequiredScope = normalizedScopes.includes(requiredScope.toLowerCase());
            if (!hasRequiredScope) {
                console.log(`필요한 스코프(${requiredScope})가 없습니다. 재인증이 필요합니다.`);
                // 기존 토큰 무효화
                await this.revokeToken(tokens.accessToken);
                await this.revokeToken(tokens.refreshToken);
                // 토큰 파일 삭제
                await tokenStore.removeToken(userId);
                return false;
            }

            console.log('스코프 검증 성공!');
            return true;
        } catch (error) {
            console.error('토큰 스코프 확인 실패:', error);
            return false;
        }
    }

    // 토큰 정보 확인 함수
    async introspectToken(accessToken) {
        try {
            const basicAuth = Buffer.from(`${FITBIT_CONFIG.clientId}:${FITBIT_CONFIG.clientSecret}`).toString('base64');
            const response = await axios.post('https://api.fitbit.com/1.1/oauth2/introspect',
                `token=${accessToken}`,
                {
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            // 응답 데이터 로깅 개선
            const tokenInfo = {
                active: response.data.active,
                scope: response.data.scope,
                expires_in: response.data.expires_in
            };
            console.log('토큰 정보 상세:', JSON.stringify(tokenInfo, null, 2));

            return response.data;
        } catch (error) {
            console.error('토큰 정보 확인 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    // intraday 데이터만 조회하는 메소드
    async getIntradayData(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);
            const lastSyncTime = new Date();
            const fifteenMinutesAgo = new Date(lastSyncTime - 15 * 60000);

            // 먼저 디바이스의 마지막 싱크 타임을 가져옵니다
            const deviceResponse = await axios.get(`${FITBIT_CONFIG.apiUrl}/devices.json`, {
                headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
            });

            // 가장 최근에 싱크된 디바이스의 시간을 찾습니다
            const lastSyncTimeDevice = new Date(deviceResponse.data
                .map(device => device.lastSyncTime)
                .sort((a, b) => new Date(b) - new Date(a))[0]);

            // 싱크 시간으로부터 15분 전 시간을 계산
            const fifteenMinutesBeforeSync = new Date(lastSyncTimeDevice.getTime() - 15 * 60000);

            console.log('마지막 싱크 시간:', lastSyncTimeDevice.toISOString());
            console.log('15분 전 시간:', fifteenMinutesBeforeSync.toISOString());

            // intraday 데이터 요청
            const [steps, distance, calories, heartRate] = await Promise.all([
                axios.get(`${FITBIT_CONFIG.apiUrl}/activities/steps/date/${date}/1d/1min.json`, {
                    headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
                }),
                axios.get(`${FITBIT_CONFIG.apiUrl}/activities/distance/date/${date}/1d/1min.json`, {
                    headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
                }),
                axios.get(`${FITBIT_CONFIG.apiUrl}/activities/calories/date/${date}/1d/1min.json`, {
                    headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
                }),
                axios.get(`${FITBIT_CONFIG.apiUrl}/activities/heart/date/${date}/1d/1min.json`, {
                    headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
                })
            ]);

            // 시간 문자열을 Date 객체로 변환하는 함수
            const parseTime = (timeStr) => {
                const [hours, minutes] = timeStr.split(':').map(Number);
                const dateObj = new Date(lastSyncTimeDevice); // 마지막 싱크 시간의 날짜를 기준으로 사용
                dateObj.setHours(hours, minutes, 0, 0);
                return dateObj;
            };

            // 15분 이내의 데이터만 필터링하고 평균을 계산하는 함수
            const processIntraday = (dataset) => {
                const filteredData = dataset.filter(d => {
                    const dataTime = parseTime(d.time);
                    return dataTime >= fifteenMinutesBeforeSync && dataTime <= lastSyncTimeDevice;
                });

                if (filteredData.length === 0) {
                    return [];
                }

                // 1분 단위 데이터를 모두 포함
                return filteredData.map(d => ({
                    time: d.time,
                    value: d.value
                }));
            };

            // 각 데이터셋 처리
            const processedSteps = processIntraday(steps.data['activities-steps-intraday'].dataset);
            const processedDistance = processIntraday(distance.data['activities-distance-intraday'].dataset);
            const processedCalories = processIntraday(calories.data['activities-calories-intraday'].dataset);
            const processedHeartRate = processIntraday(heartRate.data['activities-heart-intraday'].dataset);

            // 각 분당 데이터 로그 출력
            console.log('=== 분당 데이터 상세 로그 ===');
            console.log('시간대:', {
                start: new Date(fifteenMinutesBeforeSync.getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', ''),
                end: new Date(lastSyncTimeDevice.getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', '')
            });

            // 시간별로 데이터 정렬
            const timeMap = new Map();

            // 모든 데이터를 시간별로 정렬
            processedSteps.forEach(item => {
                if (!timeMap.has(item.time)) {
                    timeMap.set(item.time, {});
                }
                timeMap.get(item.time).steps = item.value;
            });

            processedDistance.forEach(item => {
                if (!timeMap.has(item.time)) {
                    timeMap.set(item.time, {});
                }
                timeMap.get(item.time).distance = item.value;
            });

            processedCalories.forEach(item => {
                if (!timeMap.has(item.time)) {
                    timeMap.set(item.time, {});
                }
                timeMap.get(item.time).calories = item.value;
            });

            processedHeartRate.forEach(item => {
                if (!timeMap.has(item.time)) {
                    timeMap.set(item.time, {});
                }
                timeMap.get(item.time).heartRate = item.value;
            });

            // 정렬된 시간대로 로그 출력
            const sortedTimes = Array.from(timeMap.keys()).sort();
            console.log('분당 데이터:');
            sortedTimes.forEach(time => {
                const data = timeMap.get(time);
                console.log(`시간: ${time}, 걸음: ${data.steps || 0}, 거리: ${data.distance || 0}, 칼로리: ${data.calories || 0}, 심박수: ${data.heartRate || 0}`);
            });

            // 원본 데이터도 로그 출력
            console.log('원본 데이터 (최근 15분):');

            // 각 데이터셋에서 최근 15분 데이터만 필터링
            const filterRecentData = (dataset) => {
                return dataset.filter(d => {
                    const dataTime = parseTime(d.time);
                    return dataTime >= fifteenMinutesBeforeSync && dataTime <= lastSyncTimeDevice;
                });
            };

            console.log('걸음 데이터:', filterRecentData(steps.data['activities-steps-intraday'].dataset));
            console.log('거리 데이터:', filterRecentData(distance.data['activities-distance-intraday'].dataset));
            console.log('칼로리 데이터:', filterRecentData(calories.data['activities-calories-intraday'].dataset));
            console.log('심박수 데이터:', filterRecentData(heartRate.data['activities-heart-intraday'].dataset));
            console.log('=== 분당 데이터 상세 로그 끝 ===');

            // 합계와 평균 계산
            const steps_sum = processedSteps.reduce((sum, item) => sum + item.value, 0);
            const distance_sum = processedDistance.reduce((sum, item) => sum + item.value, 0);
            const calories_sum = processedCalories.reduce((sum, item) => sum + item.value, 0);
            const heartrate_avg = processedHeartRate.length > 0
                ? Math.round(processedHeartRate.reduce((sum, item) => sum + item.value, 0) / processedHeartRate.length)
                : 0;

            console.log('15분 데이터 요약:', {
                steps_sum,
                distance_sum,
                calories_sum,
                heartrate_avg
            });

            // 데이터 집계 및 반환
            const summary = {
                date: date,
                steps_sum,
                distance_sum: distance_sum / 1000, // m를 km로 변환
                calories_sum,
                heartrate_avg
            };

            const result = {
                date,
                summary,
                last_sync_time: new Date(lastSyncTimeDevice.getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', ''), // UTC를 KST로 변환
                time_range: {
                    start: new Date(fifteenMinutesBeforeSync.getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', ''),
                    end: new Date(lastSyncTimeDevice.getTime() + (9 * 60 * 60 * 1000)).toISOString().replace('Z', '')
                }
            };

            // RDS에 저장
            await fitbitDataService.saveActivityData(userId, result);

            return result;
        } catch (error) {
            console.error('15분 단위 활동 데이터 조회 중 오류:', error);
            throw error;
        }
    }

    // 기존 getAllFitbitData에서 intraday 데이터를 제외한 전체 데이터 조회
    async getNonIntradayAllData(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);
            const headers = {
                'Authorization': `Bearer ${tokens.accessToken}`
            };

            // API 요청을 개별적으로 처리하는 함수
            const safeApiCall = async (apiCall, defaultValue = null) => {
                try {
                    const result = await makeApiRequest(apiCall);
                    return result.data;
                } catch (error) {
                    if (error.response?.status === 404) {
                        console.log('데이터를 찾을 수 없음:', error.config.url);
                        return defaultValue;
                    }
                    if (error.response?.status === 403) {
                        console.error('접근 권한 없음 (403):', {
                            url: error.config.url,
                            scope: error.response.data?.errors?.[0]?.errorType,
                            message: error.response.data?.errors?.[0]?.message
                        });
                        return defaultValue;
                    }
                    throw error;
                }
            };

            // 프로필 데이터 먼저 가져오기
            const profileData = await this.getUserProfile(userId);
            console.log('프로필 데이터 요청 완료');

            // HRV 데이터 별도로 요청 (일부 기기에서만 지원)
            const hrvData = await safeApiCall(async () => {
                return await axios.get(`${FITBIT_CONFIG.apiUrl}/hrv/date/${date}.json`, { headers });
            }, { hrv: [] });
            console.log('HRV 데이터 요청 완료');

            // 모든 데이터 요청을 병렬로 실행 (intraday 제외)
            const [
                devices,
                activities,
                heartRate,
                sleep,
                bodyWeight,
                bodyFat,
                bodyTemp,
                foods,
                water,
                oxygenSaturation,
                breathingRate,
                exerciseGoals,
                weeklyGoals,
                lifetimeStats
            ] = await Promise.all([
                // 기기 정보
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/devices.json`, { headers });
                }),
                // 활동 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/date/${date}.json`, { headers });
                }),
                // 심박수 데이터 (일일)
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/heart/date/${date}/1d.json`, { headers });
                }),
                // 수면 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/sleep/date/${date}.json`, { headers });
                }),
                // 체중 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/body/log/weight/date/${date}.json`, { headers });
                }, { weight: [] }),
                // 체지방 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/body/log/fat/date/${date}.json`, { headers });
                }, { fat: [] }),
                // 피부 온도 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/temp/skin/date/${date}.json`, { headers });
                }, { tempSkin: [] }),
                // 음식 섭취 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/foods/log/date/${date}.json`, { headers });
                }),
                // 물 섭취 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/foods/log/water/date/${date}.json`, { headers });
                }),
                // 산소 포화도 (SpO2) 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/spo2/date/${date}/${date}.json`, { headers });
                }, { spo2: [] }),
                // 호흡률 데이터
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/br/date/${date}.json`, { headers });
                }, { br: [] }),
                // 운동 목표
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/goals/daily.json`, { headers });
                }),
                // 주간 목표
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities/goals/weekly.json`, { headers });
                }),
                // 평생 통계
                safeApiCall(async () => {
                    return await axios.get(`${FITBIT_CONFIG.apiUrl}/activities.json`, { headers });
                })
            ]);

            // 수면 데이터에서 가장 최근 수면 기록 가져오기
            const latestSleep = sleep?.sleep?.[0] || null;

            // 고급 지표 데이터 추출
            const tempSkinData = bodyTemp?.tempSkin?.[0]?.value?.nightlyRelative;
            const spo2Data = oxygenSaturation?.spo2?.[0]?.value;
            const breathingRateData = breathingRate?.br?.[0]?.value?.breathingRate;
            const dailyHrvData = hrvData?.hrv?.[0]?.value;
            const restingHeartRate = heartRate?.['activities-heart']?.[0]?.value?.restingHeartRate;
            const deepSleepMinutes = latestSleep?.levels?.summary?.deep?.minutes || 0;

            // 스트레스 점수 계산
            const stressScore = this.calculateStressScore(
                dailyHrvData?.dailyRmssd || 0,
                restingHeartRate || 0,
                deepSleepMinutes
            );

            // 데이터 정리 및 반환 (intraday 데이터는 포함하지 않음)
            return {
                profile: {
                    ...profileData?.user,
                    cardio_fitness: profileData?.user?.vo2Max || null  // 심폐 건강 점수 (VO2 Max)
                },
                devices: devices || [],
                activities: {
                    summary: activities?.summary || {},
                    goals: {
                        daily: exerciseGoals || {},
                        weekly: weeklyGoals || {}
                    },
                    lifetime: lifetimeStats?.lifetime || {}
                },
                heart: {
                    daily: heartRate?.['activities-heart'] || [],
                    resting_heart_rate: restingHeartRate
                },
                sleep: {
                    details: sleep?.sleep || [],
                    summary: sleep?.summary || {},
                    score: latestSleep ? {
                        efficiency: latestSleep.efficiency,
                        duration: latestSleep.duration,
                        quality: latestSleep.efficiency >= 90 ? '매우 좋음' :
                            latestSleep.efficiency >= 80 ? '좋음' :
                                latestSleep.efficiency >= 70 ? '보통' : '개선 필요'
                    } : null,
                    deep_sleep_minutes: deepSleepMinutes
                },
                body: {
                    weight: bodyWeight?.weight || [],
                    fat: bodyFat?.fat || [],
                    temp_skin: tempSkinData || null
                },
                nutrition: {
                    foods: foods?.foods || [],
                    water: water?.water || []
                },
                health_metrics: {
                    spo2: spo2Data || null,
                    breathing_rate: breathingRateData || null,
                    hrv: dailyHrvData ? {
                        daily_rmssd: dailyHrvData.dailyRmssd,
                        deep_rmssd: dailyHrvData.deepRmssd
                    } : null,
                    stress_score: stressScore
                }
            };
        } catch (error) {
            console.error('전체 데이터(intraday 제외) 조회 중 오류:', error.response?.data || error.message);
            throw new Error('전체 데이터 조회 실패: ' + (error.response?.data?.errors?.[0]?.message || error.message));
        }
    }

    async getDailyActivitySummary(userId, date) {
        try {
            const tokens = await this.getValidTokens(userId);
            const response = await axios.get(
                `${FITBIT_CONFIG.apiUrl}/activities/date/${date}.json`,
                { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
            );

            const summary = response.data.summary;
            const result = {
                date,
                averageDailySteps: summary.steps,
                rhr: summary.restingHeartRate || 0,
                total_steps: summary.steps,
                total_distance: summary.distances[0]?.distance || 0,
                total_calories_out: summary.caloriesOut,
                total_activity_calories: summary.activityCalories,
                caloriesBMR: summary.caloriesBMR,
                marginalCalories: summary.marginalCalories,
                sedentary_minutes: summary.sedentaryMinutes,
                lightly_active_minutes: summary.lightlyActiveMinutes,
                fairly_active_minutes: summary.fairlyActiveMinutes,
                very_active_minutes: summary.veryActiveMinutes,
                out_of_range_minutes: summary.heartRateZones[0]?.minutes || 0,
                fat_burn_minutes: summary.heartRateZones[1]?.minutes || 0,
                cardio_minutes: summary.heartRateZones[2]?.minutes || 0,
                peak_minutes: summary.heartRateZones[3]?.minutes || 0,
                out_of_range_calories: summary.heartRateZones[0]?.caloriesOut || 0,
                fat_burn_calories: summary.heartRateZones[1]?.caloriesOut || 0,
                cardio_calories: summary.heartRateZones[2]?.caloriesOut || 0,
                peak_calories: summary.heartRateZones[3]?.caloriesOut || 0
            };

            // RDS에 저장
            await fitbitDataService.saveActivitySummary(userId, result);

            return result;
        } catch (error) {
            console.error('일일 활동 요약 조회 중 오류:', error);
            throw error;
        }
    }
}

module.exports = new FitbitService();
