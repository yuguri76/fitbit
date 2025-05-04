# 사용 가능한 API 엔드포인트:

## 프로필 조회
```
GET /api/fitbit/profile/:userId
```

## 활동 데이터
```
GET /api/fitbit/activity/:userId/:date
```

## 심박수 데이터
```
GET /api/fitbit/heartrate/:userId/:date
```

## 수면 데이터
```
GET /api/fitbit/sleep/:userId/:date
```

## 전체 데이터
```
GET /api/fitbit/all-data/:userId/:date
```
모든 Fitbit 데이터를 한 번에 조회합니다 (기기 정보, 활동 데이터, 건강 지표, 수면 데이터)

## 인트라데이(intraday) 데이터 제외 전체 데이터
```
GET /api/fitbit/non-intraday-data/:userId/:date
```
인트라데이(1분 간격) 데이터를 제외한 모든 Fitbit 데이터를 조회합니다.

## 인트라데이(intraday) 데이터만 조회
```
GET /api/fitbit/intraday-data/:userId/:date
```
1분 간격의 상세 활동 데이터만 조회합니다. 심박수, 걸음 수, 거리, 칼로리, 층수 등의 인트라데이 데이터가 포함됩니다.

## 인트라데이(intraday) 데이터 포함 전체 데이터
```
GET /api/fitbit/complete-with-intraday/:userId/:date
```
인트라데이(1분 간격) 데이터를 포함한 모든 Fitbit 데이터를 조회합니다. 대량의 데이터가 포함되어 있으므로 주의가 필요합니다.

#### 파라미터
- `userId`: 사용자 ID
- `date`: 조회할 날짜 (YYYY-MM-DD 형식)

#### 응답 데이터

```json
{
    "deviceInfo": {
        "device_id": "string",
        "device_version": "string",
        "battery_level": "string",
        "battery_status": "string",
        "last_sync_time": "timestamp"
    },
    "activityData": {
        "steps": "number",
        "heart_rate": "number",
        "calories_burned": "number",
        "fairly_active_minutes": "number",
        "very_active_minutes": "number",
        "lightly_active_minutes": "number"
    },
    "healthMetrics": {
        "spo2": "number",
        "hrv": "number",
        "rhr": "number",
        "respiratory_rate": "number",
        "skin_temperature": "number",
        "blood_glucose": "number",
        "blood_pressure_systolic": "number",
        "blood_pressure_diastolic": "number",
        "stress_score": "number",
        "readiness_score": "number"
    },
    "sleepData": {
        "session_start": "datetime",
        "session_end": "datetime",
        "total_sleep_hours": "number",
        "deep_sleep_hours": "number",
        "light_sleep_hours": "number",
        "rem_sleep_hours": "number",
        "awake_hours": "number",
        "avg_heart_rate": "number",
        "avg_breathing_rate": "number",
        "avg_spo2": "number",
        "stress_score": "number",
        "overall_health_score": "number",
        "is_main_sleep": "boolean"
    }
}
```

#### 예시 요청
```
GET /api/fitbit/all-data/CB2P35/2024-03-19
```

#### 주의사항
1. 일부 데이터는 Fitbit Premium 구독이 필요할 수 있습니다.
2. 데이터가 없는 경우 해당 필드는 `null`로 반환됩니다.
3. 날짜는 반드시 `YYYY-MM-DD` 형식으로 입력해야 합니다.
4. 미래 날짜에 대한 데이터는 조회할 수 없습니다. 