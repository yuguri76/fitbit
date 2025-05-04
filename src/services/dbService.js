const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../config');

class DBService {
    constructor() {
        this.pool = mysql.createPool(DB_CONFIG);
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            console.log('데이터베이스 연결 성공!');

            // 테이블 존재 여부 확인
            const tables = ['fitbit_devices', 'fitbit_activity_data', 'fitbit_activity_summary',
                'fitbit_health_metrics', 'fitbit_sleep_data'];

            for (const table of tables) {
                const [rows] = await connection.query(
                    `SELECT COUNT(*) as count FROM information_schema.tables 
                     WHERE table_schema = ? AND table_name = ?`,
                    [DB_CONFIG.database, table]
                );
                console.log(`${table}: ${rows[0].count > 0 ? '존재함' : '존재하지 않음'}`);
            }

            connection.release();
            return true;
        } catch (error) {
            console.error('데이터베이스 연결 오류:', error);
            throw error;
        }
    }

    // 단일 데이터 저장 테스트 (디바이스 데이터)
    async testSaveDevice(userId, deviceData) {
        const connection = await this.pool.getConnection();
        try {
            console.log('저장할 디바이스 데이터:', deviceData);

            await connection.query(
                `INSERT INTO fitbit_devices 
                (user_id, device_id, device_version, battery_level, last_sync_time) 
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                device_version = VALUES(device_version),
                battery_level = VALUES(battery_level),
                last_sync_time = VALUES(last_sync_time),
                updated_at = CURRENT_TIMESTAMP`,
                [
                    userId,
                    deviceData.id,
                    deviceData.device_version,
                    deviceData.battery_level,
                    deviceData.last_sync_time
                ]
            );

            console.log('디바이스 데이터 저장 성공!');
            return true;
        } catch (error) {
            console.error('디바이스 데이터 저장 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 단일 데이터 저장 테스트 (Intraday 활동 데이터)
    async testSaveIntraday(userId, activityData) {
        const connection = await this.pool.getConnection();
        try {
            console.log('저장할 활동 데이터:', activityData);

            await connection.query(
                `INSERT INTO fitbit_activity_data 
                (user_id, date, steps, distance_km, calories_total, heart_rate) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    new Date(activityData.date),
                    activityData.summary.steps_sum,
                    activityData.summary.distance_sum,
                    activityData.summary.calories_sum,
                    activityData.summary.heartrate_avg
                ]
            );

            console.log('활동 데이터 저장 성공!');
            return true;
        } catch (error) {
            console.error('활동 데이터 저장 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new DBService(); 