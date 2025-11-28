module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        comment: '名称'
      },
      code: {
        type: DataTypes.STRING,
        comment: '编码'
      },
      type: {
        type: DataTypes.ENUM('system', 'custom'),
        comment: '类型',
        defaultValue: 'custom'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        comment: '状态',
        defaultValue: 'open'
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ role, tenant, user }) => {
      role.belongsTo(tenant, {
        allowNull: false
      });
      role.belongsTo(user, {
        foreignKey: 'createdTenantUserId'
      });
    },
    options: {
      comment: '角色',
      indexes: [
        {
          name: 'tenant_role_code_key',
          fields: ['tenant_id', 'code'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
