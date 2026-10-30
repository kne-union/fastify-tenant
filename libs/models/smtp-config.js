module.exports = ({ DataTypes }) => {
  return {
    model: {
      enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否启用租户 SMTP，关闭后使用系统邮箱发送'
      },
      host: {
        type: DataTypes.STRING,
        comment: 'SMTP 服务器地址'
      },
      port: {
        type: DataTypes.INTEGER,
        defaultValue: 465,
        comment: 'SMTP 端口'
      },
      secure: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否使用 SSL/TLS'
      },
      user: {
        type: DataTypes.STRING,
        comment: 'SMTP 账号'
      },
      pass: {
        type: DataTypes.STRING,
        comment: 'SMTP 密码 / 授权码（不通过 API 返回）'
      },
      fromName: {
        type: DataTypes.STRING,
        comment: '发件人名称'
      },
      fromAddress: {
        type: DataTypes.STRING,
        comment: '发件人地址，为空时使用 SMTP 账号'
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ smtpConfig, tenant }) => {
      smtpConfig.belongsTo(tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '租户 SMTP 配置',
      indexes: [
        {
          fields: ['tenant_id']
        }
      ]
    }
  };
};
