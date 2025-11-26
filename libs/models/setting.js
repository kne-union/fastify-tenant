module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      args: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '租户环境变量'
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
