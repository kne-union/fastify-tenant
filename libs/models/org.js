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
      leaderUserId: definePrimaryType('leaderUserId', {
        comment: '部门负责人（租户用户ID）',
        allowNull: true
      }),
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ org, tenant, user }) => {
      org.belongsTo(tenant, {
        allowNull: false
      });
      org.belongsTo(user, {
        foreignKey: 'leaderUserId',
        as: 'leader',
        constraints: false,
        comment: '部门负责人（租户用户ID）'
      });
    },
    options: {
      comment: '租户组织'
    }
  };
};
