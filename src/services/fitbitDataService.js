const mysql = require('mysql2/promise');
const fitbitService = require('./fitbitService');
const { DB_CONFIG } = require('../config');

class FitbitDataService {
    constructor() {
        this.pool = mysql.createPool(DB_CONFIG);
    }

    // encodedId로 users 테이블의 id 조회
    async getUserId(encodedId) {
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT id FROM users WHERE encodedId = ?',
                [encodedId]
            );
            if (rows.length === 0) {
                throw new Error(`User not found with encodedId: ${encodedId}`);
            }
            return rows[0].id;
        } finally {
            connection.release();
        }
    }

    // 디바이스 데이터 저장
    async saveDeviceData(encodedId, deviceData) {
        const connection = await this.pool.getConnection();
        try {
            const userId = await this.getUserId(encodedId);
            console.log('디바이스 데이터 저장 시도:', deviceData);
            for (const device of deviceData) {
                const query = `
                    INSERT INTO fitbit_device
                    (user_id, device_id, device_version, battery_level, last_sync_time)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    device_version = VALUES(device_version),
                    battery_level = VALUES(battery_level),
                    last_sync_time = VALUES(last_sync_time),
                    updated_at = CONVERT_TZ(NOW(), 'UTC', '+09:00')
                `;
                const values = [
                    userId,
                    device.id,
                    device.device_version,
                    device.battery_level,
                    device.last_sync_time
                ];
                console.log('실행할 쿼리:', query);
                console.log('쿼리 파라미터:', values);

                const [result] = await connection.execute(query, values);
                console.log('디바이스 데이터 저장 결과:', result);
            }
        } catch (error) {
            console.error('디바이스 데이터 저장 중 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 15분 단위 활동 데이터 저장
    async saveActivityData(encodedId, activityData) {
        const connection = await this.pool.getConnection();
        try {
            const userId = await this.getUserId(encodedId);
            console.log('활동 데이터 저장 시도:', activityData);
            const { date, summary } = activityData;
            const query = `
                INSERT INTO fitbit_activity_data
                (user_id, date, steps, distance_m, calories_total, heart_rate)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const values = [
                userId,
                new Date(date),
                summary.steps_sum || 0,
                summary.distance_sum || 0,
                summary.calories_sum || 0,
                summary.heartrate_avg || 0
            ];
            console.log('실행할 쿼리:', query);
            console.log('쿼리 파라미터:', values);

            const [result] = await connection.execute(query, values);
            console.log('활동 데이터 저장 결과:', result);
        } catch (error) {
            console.error('활동 데이터 저장 중 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 하루 단위 활동 요약 저장
    async saveActivitySummary(encodedId, summaryData) {
        const connection = await this.pool.getConnection();
        try {
            const userId = await this.getUserId(encodedId);
            console.log('활동 요약 데이터 저장 시도:', summaryData);
            const query = `
                INSERT INTO fitbit_activity_summary
                (user_id, date, averageDailySteps, rhr, total_steps, total_distance,
                total_calories_out, total_activity_calories, caloriesBMR, marginalCalories,
                sedentary_minutes, lightly_active_minutes, fairly_active_minutes, very_active_minutes,
                out_of_range_minutes, fat_burn_minutes, cardio_minutes, peak_minutes,
                out_of_range_calories, fat_burn_calories, cardio_calories, peak_calories)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                averageDailySteps = VALUES(averageDailySteps),
                rhr = VALUES(rhr),
                total_steps = VALUES(total_steps),
                total_distance = VALUES(total_distance),
                total_calories_out = VALUES(total_calories_out),
                total_activity_calories = VALUES(total_activity_calories),
                caloriesBMR = VALUES(caloriesBMR),
                marginalCalories = VALUES(marginalCalories),
                sedentary_minutes = VALUES(sedentary_minutes),
                lightly_active_minutes = VALUES(lightly_active_minutes),
                fairly_active_minutes = VALUES(fairly_active_minutes),
                very_active_minutes = VALUES(very_active_minutes),
                out_of_range_minutes = VALUES(out_of_range_minutes),
                fat_burn_minutes = VALUES(fat_burn_minutes),
                cardio_minutes = VALUES(cardio_minutes),
                peak_minutes = VALUES(peak_minutes),
                out_of_range_calories = VALUES(out_of_range_calories),
                fat_burn_calories = VALUES(fat_burn_calories),
                cardio_calories = VALUES(cardio_calories),
                peak_calories = VALUES(peak_calories)
            `;
            const values = [
                userId,
                summaryData.date,
                summaryData.averageDailySteps,
                summaryData.rhr,
                summaryData.total_steps,
                summaryData.total_distance,
                summaryData.total_calories_out,
                summaryData.total_activity_calories,
                summaryData.caloriesBMR,
                summaryData.marginalCalories,
                summaryData.sedentary_minutes,
                summaryData.lightly_active_minutes,
                summaryData.fairly_active_minutes,
                summaryData.very_active_minutes,
                summaryData.out_of_range_minutes,
                summaryData.fat_burn_minutes,
                summaryData.cardio_minutes,
                summaryData.peak_minutes,
                summaryData.out_of_range_calories,
                summaryData.fat_burn_calories,
                summaryData.cardio_calories,
                summaryData.peak_calories
            ];
            console.log('실행할 쿼리:', query);
            console.log('쿼리 파라미터:', values);

            const [result] = await connection.execute(query, values);
            console.log('활동 요약 데이터 저장 결과:', result);
        } catch (error) {
            console.error('활동 요약 데이터 저장 중 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 건강 지표 데이터 저장
    async saveHealthMetrics(encodedId, healthData) {
        const connection = await this.pool.getConnection();
        try {
            const userId = await this.getUserId(encodedId);
            console.log('건강 지표 데이터 저장 시도:', healthData);

            // stress 데이터 구조 확인 및 정규화
            let stressScore = null;
            let hrvContribution = null;
            let rhrContribution = null;
            let sleepContribution = null;

            if (healthData.stress_score) {
                stressScore = healthData.stress_score.stress_score;
                hrvContribution = healthData.stress_score.components?.hrv_contribution;
                rhrContribution = healthData.stress_score.components?.rhr_contribution;
                sleepContribution = healthData.stress_score.components?.sleep_contribution;
            } else if (healthData.health_metrics?.stress) {
                stressScore = healthData.health_metrics.stress.stress_score;
                hrvContribution = healthData.health_metrics.stress.components?.hrv_contribution;
                rhrContribution = healthData.health_metrics.stress.components?.rhr_contribution;
                sleepContribution = healthData.health_metrics.stress.components?.sleep_contribution;
            }

            const query = `
                INSERT INTO fitbit_health_metrics
                (user_id, date, daily_hrv, sleep_hrv, breathing_rate, skin_temperature,
                stress_score, hrv_contribution, rhr_contribution, sleep_contribution)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                daily_hrv = VALUES(daily_hrv),
                sleep_hrv = VALUES(sleep_hrv),
                breathing_rate = VALUES(breathing_rate),
                skin_temperature = VALUES(skin_temperature),
                stress_score = VALUES(stress_score),
                hrv_contribution = VALUES(hrv_contribution),
                rhr_contribution = VALUES(rhr_contribution),
                sleep_contribution = VALUES(sleep_contribution)
            `;
            const values = [
                userId,
                healthData.date,
                healthData.daily_hrv,
                healthData.sleep_hrv,
                healthData.breathing_rate,
                healthData.skin_temperature,
                stressScore || 0,
                hrvContribution || 0,
                rhrContribution || 0,
                sleepContribution || 0
            ];
            console.log('실행할 쿼리:', query);
            console.log('쿼리 파라미터:', values);

            const [result] = await connection.execute(query, values);
            console.log('건강 지표 데이터 저장 결과:', result);
        } catch (error) {
            console.error('건강 지표 데이터 저장 중 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 수면 데이터 저장
    async saveSleepData(encodedId, sleepData) {
        const connection = await this.pool.getConnection();
        try {
            const userId = await this.getUserId(encodedId);
            console.log('수면 데이터 저장 시도:', sleepData);
            const query = `
                INSERT INTO fitbit_sleep_data
                (user_id, date, startTime, endTime, total_sleep_minutes,
                deep_sleep_hours, light_sleep_hours, rem_sleep_hours,
                minutesAwake, awakeningsCount, awakeCount, awakeDuration,
                restlessCount, restlessDuration, logId, timeInBed,
                minutesAsleep, efficiency, duration, quality, isMainSleep)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                startTime = VALUES(startTime),
                endTime = VALUES(endTime),
                total_sleep_minutes = VALUES(total_sleep_minutes),
                deep_sleep_hours = VALUES(deep_sleep_hours),
                light_sleep_hours = VALUES(light_sleep_hours),
                rem_sleep_hours = VALUES(rem_sleep_hours),
                minutesAwake = VALUES(minutesAwake),
                awakeningsCount = VALUES(awakeningsCount),
                awakeCount = VALUES(awakeCount),
                awakeDuration = VALUES(awakeDuration),
                restlessCount = VALUES(restlessCount),
                restlessDuration = VALUES(restlessDuration),
                timeInBed = VALUES(timeInBed),
                minutesAsleep = VALUES(minutesAsleep),
                efficiency = VALUES(efficiency),
                duration = VALUES(duration),
                quality = VALUES(quality),
                isMainSleep = VALUES(isMainSleep)
            `;
            const values = [
                userId,
                sleepData.date,
                sleepData.startTime,
                sleepData.endTime,
                sleepData.total_sleep_minutes,
                sleepData.stages?.deep || 0,
                sleepData.stages?.light || 0,
                sleepData.stages?.rem || 0,
                sleepData.minutesAwake,
                sleepData.awakeningsCount,
                sleepData.awakeCount,
                sleepData.awakeDuration,
                sleepData.restlessCount,
                sleepData.restlessDuration,
                sleepData.logId,
                sleepData.timeInBed,
                sleepData.minutesAsleep,
                sleepData.efficiency,
                sleepData.duration,
                sleepData.quality,
                sleepData.isMainSleep
            ];
            console.log('실행할 쿼리:', query);
            console.log('쿼리 파라미터:', values);

            const [result] = await connection.execute(query, values);
            console.log('수면 데이터 저장 결과:', result);
        } catch (error) {
            console.error('수면 데이터 저장 중 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 테스트용 데이터 저장 함수
    async testSaveAll(encodedId) {
        try {
            const today = new Date().toISOString().split('T')[0];

            // 디바이스 데이터 저장 테스트
            const deviceData = await fitbitService.getDeviceInfo(encodedId);
            await this.saveDeviceData(encodedId, deviceData);

            // 활동 데이터 저장 테스트
            const activityData = await fitbitService.getIntradayData(encodedId, today);
            await this.saveActivityData(encodedId, activityData);

            // 활동 요약 저장 테스트
            const summaryData = await fitbitService.getDailyActivitySummary(encodedId, today);
            await this.saveActivitySummary(encodedId, summaryData);

            // 건강 지표 저장 테스트
            const healthData = await fitbitService.getHealthMetrics(encodedId, today);
            await this.saveHealthMetrics(encodedId, healthData);

            // 수면 데이터 저장 테스트
            const sleepData = await fitbitService.getSleepData(encodedId, today);
            await this.saveSleepData(encodedId, sleepData);

            return {
                success: true,
                message: '모든 데이터 저장 테스트가 완료되었습니다.'
            };
        } catch (error) {
            console.error('데이터 저장 테스트 중 오류 발생:', error);
            throw error;
        }
    }
}

module.exports = new FitbitDataService();
