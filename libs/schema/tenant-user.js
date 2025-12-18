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
      default: null
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
