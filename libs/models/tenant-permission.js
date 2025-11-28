module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      code: {
        type: DataTypes.STRING,
        comment: '权限编码',
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('permission', 'module'),
        comment: '权限类型',
        allowNull: false
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ tenantPermission, tenant }) => {
      tenantPermission.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '租户权限设置',
      indexes: [
        {
          name: 'tenant_permission_code_key',
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
