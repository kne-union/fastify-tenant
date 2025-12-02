module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ userDefault: tenantUserDefault, tenant }) => {
      tenantUserDefault.belongsTo(options.getUserModel(), {
        allowNull: false
      });
      tenantUserDefault.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '用户默认租户设置',
      indexes: [
        {
          fields: ['user_id', 'tenant_id'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
