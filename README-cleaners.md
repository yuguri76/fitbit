# Fitbit 데이터 정리 Lambda 함수

이 문서는 Fitbit 데이터를 자동으로 정리하는 Lambda 함수들에 대한 가이드입니다.

## 개요

이 프로젝트에는 다음과 같은 두 가지 데이터 정리 함수가 포함되어 있습니다:

1. **원시 데이터 정리 함수 (fitbitShortTermCleaner)**
   - 수집 테이블(raw_heartrate, raw_steps, raw_sleep)에서 생성된 지 일주일이 지난 로우 데이터를 삭제합니다.
   - 기본적으로 매일 새벽 1시(UTC)에 실행됩니다.

2. **단기 평균 데이터 정리 함수 (fitbitAverageCleaner)**
   - 단기 평균 테이블(fitbit_average)에서 생성된 지 30일이 지난 모든 데이터를 삭제합니다.
   - 장기 평균 테이블에 데이터가 이미 반영되어 있으므로, 원본 데이터 손실 없이 자유롭게 삭제 가능합니다.
   - 기본적으로 매일 새벽 2시(UTC)에 실행됩니다.

## 로컬 테스트 방법

### 원시 데이터 정리 함수 테스트

```bash
node src/scripts/testRawDataCleaner.js
```

### 단기 평균 데이터 정리 함수 테스트

```bash
node src/scripts/testAverageCleaner.js
```

각 테스트 스크립트는 기본적으로 드라이 런(dry run) 모드로 실행되어 실제 데이터를 삭제하지 않고 어떤 데이터가 삭제될지 확인합니다.

## AWS Lambda 배포 방법

### 사전 준비

1. AWS 계정과 적절한 권한이 있는 IAM 사용자가 필요합니다.
2. `.env` 파일에 다음 환경 변수를 설정해야 합니다:

```
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-northeast-2 (또는 원하는 리전)
AWS_ACCOUNT_ID=your_aws_account_id
AWS_LAMBDA_ROLE_ARN=arn:aws:iam::your_aws_account_id:role/your_lambda_execution_role
```

### 배포 명령어

```bash
# Lambda 함수만 배포
node src/scripts/deployCleaners.js

# Lambda 함수 배포 및 EventBridge 스케줄 설정
node src/scripts/deployCleaners.js --schedule
```

## 함수 매개변수

각 Lambda 함수는 다음과 같은 매개변수를 받을 수 있습니다:

### 원시 데이터 정리 함수

```json
{
  "retention_days": 7,  // 보존할 일수 (기본값: 7)
  "dry_run": false      // true로 설정하면 삭제 작업을 시뮬레이션만 함 (기본값: false)
}
```

### 단기 평균 데이터 정리 함수

```json
{
  "retention_days": 30, // 보존할 일수 (기본값: 30)
  "dry_run": false      // true로 설정하면 삭제 작업을 시뮬레이션만 함 (기본값: false)
}
```

## 주의사항

- 실제 운영 환경에서는 데이터 삭제 작업 전에 항상 백업을 확인하세요.
- 초기 테스트 시 `dry_run: true` 옵션을 사용하여 어떤 데이터가 삭제될지 확인하는 것이 좋습니다.
- 데이터 보존 정책은 프로젝트 요구사항에 맞게 조정할 수 있습니다. 