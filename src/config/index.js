require('dotenv').config();

const FITBIT_CONFIG = {
    clientId: process.env.FITBIT_CLIENT_ID,
    clientSecret: process.env.FITBIT_CLIENT_SECRET,
    redirectUri: process.env.FITBIT_REDIRECT_URI,
    scope: process.env.FITBIT_SCOPE || 'activity heartrate sleep profile oxygen_saturation respiratory_rate temperature cardio_fitness electrocardiogram weight nutrition settings',
    authUrl: 'https://www.fitbit.com/oauth2/authorize',
    tokenUrl: 'https://api.fitbit.com/oauth2/token',
    apiUrl: 'https://api.fitbit.com/1/user/-'
};

module.exports = {
    FITBIT_CONFIG,
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development'
}; 