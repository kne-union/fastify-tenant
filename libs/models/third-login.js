module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      type: {
        type: DataTypes.STRING,
        comment: '第三方登录渠道类型'
      },
      config: {
        type: DataTypes.JSONB,
        comment: '第三方登录配置',
        defaultValue: {}
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ thirdLogin, tenant }) => {
      thirdLogin.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '第三方登录配置',
      indexes: [
        {
          fields: ['tenant_id', 'type'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
