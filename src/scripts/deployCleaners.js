// Fitbit 데이터 정리 람다 함수 배포 스크립트
require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// AWS 자격 증명 설정
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-northeast-2'
});

// Lambda 서비스 객체 생성
const lambda = new AWS.Lambda();
const eventBridge = new AWS.EventBridge();

// 배포할 클리너 함수 정의
const cleaners = [
    {
        name: 'fitbitShortTermCleaner',
        handler: 'fitbitShortTermCleaner.handler',
        description: 'Fitbit 원시 데이터 자동 정리 함수 (7일 이전 데이터 삭제)',
        schedule: 'cron(0 1 * * ? *)', // 매일 새벽 1시 (UTC)
        timeout: 90,
        scheduleInput: {
            retention_days: 7,
            dry_run: false
        }
    },
    {
        name: 'fitbitAverageCleaner',
        handler: 'fitbitAverageCleaner.handler',
        description: 'Fitbit 단기 평균 데이터 자동 정리 함수 (30일 이전 모든 데이터 삭제)',
        schedule: 'cron(0 2 * * ? *)', // 매일 새벽 2시 (UTC)
        timeout: 90,
        scheduleInput: {
            retention_days: 30,
            dry_run: false
        }
    }
];

// 역할 정의
const roleArn = process.env.AWS_LAMBDA_ROLE_ARN;

// ZIP 파일 생성
async function createZipFile(cleaner) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(__dirname, `../../${cleaner.name}.zip`);
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`${cleaner.name} ZIP 파일 생성 완료: ${archive.pointer()} 바이트`);
            resolve(outputPath);
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Lambda 함수 파일 추가
        archive.file(path.join(__dirname, `../lambda/${cleaner.name}.js`), { name: `${cleaner.name}.js` });

        // 공통 유틸리티 파일 추가
        archive.file(path.join(__dirname, '../lambda/config/environment.js'), { name: 'config/environment.js' });

        // package.json 추가
        archive.file(path.join(__dirname, '../../package.json'), { name: 'package.json' });

        archive.finalize();
    });
}

// Lambda 함수 존재 여부 확인
async function checkFunctionExists(functionName) {
    try {
        await lambda.getFunction({ FunctionName: functionName }).promise();
        return true;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            return false;
        }
        throw error;
    }
}

// Lambda 함수 생성
async function createFunction(cleaner, zipFilePath) {
    const zipFile = fs.readFileSync(zipFilePath);

    const params = {
        Code: {
            ZipFile: zipFile
        },
        FunctionName: cleaner.name,
        Handler: cleaner.handler,
        Role: roleArn,
        Runtime: 'nodejs16.x',
        Description: cleaner.description,
        Timeout: cleaner.timeout,
        MemorySize: 256,
        Environment: {
            Variables: {
                NODE_ENV: process.env.NODE_ENV || 'production',
                DB_HOST: process.env.DB_HOST,
                DB_USER: process.env.DB_USER,
                DB_PASSWORD: process.env.DB_PASSWORD,
                DB_NAME: process.env.DB_NAME,
                DB_PORT: process.env.DB_PORT
            }
        }
    };

    console.log(`Lambda 함수 ${cleaner.name} 생성 중...`);
    return lambda.createFunction(params).promise();
}

// Lambda 함수 업데이트
async function updateFunction(cleaner, zipFilePath) {
    const zipFile = fs.readFileSync(zipFilePath);

    // 코드 업데이트
    const codeParams = {
        FunctionName: cleaner.name,
        ZipFile: zipFile
    };

    console.log(`Lambda 함수 ${cleaner.name} 코드 업데이트 중...`);
    await lambda.updateFunctionCode(codeParams).promise();

    // 설정 업데이트
    const configParams = {
        FunctionName: cleaner.name,
        Handler: cleaner.handler,
        Role: roleArn,
        Runtime: 'nodejs16.x',
        Description: cleaner.description,
        Timeout: cleaner.timeout,
        MemorySize: 256,
        Environment: {
            Variables: {
                NODE_ENV: process.env.NODE_ENV || 'production',
                DB_HOST: process.env.DB_HOST,
                DB_USER: process.env.DB_USER,
                DB_PASSWORD: process.env.DB_PASSWORD,
                DB_NAME: process.env.DB_NAME,
                DB_PORT: process.env.DB_PORT
            }
        }
    };

    console.log(`Lambda 함수 ${cleaner.name} 설정 업데이트 중...`);
    return lambda.updateFunctionConfiguration(configParams).promise();
}

// EventBridge 규칙 생성
async function createEventRule(cleaner) {
    // 규칙 생성
    const ruleParams = {
        Name: `${cleaner.name}-Trigger`,
        ScheduleExpression: cleaner.schedule,
        State: 'ENABLED',
        Description: `${cleaner.description}를 주기적으로 실행`
    };

    console.log(`EventBridge 규칙 ${cleaner.name}-Trigger 생성 중...`);
    await eventBridge.putRule(ruleParams).promise();

    // 대상 연결
    const targetParams = {
        Rule: `${cleaner.name}-Trigger`,
        Targets: [
            {
                Id: '1',
                Arn: `arn:aws:lambda:${AWS.config.region}:${process.env.AWS_ACCOUNT_ID}:function:${cleaner.name}`,
                Input: JSON.stringify({
                    body: JSON.stringify(cleaner.scheduleInput)
                })
            }
        ]
    };

    console.log(`EventBridge 대상 설정 중...`);
    return eventBridge.putTargets(targetParams).promise();
}

// Lambda 함수에 EventBridge 권한 부여
async function addPermission(cleaner) {
    const permissionParams = {
        Action: 'lambda:InvokeFunction',
        FunctionName: cleaner.name,
        Principal: 'events.amazonaws.com',
        SourceArn: `arn:aws:events:${AWS.config.region}:${process.env.AWS_ACCOUNT_ID}:rule/${cleaner.name}-Trigger`,
        StatementId: `${cleaner.name}-EventBridge-${Date.now()}`
    };

    console.log(`Lambda 함수 ${cleaner.name}에 EventBridge 권한 부여 중...`);
    return lambda.addPermission(permissionParams).promise();
}

// 배포 실행
async function deploy() {
    try {
        // 환경 변수 확인
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !roleArn) {
            throw new Error('필수 AWS 환경 변수가 설정되지 않았습니다.');
        }

        // 스케줄 설정 여부 결정
        const setupSchedule = process.argv.includes('--schedule');

        // 각 클리너 함수 처리
        for (const cleaner of cleaners) {
            // ZIP 파일 생성
            const zipFilePath = await createZipFile(cleaner);

            // 함수 존재 여부 확인
            const functionExists = await checkFunctionExists(cleaner.name);

            if (functionExists) {
                // 함수 업데이트
                await updateFunction(cleaner, zipFilePath);
                console.log(`Lambda 함수 '${cleaner.name}' 업데이트 완료`);
            } else {
                // 함수 생성
                await createFunction(cleaner, zipFilePath);
                console.log(`Lambda 함수 '${cleaner.name}' 생성 완료`);
            }

            // EventBridge 규칙 생성 및 권한 부여 (선택적)
            if (setupSchedule) {
                await createEventRule(cleaner);
                await addPermission(cleaner);
                console.log(`${cleaner.name} 스케줄 설정 완료`);
            }

            // 임시 ZIP 파일 정리
            fs.unlinkSync(zipFilePath);
        }

        console.log('모든 클리너 함수 배포가 성공적으로 완료되었습니다');
    } catch (error) {
        console.error('배포 중 오류 발생:', error);
    }
}

// 실행
deploy(); 