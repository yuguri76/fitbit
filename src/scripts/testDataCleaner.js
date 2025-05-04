// 데이터 정리 람다 함수 테스트 스크립트
require('dotenv').config();
const { handler } = require('../lambda/fitbitDataCleaner');

// 테스트 이벤트 생성 (dry_run 모드로 실행)
const testEvent = {
    body: JSON.stringify({
        intraday_retention_days: 30,   // 30일 이전 데이터 삭제
        average_retention_days: 365,   // 1년 이전 데이터 삭제
        dry_run: true                 // 실제 삭제는 수행하지 않고 시뮬레이션만 진행
    })
};

// 람다 함수 실행
async function testDataCleaner() {
    try {
        console.log('데이터 정리 테스트 시작...');
        const result = await handler(testEvent);
        console.log('테스트 결과:');
        console.log(JSON.parse(result.body));
    } catch (error) {
        console.error('테스트 중 오류 발생:', error);
    }
}

// 실행
testDataCleaner(); 