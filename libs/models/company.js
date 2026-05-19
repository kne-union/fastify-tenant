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
      logo: {
        type: DataTypes.STRING,
        comment: 'Logo'
      },
      industry: {
        type: DataTypes.STRING,
        comment: '行业'
      },
      scale: {
        type: DataTypes.STRING,
        comment: '规模'
      },
      address: {
        type: DataTypes.STRING,
        comment: '地址'
      },
      phone: {
        type: DataTypes.STRING,
        comment: '电话'
      },
      email: {
        type: DataTypes.STRING,
        comment: '邮箱'
      },
      foundedDate: {
        type: DataTypes.DATEONLY,
        comment: '成立日期'
      },
      companyTags: {
        type: DataTypes.JSON,
        comment: '公司标签',
        defaultValue: []
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
        allowNull: false
      });
    },
    options: {
      comment: '公司信息'
    }
  };
};
