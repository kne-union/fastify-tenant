module.exports = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: '租户用户 ID，编辑时必传'
    },
    tenantId: {
      type: 'string',
      description: '所属租户 ID'
    },
    name: {
      type: 'string',
      description: '租户用户姓名'
    },
    tenantOrgIds: {
      type: 'array',
      items: { type: 'string' },
      default: [],
      description: '所属组织 id 列表，可多选'
    },
    roles: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [],
      description: '角色 ID 列表'
    },
    avatar: {
      type: 'string',
      default: '',
      description: '头像文件 ID'
    },
    email: {
      type: ['string', 'null'],
      default: null,
      description: '邮箱，用于发送邀请消息'
    },
    phone: {
      type: 'string',
      default: '',
      description: '手机号，用于发送邀请消息'
    },
    description: {
      type: 'string',
      default: '',
      description: '用户描述'
    }
  },
  required: ['tenantId', 'name']
};
