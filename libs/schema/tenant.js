module.exports = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: '租户名称'
    },
    status: {
      type: 'string',
      enum: ['open', 'closed'],
      description: '租户状态：open 开启，closed 关闭'
    },
    themeColor: {
      type: 'string',
      description: '租户主题色，如 #4183F0'
    },
    logo: {
      type: 'string',
      description: '租户 Logo 文件 ID'
    },
    accountCount: {
      type: 'number',
      description: '租户最大账号数量'
    },
    description: {
      type: 'string',
      description: '租户描述'
    },
    supportLanguage: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: '租户支持的系统语言列表，如 ["zh-CN", "en-US"]'
    },
    defaultLanguage: {
      type: 'string',
      description: '租户默认系统语言，需包含在 supportLanguage 中'
    },
    serviceStartTime: {
      type: 'string',
      description: '服务开始时间'
    },
    serviceEndTime: {
      type: 'string',
      description: '服务结束时间'
    }
  },
  required: ['name', 'themeColor', 'logo', 'serviceStartTime', 'serviceEndTime']
};
