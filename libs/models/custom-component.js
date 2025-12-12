module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      content: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '组件内容'
      },
      options: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展配置'
      }
    },
    associate: ({ customComponent, tenant }) => {
      customComponent.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '租户自定义组件'
    }
  };
};
