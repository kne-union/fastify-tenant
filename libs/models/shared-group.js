module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        comment: '共享组名称'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '说明'
      },
      sharedModules: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '共享模块列表 [{ moduleCode, access }]，access 为 read | write'
      },
      createdTenantUserId: definePrimaryType('createdTenantUserId', {
        allowNull: true,
        comment: '创建人（租户用户 ID）'
      }),
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        comment: '状态',
        defaultValue: 'open'
      },
      options: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段'
      }
    },
    associate: ({ sharedGroup, tenant, user, sharedGroupDataSource, sharedGroupMember }) => {
      sharedGroup.belongsTo(tenant, {
        allowNull: false
      });
      sharedGroup.belongsTo(user, {
        foreignKey: 'createdTenantUserId',
        constraints: false,
        comment: '创建人（租户用户）'
      });
      sharedGroup.hasMany(sharedGroupDataSource, {
        foreignKey: 'sharedGroupId',
        as: 'dataSources'
      });
      sharedGroup.hasMany(sharedGroupMember, {
        foreignKey: 'sharedGroupId',
        as: 'members'
      });
    },
    options: {
      comment: '共享组',
      indexes: [
        {
          fields: ['tenant_id'],
          name: 'shared_group_tenant_id_idx'
        }
      ]
    }
  };
};
