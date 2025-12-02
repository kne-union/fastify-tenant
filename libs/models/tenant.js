module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        comment: '租户名称'
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        comment: '状态:开启，关闭',
        defaultValue: 'open'
      },
      themeColor: {
        type: DataTypes.STRING,
        comment: '主题色'
      },
      logo: {
        type: DataTypes.STRING,
        comment: 'logo'
      },
      accountCount: {
        type: DataTypes.INTEGER,
        comment: '最大账号数量',
        defaultValue: 10
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      supportLanguage: {
        type: DataTypes.JSON,
        defaultValue: ['zh-CN', 'en-US']
      },
      defaultLanguage: {
        type: DataTypes.STRING,
        defaultValue: 'zh-CN'
      },
      serviceStartTime: {
        type: DataTypes.DATE,
        comment: '服务开始时间'
      },
      serviceEndTime: {
        type: DataTypes.DATE,
        comment: '服务结束时间'
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ company, setting, tenant }) => {
      tenant.hasOne(company);
      tenant.hasOne(setting);
    },
    options: {
      comment: '租户',
      indexes: [
        {
          fields: ['name'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
