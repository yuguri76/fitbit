const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'mysql',
  logging: false
});

const DeviceData = sequelize.define('DeviceData', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fitbit_user_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  device_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  device_version: {
    type: DataTypes.STRING,
    allowNull: true
  },
  battery: {
    type: DataTypes.STRING,
    allowNull: true
  },
  battery_level: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  last_sync_time: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

const IntradayData = sequelize.define('IntradayData', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fitbit_user_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  data_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  value: {
    type: DataTypes.FLOAT,
    allowNull: false
  }
});

const FitbitToken = sequelize.define('FitbitToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fitbit_user_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  token_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expires_in: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

const HealthMetrics = sequelize.define('HealthMetrics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fitbit_user_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  resting_heart_rate: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  vo2_max: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  breathing_rate: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  heart_rate_variability: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  temperature_core: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  temperature_skin: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  spo2: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

const Activities = sequelize.define('Activities', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fitbit_user_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  calories_burned: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  steps: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  active_minutes: {
    type: DataTypes.JSON,
    allowNull: true
  },
  activity_calories: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

const FitbitAverage = sequelize.define('Fitbit_average', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  recorded_at: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  period_type: {
    type: DataTypes.ENUM('1D', '7D', '30D', '90D', '180D', '365D'),
    allowNull: false
  },
  avg_steps: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  avg_calories_total: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_distance_km: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_heart_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_resting_heart_rate: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  avg_activity_duration: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sedentary_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  avg_lightly_active_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  avg_fairly_active_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  avg_very_active_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  avg_total_sleep_hours: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  avg_deep_sleep_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_light_sleep_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_rem_sleep_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_awake_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sleep_heart_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sleep_breathing_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_spo2: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_hrv: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_rhr: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_respiratory_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_skin_temperature: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_stress_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_readiness_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sleep_score: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
    onUpdate: Sequelize.NOW
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'recorded_at', 'period_type']
    }
  ]
});

// 장기평균 테이블 모델 (30일~평생)
const FitbitLongTermAverage = sequelize.define('Fitbit_long_term_average', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // 평균값 필드 (단기평균과 동일한 필드들)
  avg_steps: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_calories_total: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_distance_km: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_heart_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_resting_heart_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_activity_duration: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sedentary_minutes: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_lightly_active_minutes: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_fairly_active_minutes: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_very_active_minutes: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_total_sleep_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_deep_sleep_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_light_sleep_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_rem_sleep_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_awake_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sleep_heart_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sleep_breathing_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_spo2: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_hrv: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_rhr: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_respiratory_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_skin_temperature: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_stress_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_readiness_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  avg_sleep_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  // 장기평균 관련 추가 필드
  month_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '누적된 월 데이터 개수'
  },
  latest_month: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '마지막으로 반영된 월 데이터 날짜'
  },
  source_month: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '이 레코드의 소스가 된 월 데이터 날짜 (월별 기록용)'
  },
  is_monthly_record: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '단일 월 기록 여부 (true: 월별 기록, false: 누적 평균)'
  },
  month_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '원본 월 데이터 JSON (월별 기록용)'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
    onUpdate: Sequelize.NOW
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'is_monthly_record', 'source_month'],
      where: {
        is_monthly_record: true
      }
    },
    {
      unique: true,
      fields: ['user_id'],
      where: {
        is_monthly_record: false
      }
    }
  ]
});

module.exports = {
  DeviceData,
  IntradayData,
  FitbitToken,
  HealthMetrics,
  Activities,
  FitbitAverage,
  FitbitLongTermAverage
};
