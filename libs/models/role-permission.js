module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      code: {
        type: DataTypes.STRING,
        comment: '权限编码'
      },
      type: {
        type: DataTypes.ENUM('permission', 'module'),
        comment: '权限类型'
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ role, user, rolePermission, tenant }) => {
      rolePermission.belongsTo(tenant, {
        allowNull: false
      });
      rolePermission.belongsTo(role, {
        allowNull: false
      });
      rolePermission.belongsTo(user, {
        foreignKey: 'createdUserId'
      });
    },
    options: {
      comment: '角色权限设置',
      indexes: [
        {
          fields: ['tenant_id', 'tenant_role_id', 'code'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
