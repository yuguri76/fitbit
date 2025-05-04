const { Sequelize } = require('sequelize');
require('dotenv').config();

console.log('데이터베이스 연결 시도 중...', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        port: process.env.DB_PORT || 3306,
        logging: console.log,  // SQL 쿼리 로깅 활성화
        dialectOptions: {
            connectTimeout: 60000,  // 연결 타임아웃 설정
            ssl: 'Amazon RDS',  // AWS RDS SSL 설정
            timezone: '+09:00'  // KST 시간대 설정
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// 데이터베이스 연결 테스트
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('데이터베이스 연결이 성공적으로 설정되었습니다.');
    } catch (error) {
        console.error('데이터베이스 연결에 실패했습니다:', error);
        // 상세 에러 정보 출력
        if (error.original) {
            console.error('상세 에러:', {
                code: error.original.code,
                errno: error.original.errno,
                sqlState: error.original.sqlState,
                sqlMessage: error.original.sqlMessage
            });
        }
    }
};

testConnection();

module.exports = sequelize;
