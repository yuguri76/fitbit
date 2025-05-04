// 환경변수 로드 확인
console.log('환경변수 확인:', {
    FITBIT_CLIENT_ID: process.env.FITBIT_CLIENT_ID,
    FITBIT_REDIRECT_URI: process.env.FITBIT_REDIRECT_URI,
    DB_HOST: process.env.DB_HOST
});

const FITBIT_CONFIG = {
    clientId: process.env.FITBIT_CLIENT_ID,
    clientSecret: process.env.FITBIT_CLIENT_SECRET,
    redirectUri: process.env.FITBIT_REDIRECT_URI,
    scope: process.env.FITBIT_SCOPE,
    apiUrl: 'https://api.fitbit.com/1/user/-',
    tokenUrl: 'https://api.fitbit.com/oauth2/token',
    authUrl: 'https://www.fitbit.com/oauth2/authorize'
};

// Fitbit 설정 확인
if (!FITBIT_CONFIG.clientId || !FITBIT_CONFIG.clientSecret || !FITBIT_CONFIG.redirectUri) {
    console.error('Fitbit 설정이 올바르지 않습니다:', FITBIT_CONFIG);
    throw new Error('필수 Fitbit 환경변수가 설정되지 않았습니다.');
}

const DB_CONFIG = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

module.exports = {
    FITBIT_CONFIG,
    DB_CONFIG
}; 