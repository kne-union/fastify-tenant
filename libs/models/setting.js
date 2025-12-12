module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      args: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '租户环境变量'
      },
      secrets: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '租户密钥'
      },
      customComponents: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '租户自定义组件'
      },
      options: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '租户配置项'
      }
    },
    associate: ({ setting, tenant }) => {
      setting.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '租户设置',
      indexes: []
    }
  };
};
