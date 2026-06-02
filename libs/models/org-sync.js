module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      type: {
        type: DataTypes.STRING,
        comment: '同步源类型'
      },
      config: {
        type: DataTypes.JSONB,
        comment: '同步配置',
        defaultValue: {}
      },
      status: {
        type: DataTypes.ENUM('pending', 'running', 'success', 'failed'),
        comment: '同步状态',
        defaultValue: 'pending'
      },
      lastSyncAt: {
        type: DataTypes.DATE,
        comment: '最后同步时间'
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ orgSync, tenant }) => {
      orgSync.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '组织同步记录'
    }
  };
};
