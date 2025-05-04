// 데이터 정리 람다 함수 배포 스크립트
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

// 함수 이름 및 역할 정의
const functionName = 'fitbitDataCleaner';
const roleArn = process.env.AWS_LAMBDA_ROLE_ARN;

// ZIP 파일 생성
async function createZipFile() {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(path.join(__dirname, '../../deploy.zip'));
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`ZIP 파일 생성 완료: ${archive.pointer()} 바이트`);
            resolve(path.join(__dirname, '../../deploy.zip'));
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Lambda 함수 파일 추가
        archive.file(path.join(__dirname, '../lambda/fitbitDataCleaner.js'), { name: 'fitbitDataCleaner.js' });

        // 필요한 모델 파일 추가 (경로는 프로젝트 구조에 맞게 조정 필요)
        archive.file(path.join(__dirname, '../models/IntradayData.js'), { name: 'models/IntradayData.js' });
        archive.file(path.join(__dirname, '../models/FitbitAverage.js'), { name: 'models/FitbitAverage.js' });

        // 필요한 설정 파일 추가
        archive.file(path.join(__dirname, '../config/database.js'), { name: 'config/database.js' });

        // package.json 및 node_modules 추가 (선택적)
        archive.file(path.join(__dirname, '../../package.json'), { name: 'package.json' });
        // archive.directory(path.join(__dirname, '../../node_modules'), 'node_modules');

        archive.finalize();
    });
}

// Lambda 함수 존재 여부 확인
async function checkFunctionExists() {
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
async function createFunction(zipFilePath) {
    const zipFile = fs.readFileSync(zipFilePath);

    const params = {
        Code: {
            ZipFile: zipFile
        },
        FunctionName: functionName,
        Handler: 'fitbitDataCleaner.handler',
        Role: roleArn,
        Runtime: 'nodejs16.x',
        Description: 'Fitbit 데이터 자동 정리 함수',
        Timeout: 60,
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

    console.log('Lambda 함수 생성 중...');
    return lambda.createFunction(params).promise();
}

// Lambda 함수 업데이트
async function updateFunction(zipFilePath) {
    const zipFile = fs.readFileSync(zipFilePath);

    // 코드 업데이트
    const codeParams = {
        FunctionName: functionName,
        ZipFile: zipFile
    };

    console.log('Lambda 함수 코드 업데이트 중...');
    await lambda.updateFunctionCode(codeParams).promise();

    // 설정 업데이트
    const configParams = {
        FunctionName: functionName,
        Handler: 'fitbitDataCleaner.handler',
        Role: roleArn,
        Runtime: 'nodejs16.x',
        Description: 'Fitbit 데이터 자동 정리 함수',
        Timeout: 60,
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

    console.log('Lambda 함수 설정 업데이트 중...');
    return lambda.updateFunctionConfiguration(configParams).promise();
}

// EventBridge 규칙 생성 (매일 자정에 실행)
async function createEventRule() {
    const eventBridge = new AWS.EventBridge();

    // 규칙 생성
    const ruleParams = {
        Name: `${functionName}-DailyTrigger`,
        ScheduleExpression: 'cron(0 0 * * ? *)', // 매일 자정 (UTC)
        State: 'ENABLED',
        Description: 'Fitbit 데이터 정리 함수를 매일 자정에 실행'
    };

    console.log('EventBridge 규칙 생성 중...');
    await eventBridge.putRule(ruleParams).promise();

    // 대상 연결
    const targetParams = {
        Rule: `${functionName}-DailyTrigger`,
        Targets: [
            {
                Id: '1',
                Arn: `arn:aws:lambda:${AWS.config.region}:${process.env.AWS_ACCOUNT_ID}:function:${functionName}`,
                Input: JSON.stringify({
                    body: JSON.stringify({
                        intraday_retention_days: 30,
                        average_retention_days: 365,
                        dry_run: false
                    })
                })
            }
        ]
    };

    console.log('EventBridge 대상 설정 중...');
    return eventBridge.putTargets(targetParams).promise();
}

// Lambda 함수에 EventBridge 권한 부여
async function addPermission() {
    const permissionParams = {
        Action: 'lambda:InvokeFunction',
        FunctionName: functionName,
        Principal: 'events.amazonaws.com',
        SourceArn: `arn:aws:events:${AWS.config.region}:${process.env.AWS_ACCOUNT_ID}:rule/${functionName}-DailyTrigger`,
        StatementId: `${functionName}-EventBridge-${Date.now()}`
    };

    console.log('Lambda 함수에 EventBridge 권한 부여 중...');
    return lambda.addPermission(permissionParams).promise();
}

// 배포 실행
async function deploy() {
    try {
        // ZIP 파일 생성
        const zipFilePath = await createZipFile();

        // 함수 존재 여부 확인
        const functionExists = await checkFunctionExists();

        if (functionExists) {
            // 함수 업데이트
            await updateFunction(zipFilePath);
            console.log(`Lambda 함수 '${functionName}' 업데이트 완료`);
        } else {
            // 함수 생성
            await createFunction(zipFilePath);
            console.log(`Lambda 함수 '${functionName}' 생성 완료`);
        }

        // EventBridge 규칙 생성 및 권한 부여 (선택적)
        const setupSchedule = process.argv.includes('--schedule');
        if (setupSchedule) {
            await createEventRule();
            await addPermission();
            console.log('스케줄 설정 완료 (매일 자정 실행)');
        }

        // 임시 ZIP 파일 정리
        fs.unlinkSync(zipFilePath);
        console.log('임시 파일 정리 완료');

        console.log('배포가 성공적으로 완료되었습니다');
    } catch (error) {
        console.error('배포 중 오류 발생:', error);
    }
}

// 실행
deploy(); 