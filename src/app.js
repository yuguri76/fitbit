const express = require('express');
const path = require('path');
const cors = require('cors');
const fitbitRoutes = require('./routes/fitbitRoutes');
const authService = require('./services/authService');
const schedulerService = require('./services/schedulerService');

const app = express();

// 캐시 비활성화 미들웨어
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// 디버그 로깅 미들웨어
app.use((req, res, next) => {
    console.log('\n=== 새로운 요청 시작 ===');
    console.log('시간:', new Date().toISOString());
    console.log('요청 URL:', req.url);
    console.log('요청 메소드:', req.method);
    console.log('요청 경로:', req.path);
    console.log('요청 쿼리:', req.query);
    console.log('요청 헤더:', req.headers);
    console.log('========================\n');
    next();
});

// body parser 미들웨어 추가
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, 'views'), {
    etag: false,
    lastModified: false,
    maxAge: 0,
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
}));

// API 라우트
app.use('/api/fitbit', fitbitRoutes);

// Fitbit 콜백 라우트
app.get('/callback', async (req, res) => {
    console.log('\n=== 콜백 라우트 진입 (app.js) ===');
    console.log('요청 URL:', req.url);
    console.log('쿼리 파라미터:', req.query);

    try {
        const { code, state } = req.query;
        console.log('인증 코드:', code);
        console.log('상태:', state);

        if (!code) {
            throw new Error('인증 코드가 없습니다.');
        }

        const result = await authService.handleCallback(code, state || 'CB2P35');
        console.log('인증 결과:', result);

        // 302 리다이렉트로 변경
        res.writeHead(302, {
            'Location': '/?auth=success',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end();
    } catch (error) {
        console.error('콜백 처리 중 오류:', error);
        res.writeHead(302, {
            'Location': '/?auth=error',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end();
    }
    console.log('=== 콜백 라우트 종료 (app.js) ===\n');
});

// 메인 페이지 (마지막에 정의하여 다른 라우트들이 우선 처리되도록 함)
app.get('/', (req, res) => {
    console.log('메인 페이지 요청');
    const indexPath = path.join(__dirname, 'views', 'index.html');
    console.log('index.html 경로:', indexPath);
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('파일 전송 중 오류:', err);
            res.status(500).send('파일을 찾을 수 없습니다.');
        }
    });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
    console.error('\n=== 에러 발생 ===');
    console.error('시간:', new Date().toISOString());
    console.error('에러:', err);
    console.error('==================\n');
    res.status(500).json({ error: err.message });
});

// 404 핸들링
app.use((req, res) => {
    console.log('\n=== 404 에러 ===');
    console.log('시간:', new Date().toISOString());
    console.log('요청 URL:', req.url);
    console.log('요청 메소드:', req.method);
    console.log('요청 경로:', req.path);
    console.log('===============\n');
    res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log('\n=== 서버 시작 ===');
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log('콜백 URL:', process.env.FITBIT_REDIRECT_URI);
    console.log('=================\n');

    try {
        await schedulerService.startAllUsersDataCollection();
        console.log('Fitbit 데이터 수집 스케줄러가 시작되었습니다.');
    } catch (error) {
        console.error('스케줄러 시작 중 오류 발생:', error);
    }
});

// 앱 종료 시 모든 데이터 수집 중지
process.on('SIGINT', () => {
    schedulerService.stopAllDataCollection();
    process.exit(0);
});

module.exports = app; 