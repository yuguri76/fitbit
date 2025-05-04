require('dotenv').config();
const express = require('express');
const path = require('path');
const fitbitService = require('./services/fitbitService');
const fitbitRoutes = require('./routes/fitbitRoutes');
const sequelize = require('./config/database');

const app = express();
const port = process.env.PORT || 3001;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'views')));

// API 라우트
app.use('/api/fitbit', fitbitRoutes);

// 메인 페이지
app.get('/', (req, res) => {
    console.log('메인 페이지 요청'); // ← 이게 콘솔에 안 뜨면 요청이 안 옴
    const indexPath = path.join(__dirname, 'views', 'index.html');
    res.sendFile(indexPath);
});

app.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) {
            throw new Error('인증 코드가 없습니다.');
        }

        // state 파라미터에서 userId를 추출
        const userId = state;
        if (!userId) {
            throw new Error('사용자 ID를 찾을 수 없습니다.');
        }

        const tokens = await fitbitService.getAccessToken(code, userId);
        console.log('발급된 토큰 정보:', tokens);

        // userId를 URL 파라미터로 전달
        res.redirect(`/?auth=success&userId=${userId}`);
    } catch (error) {
        console.error('콜백 처리 중 상세 오류:', error.response?.data || error.message);
        res.status(500).send(`인증 처리 중 오류가 발생했습니다: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
}); 