module.exports = ({ DataTypes, options }) => {
  return {
    model: {},
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
          name: 'tenant_user_default_key',
          fields: ['user_id', 'tenant_id', 'deleted_at'],
          unique: true
        }
      ]
    }
  };
};
