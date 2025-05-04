-- Event Scheduler 활성화
SET GLOBAL event_scheduler = ON;
SET time_zone = '+09:00';

-- 기기 데이터 자동 삭제 (1일)
CREATE EVENT IF NOT EXISTS delete_old_device_data
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM fitbit_devices WHERE last_sync_time < DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 1 DAY);

-- 운동 데이터 자동 삭제 (7일)
CREATE EVENT IF NOT EXISTS delete_old_activity_data
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM fitbit_activity_data WHERE created_at < DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 7 DAY);

-- 건강 데이터 자동 삭제 (7일)
CREATE EVENT IF NOT EXISTS delete_old_health_data
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM fitbit_activity_summary WHERE date < DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 7 DAY);
  DELETE FROM fitbit_health_metrics WHERE date < DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 7 DAY);
END;

-- 수면 데이터 자동 삭제 (7일)
CREATE EVENT IF NOT EXISTS delete_old_sleep_data
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM fitbit_sleep_data WHERE session_start < DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 7 DAY);

-- 평균 데이터 자동 삭제 (30일)
CREATE EVENT IF NOT EXISTS delete_old_average_data
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM fitbit_average WHERE date < DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 30 DAY);

-- 일일 평균 데이터 계산 및 저장 (매일 자정)
DELIMITER //
CREATE EVENT IF NOT EXISTS calculate_daily_averages
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
DO
BEGIN
    -- 활동 데이터 평균 계산
    INSERT INTO fitbit_average (user_id, metric_type, period, avg_value, date)
    SELECT
        user_id,
        'steps' as metric_type,
        '1D' as period,
        AVG(steps) as avg_value,
        CURDATE() as date
    FROM fitbit_activity_data
    WHERE created_at >= DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 1 DAY)
    GROUP BY user_id
    UNION ALL
    SELECT
        user_id,
        'steps',
        '7D',
        AVG(steps),
        CURDATE()
    FROM fitbit_activity_data
    WHERE created_at >= DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 7 DAY)
    GROUP BY user_id;
    -- 나머지 기간(30D, 90D, 180D, 365D)도 같은 방식으로 추가

    -- 건강 지표 평균 계산
    INSERT INTO fitbit_average (user_id, metric_type, period, avg_value, date)
    SELECT
        user_id,
        'stress_score' as metric_type,
        '7D' as period,
        AVG(stress_score) as avg_value,
        CURDATE() as date
    FROM fitbit_health_metrics
    WHERE date >= DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 7 DAY)
    GROUP BY user_id;
    -- 나머지 지표와 기간도 같은 방식으로 추가

    -- 수면 데이터 평균 계산
    INSERT INTO fitbit_average (user_id, metric_type, period, avg_value, date)
    SELECT
        user_id,
        'total_sleep_hours' as metric_type,
        '7D' as period,
        AVG(total_sleep_hours) as avg_value,
        CURDATE() as date
    FROM fitbit_sleep_data
    WHERE session_start >= DATE_SUB(CONVERT_TZ(NOW(), 'UTC', '+09:00'), INTERVAL 7 DAY)
    GROUP BY user_id;
    -- 나머지 지표와 기간도 같은 방식으로 추가
END //
DELIMITER ;

-- 월간 평균 데이터 백업 (매월 1일)
CREATE EVENT IF NOT EXISTS backup_monthly_averages
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP + INTERVAL 1 MONTH
DO
  INSERT INTO fitbit_average_history (user_id, metric_type, period, avg_value, backup_date)
  SELECT user_id, metric_type, period, avg_value, CONVERT_TZ(NOW(), 'UTC', '+09:00')
  FROM fitbit_average
  WHERE period IN ('30D', '90D', '180D', '365D');
