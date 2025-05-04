const express = require('express');
const router = express.Router();
const fitbitService = require('../services/fitbitService');
const authService = require('../services/authService');
const dbService = require('../services/dbService');
const fitbitDataService = require('../services/fitbitDataService');

/**
 * 전체 Fitbit 데이터 조회 엔드포인트
 * GET /api/fitbit/all-data/:userId/:date
 * 
 * 응답 데이터:
 * - deviceInfo: 기기 정보
 *   - device_id: 디바이스 ID
 *   - device_version: 모델명
 *   - battery_level: 배터리 잔량
 *   - battery_status: 배터리 상태
 *   - last_sync_time: 마지막 동기화 시간
 * 
 * - activityData: 활동 데이터
 *   - steps: 걸음 수
 *   - heart_rate: 평균 심박수
 *   - calories_burned: 칼로리 소모량
 *   - fairly_active_minutes: 중간 강도 활동 시간
 *   - very_active_minutes: 높은 강도 활동 시간
 *   - lightly_active_minutes: 낮은 강도 활동 시간
 * 
 * - healthMetrics: 건강 지표
 *   - spo2: 산소포화도
 *   - hrv: 심박수 변동성
 *   - rhr: 안정 시 심박수
 *   - respiratory_rate: 호흡수
 *   - skin_temperature: 피부 온도 변화
 *   - blood_glucose: 혈당 수치
 *   - blood_pressure_systolic: 수축기 혈압
 *   - blood_pressure_diastolic: 이완기 혈압
 *   - stress_score: 스트레스 지수
 *   - readiness_score: 종합 건강 점수
 * 
 * - sleepData: 수면 데이터
 *   - session_start: 수면 시작 시간
 *   - session_end: 수면 종료 시간
 *   - total_sleep_hours: 총 수면 시간
 *   - deep_sleep_hours: 깊은 수면 시간
 *   - light_sleep_hours: 얕은 수면 시간
 *   - rem_sleep_hours: REM 수면 시간
 *   - awake_hours: 깨어있는 시간
 *   - avg_heart_rate: 수면 중 평균 심박수
 *   - avg_breathing_rate: 수면 중 평균 호흡수
 *   - avg_spo2: 수면 중 평균 산소포화도
 *   - stress_score: 스트레스 점수
 *   - overall_health_score: 종합 수면 점수
 *   - is_main_sleep: 주수면 여부
 */
router.get('/all-data/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const [deviceInfo, activityData, healthMetrics, sleepData, profileData] = await Promise.all([
            fitbitService.getDeviceInfo(userId),
            fitbitService.getActivityData(userId, date),
            fitbitService.getHealthMetrics(userId, date),
            fitbitService.getSleepData(userId, date),
            fitbitService.getUserProfile(userId)
        ]);

        res.json({
            deviceInfo,
            activityData,
            healthMetrics,
            sleepData,
            profileData
        });
    } catch (error) {
        console.error('전체 데이터 조회 중 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 전체 Fitbit 데이터 조회
router.get('/complete-data/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const allData = await fitbitService.getAllFitbitData(userId, date);
        res.json(allData);
    } catch (error) {
        console.error('전체 Fitbit 데이터 조회 중 오류:', error);

        // 재인증이 필요한 경우
        if (error.message.includes('인증이 필요합니다')) {
            const authUrl = error.message.split('이동하세요: ')[1];
            res.status(401).json({
                error: '재인증이 필요합니다',
                authUrl: authUrl
            });
            return;
        }

        // 기타 오류
        res.status(500).json({
            error: error.message,
            details: error.response?.data || '알 수 없는 오류가 발생했습니다.'
        });
    }
});

// 심박수 데이터 조회
router.get('/heartrate/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const heartRateData = await fitbitService.getHeartRateData(userId, date);
        res.json(heartRateData);
    } catch (error) {
        console.error('심박수 데이터 조회 중 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 수면 데이터 조회
router.get('/sleep/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const data = await fitbitService.getSleepData(userId, date);
        console.log('수면 데이터 응답:', data);
        res.json(data);
    } catch (error) {
        console.error('수면 데이터 조회 중 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fitbit 로그인 URL 생성
router.get('/login', (req, res) => {
    console.log('\n=== 로그인 라우트 진입 ===');
    try {
        const userId = req.query.userId;
        if (!userId) {
            throw new Error('사용자 ID가 필요합니다.');
        }

        console.log('1. 인증 URL 생성 시작');
        const authUrl = authService.getAuthorizationUrl(userId);
        console.log('2. 생성된 인증 URL:', authUrl);
        console.log('3. 인증 페이지로 리다이렉트');
        res.redirect(authUrl);
    } catch (error) {
        console.error('로그인 URL 생성 중 오류:', error);
        res.status(400).json({ error: error.message });
    }
    console.log('=== 로그인 라우트 종료 ===\n');
});

// 프로필 조회
router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const profileData = await fitbitService.getUserProfile(userId);
        res.json(profileData);
    } catch (error) {
        console.error('프로필 조회 중 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 기기 정보 조회
router.get('/device/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const data = await fitbitService.getDeviceInfo(userId);
        console.log('기기 데이터 응답:', data);
        res.json(data);
    } catch (error) {
        console.error('기기 데이터 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 활동 데이터 조회
router.get('/activity/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const activityData = await fitbitService.getActivityData(userId, date);
        res.json(activityData);
    } catch (error) {
        console.error('활동 데이터 조회 중 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 건강 지표 조회
router.get('/health/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const data = await fitbitService.getHealthMetrics(userId, date);
        console.log('건강 데이터 응답:', data);
        res.json(data);
    } catch (error) {
        console.error('건강 데이터 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * intraday 데이터를 제외한 전체 데이터 조회 엔드포인트
 * GET /api/fitbit/non-intraday-data/:userId/:date
 */
router.get('/non-intraday-data/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const allData = await fitbitService.getNonIntradayAllData(userId, date);
        res.json(allData);
    } catch (error) {
        console.error('전체 데이터(intraday 제외) 조회 중 오류:', error);

        // 재인증이 필요한 경우
        if (error.message.includes('인증이 필요합니다')) {
            const authUrl = error.message.split('이동하세요: ')[1];
            res.status(401).json({
                error: '재인증이 필요합니다',
                authUrl: authUrl
            });
            return;
        }

        res.status(500).json({
            error: error.message,
            details: error.response?.data || '알 수 없는 오류가 발생했습니다.'
        });
    }
});

/**
 * intraday 데이터만 조회하는 엔드포인트
 * GET /api/fitbit/intraday-data/:userId/:date
 */
router.get('/intraday-data/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const intradayData = await fitbitService.getIntradayData(userId, date);
        res.json(intradayData);
    } catch (error) {
        console.error('intraday 데이터 조회 중 오류:', error);

        // 재인증이 필요한 경우
        if (error.message.includes('인증이 필요합니다')) {
            const authUrl = error.message.split('이동하세요: ')[1];
            res.status(401).json({
                error: '재인증이 필요합니다',
                authUrl: authUrl
            });
            return;
        }

        res.status(500).json({
            error: error.message,
            details: error.response?.data || '알 수 없는 오류가 발생했습니다.'
        });
    }
});

/**
 * intraday 데이터를 포함한 전체 데이터 조회 엔드포인트
 * GET /api/fitbit/complete-with-intraday/:userId/:date
 */
router.get('/complete-with-intraday/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;

        // 두 가지 API 호출을 병렬로 처리
        const [nonIntradayData, intradayData] = await Promise.all([
            fitbitService.getNonIntradayAllData(userId, date),
            fitbitService.getIntradayData(userId, date)
        ]);

        // 두 데이터를 합쳐서 전체 데이터 구성
        const completeData = {
            ...nonIntradayData,
            intraday_data: intradayData
        };

        res.json(completeData);
    } catch (error) {
        console.error('전체 데이터(intraday 포함) 조회 중 오류:', error);

        // 재인증이 필요한 경우
        if (error.message.includes('인증이 필요합니다')) {
            const authUrl = error.message.split('이동하세요: ')[1];
            res.status(401).json({
                error: '재인증이 필요합니다',
                authUrl: authUrl
            });
            return;
        }

        res.status(500).json({
            error: error.message,
            details: error.response?.data || '알 수 없는 오류가 발생했습니다.'
        });
    }
});

// 인증 라우트
router.get('/auth', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).send('사용자 ID가 필요합니다.');
    }
    const authUrl = await authService.getAuthorizationUrl(userId);
    res.redirect(authUrl);
});

// 기기 데이터
router.get('/devices/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const devices = await fitbitService.getDevices(userId);
        res.json(devices);
    } catch (error) {
        console.error('기기 데이터 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// Intraday 데이터 (15분)
router.get('/intraday/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const data = await fitbitService.getIntradayData(userId, date);
        console.log('Intraday 데이터 응답:', data);
        res.json(data);
    } catch (error) {
        console.error('Intraday 데이터 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 하루단위 활동 데이터
router.get('/daily-activity/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const data = await fitbitService.getDailyActivitySummary(userId, date);
        console.log('하루단위 활동 데이터 응답:', data);
        res.json(data);
    } catch (error) {
        console.error('하루단위 활동 데이터 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 모든 데이터
router.get('/all/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        const data = await fitbitService.getAllFitbitData(userId, date);
        console.log('전체 데이터 응답:', data);
        res.json(data);
    } catch (error) {
        console.error('전체 데이터 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// DB 연결 테스트 라우트 추가
router.get('/test-db', async (req, res) => {
    try {
        await dbService.testConnection();
        res.json({ message: '데이터베이스 연결 테스트 완료' });
    } catch (error) {
        res.status(500).json({ error: '데이터베이스 연결 테스트 실패', details: error.message });
    }
});

// 디바이스 데이터 저장 테스트
router.get('/test-save-device/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const deviceData = await fitbitService.getDeviceInfo(userId);
        await dbService.testSaveDevice(userId, deviceData[0]); // 첫 번째 디바이스만 테스트
        res.json({ message: '디바이스 데이터 저장 테스트 완료' });
    } catch (error) {
        res.status(500).json({ error: '디바이스 데이터 저장 테스트 실패', details: error.message });
    }
});

// Intraday 활동 데이터 저장 테스트
router.get('/test-save-intraday/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const today = new Date().toISOString().split('T')[0];
        const intradayData = await fitbitService.getIntradayData(userId, today);
        await dbService.testSaveIntraday(userId, intradayData);
        res.json({ message: 'Intraday 활동 데이터 저장 테스트 완료' });
    } catch (error) {
        res.status(500).json({ error: 'Intraday 활동 데이터 저장 테스트 실패', details: error.message });
    }
});

module.exports = router; 