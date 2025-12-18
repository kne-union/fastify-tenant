module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      avatar: {
        type: DataTypes.STRING,
        comment: '头像'
      },
      name: {
        type: DataTypes.STRING,
        comment: '姓名'
      },
      gender: {
        type: DataTypes.ENUM('F', 'M'),
        comment: '性别'
      },
      email: {
        type: DataTypes.STRING,
        comment: '邮箱'
      },
      phone: {
        type: DataTypes.STRING,
        comment: '手机号'
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
      roles: {
        type: DataTypes.JSONB,
        comment: '角色',
        defaultValue: []
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ user: tenantUser, tenant, org }) => {
      tenantUser.belongsTo(options.getUserModel());
      tenantUser.belongsTo(tenant, {
        allowNull: false
      });
      tenantUser.belongsTo(org);
    },
    options: {
      comment: '租户用户',
      indexes: [
        {
          fields: ['tenant_id', 'user_id'],
          unique: true,
          where: {
            deleted_at: null
          }
        },
        {
          fields: ['tenant_id', 'email'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
