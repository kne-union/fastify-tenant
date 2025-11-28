module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        comment: '名称'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      index: {
        type: DataTypes.INTEGER,
        comment: '排序',
        defaultValue: 0
      },
      parentId: definePrimaryType('parentId', {
        comment: '父级ID'
      }),
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ org, tenant }) => {
      org.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '租户组织'
    }
  };
};
