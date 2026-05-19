module.exports = {
  type: 'object',
  properties: {
    id: {
      type: 'string'
    },
    tenantId: {
      type: 'string'
    },
    name: {
      type: 'string'
    },
    tenantOrgId: {
      type: ['string', 'null'],
      default: null,
      description: '主组织（兼容），通常取 tenantOrgIds 第一项'
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
      default: []
    },
    avatar: {
      type: 'string',
      default: ''
    },
    email: {
      type: ['string', 'null'],
      default: null
    },
    phone: {
      type: 'string',
      default: ''
    },
    description: {
      type: 'string',
      default: ''
    }
  },
  required: ['tenantId', 'name']
};
