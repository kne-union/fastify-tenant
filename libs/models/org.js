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
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        comment: '状态:开启，关闭',
        defaultValue: 'open'
      },
      synced: {
        type: DataTypes.BOOLEAN,
        comment: '是否通过同步进入系统',
        defaultValue: false
      },
      syncSource: {
        type: DataTypes.STRING,
        comment: '同步源标识',
        allowNull: true
      },
      sourceId: {
        type: DataTypes.STRING,
        comment: '同步源中的原始ID',
        allowNull: true
      },
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
      comment: '租户组织',
      indexes: [
        {
          fields: ['tenant_id', 'sync_source', 'source_id'],
          unique: true,
          where: {
            deleted_at: null,
            synced: true
          }
        }
      ]
    }
  };
};
