module.exports = {
  type: 'object',
  properties: {
    tenantId: {
      type: 'string'
    },
    name: {
      type: 'string'
    },
    code: {
      type: 'string'
    },
    description: {
      type: 'string',
      default: ''
    },
    status: {
      type: 'string',
      enum: ['open', 'closed'],
      default: 'open'
    },
    type: {
      type: 'string',
      enum: ['system', 'custom'],
      default: 'custom'
    },
    options: {
      type: 'object'
    },
    createdTenantUserId: {
      type: 'string'
    }
  },
  required: ['name', 'code']
};
