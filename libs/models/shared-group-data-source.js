module.exports = ({ DataTypes, definePrimaryType }) => {
  return {
    model: {
      sharedGroupId: definePrimaryType('sharedGroupId', {
        allowNull: false,
        comment: '共享组 ID'
      }),
      tenantUserId: definePrimaryType('tenantUserId', {
        allowNull: false,
        comment: '数据来源租户用户 ID'
      })
    },
    associate: ({ sharedGroupDataSource, sharedGroup, user }) => {
      sharedGroupDataSource.belongsTo(sharedGroup, {
        allowNull: false,
        foreignKey: 'sharedGroupId',
        onDelete: 'CASCADE'
      });
      sharedGroupDataSource.belongsTo(user, {
        foreignKey: 'tenantUserId',
        allowNull: false,
        constraints: true,
        comment: '数据来源租户用户'
      });
    },
    options: {
      comment: '共享组数据来源（多对多关联表）',
      indexes: [
        {
          fields: ['shared_group_id', 'tenant_user_id'],
          unique: true,
          where: {
            deleted_at: null
          },
          name: 'shared_group_data_source_group_user_uidx'
        },
        {
          fields: ['tenant_user_id'],
          name: 'shared_group_data_source_tenant_user_id_idx'
        }
      ]
    }
  };
};
