module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        comment: '名称'
      },
      fullName: {
        type: DataTypes.STRING,
        comment: '全称'
      },
      website: {
        type: DataTypes.STRING,
        comment: '主页'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      banners: {
        type: DataTypes.JSON,
        comment: 'banner图片列表',
        defaultValue: []
      },
      teamDescription: {
        type: DataTypes.JSON,
        comment: '团队介绍'
      },
      developmentHistory: {
        type: DataTypes.JSON,
        comment: '发展历程'
      },
      contact: {
        type: DataTypes.JSON,
        comment: '联系方式'
      },
      options: {
        type: DataTypes.JSONB,
        comment: '扩展字段'
      }
    },
    associate: ({ company, tenant }) => {
      company.belongsTo(tenant, {
        foreignKey: 'tenantId',
        allowNull: false
      });
    },
    options: {
      comment: '公司信息'
    }
  };
};
