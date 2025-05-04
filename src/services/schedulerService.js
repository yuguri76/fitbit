const cron = require('node-cron');
const fitbitDataService = require('./fitbitDataService');
const tokenStore = require('./tokenStore');
const dbService = require('./dbService');

class SchedulerService {
    constructor() {
        this.jobs = {
            intraday: new Map(),    // 15분마다 실행 (FITBIT_ACTIVITY_DATA_CALL)
            daily: new Map(),       // 매일 06:00 실행 (FITBIT_DAILY_DATA_CALL)
            sleep: new Map(),       // 하루 5회 실행 (FITBIT_SLEEP_DATA_CALL)
            average: new Map()      // 매일 자정 실행 (FITBIT_AVERAGE_UPDATE_TRIGGER)
        };
    }

    // 15분마다 실행되는 데이터 수집 (FITBIT_ACTIVITY_DATA_CALL)
    async startIntradayCollection(userId) {
        if (this.jobs.intraday.has(userId)) {
            this.jobs.intraday.get(userId).stop();
        }

        const job = cron.schedule('*/15 * * * *', async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                console.log(`[${new Date().toISOString()}] ${userId}의 실시간 데이터 수집 시작...`);

                // 디바이스 데이터
                const deviceData = await fitbitDataService.getDeviceInfo(userId);
                await fitbitDataService.saveDeviceData(userId, deviceData);

                // Intraday 활동 데이터
                const intradayData = await fitbitDataService.getIntradayData(userId, today);
                await fitbitDataService.saveActivityData(userId, intradayData);

                console.log(`[${new Date().toISOString()}] ${userId}의 실시간 데이터 수집 완료`);
            } catch (error) {
                this.handleError(error, userId, 'intraday');
            }
        }, {
            timezone: "Asia/Seoul"
        });

        job.start();
        this.jobs.intraday.set(userId, job);
        console.log(`${userId}의 실시간 데이터 수집 스케줄러가 시작되었습니다.`);
    }

    // 매일 06:00에 실행되는 데이터 수집 (FITBIT_DAILY_DATA_CALL)
    async startDailyCollection(userId) {
        if (this.jobs.daily.has(userId)) {
            this.jobs.daily.get(userId).stop();
        }

        const job = cron.schedule('0 6 * * *', async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                console.log(`[${new Date().toISOString()}] ${userId}의 일일 데이터 수집 시작...`);

                // 하루 단위 활동 요약
                const activitySummary = await fitbitDataService.getDailyActivitySummary(userId, today);
                await fitbitDataService.saveActivitySummary(userId, activitySummary);

                // 건강 지표 데이터
                const healthMetrics = await fitbitDataService.getHealthMetrics(userId, today);
                await fitbitDataService.saveHealthMetrics(userId, healthMetrics);

                console.log(`[${new Date().toISOString()}] ${userId}의 일일 데이터 수집 완료`);
            } catch (error) {
                this.handleError(error, userId, 'daily');
            }
        }, {
            timezone: "Asia/Seoul"
        });

        job.start();
        this.jobs.daily.set(userId, job);
        console.log(`${userId}의 일일 데이터 수집 스케줄러가 시작되었습니다.`);
    }

    // 하루 5회 실행되는 수면 데이터 수집 (FITBIT_SLEEP_DATA_CALL)
    async startSleepCollection(userId) {
        if (this.jobs.sleep.has(userId)) {
            this.jobs.sleep.get(userId).stop();
        }

        const job = cron.schedule('0 7,10,14,19,0 * * *', async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                console.log(`[${new Date().toISOString()}] ${userId}의 수면 데이터 수집 시작...`);

                const sleepData = await fitbitDataService.getSleepData(userId, today);
                await fitbitDataService.saveSleepData(userId, sleepData);

                console.log(`[${new Date().toISOString()}] ${userId}의 수면 데이터 수집 완료`);
            } catch (error) {
                this.handleError(error, userId, 'sleep');
            }
        }, {
            timezone: "Asia/Seoul"
        });

        job.start();
        this.jobs.sleep.set(userId, job);
        console.log(`${userId}의 수면 데이터 수집 스케줄러가 시작되었습니다.`);
    }

    // 매일 자정에 실행되는 평균 데이터 계산 (FITBIT_AVERAGE_UPDATE_TRIGGER)
    async startAverageCalculation(userId) {
        if (this.jobs.average.has(userId)) {
            this.jobs.average.get(userId).stop();
        }

        const job = cron.schedule('0 0 * * *', async () => {
            try {
                console.log(`[${new Date().toISOString()}] ${userId}의 평균 데이터 계산 시작...`);

                // MySQL Event Scheduler에서 처리
                await dbService.executeQuery('CALL calculate_user_averages(?)', [userId]);

                console.log(`[${new Date().toISOString()}] ${userId}의 평균 데이터 계산 완료`);
            } catch (error) {
                this.handleError(error, userId, 'average');
            }
        }, {
            timezone: "Asia/Seoul"
        });

        job.start();
        this.jobs.average.set(userId, job);
        console.log(`${userId}의 평균 데이터 계산 스케줄러가 시작되었습니다.`);
    }

    // 에러 처리
    handleError(error, userId, jobType) {
        console.error(`[${new Date().toISOString()}] ${userId}의 ${jobType} 데이터 수집 중 오류 발생:`, error);

        if (error.message.includes('토큰') || error.message.includes('인증')) {
            console.log(`${userId}의 ${jobType} 데이터 수집 작업을 중지합니다.`);
            this.stopDataCollection(userId, jobType);
        }
    }

    // 특정 사용자의 특정 유형 데이터 수집 작업 중지
    stopDataCollection(userId, jobType) {
        if (jobType) {
            const job = this.jobs[jobType].get(userId);
            if (job) {
                job.stop();
                this.jobs[jobType].delete(userId);
                console.log(`${userId}의 ${jobType} 데이터 수집이 중지되었습니다.`);
            }
        } else {
            // 모든 유형의 작업 중지
            Object.keys(this.jobs).forEach(type => {
                const job = this.jobs[type].get(userId);
                if (job) {
                    job.stop();
                    this.jobs[type].delete(userId);
                }
            });
            console.log(`${userId}의 모든 데이터 수집이 중지되었습니다.`);
        }
    }

    // 모든 활성 사용자에 대한 데이터 수집 시작
    async startAllUsersDataCollection() {
        try {
            const users = await tokenStore.getAllUsers();
            for (const user of users) {
                await this.startIntradayCollection(user.userId);
                await this.startDailyCollection(user.userId);
                await this.startSleepCollection(user.userId);
                await this.startAverageCalculation(user.userId);
            }
            console.log(`전체 사용자(${users.length}명)의 데이터 수집이 시작되었습니다.`);
        } catch (error) {
            console.error('데이터 수집 시작 중 오류 발생:', error);
        }
    }

    // 모든 데이터 수집 작업 중지
    stopAllDataCollection() {
        Object.keys(this.jobs).forEach(type => {
            for (const [userId, job] of this.jobs[type]) {
                job.stop();
                console.log(`${userId}의 ${type} 데이터 수집이 중지되었습니다.`);
            }
            this.jobs[type].clear();
        });
        console.log('모든 데이터 수집이 중지되었습니다.');
    }
}

module.exports = new SchedulerService(); 