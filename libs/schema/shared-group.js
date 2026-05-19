module.exports = {
  type: 'object',
  properties: {
    tenantId: {
      type: 'string'
    },
    id: {
      type: 'string'
    },
    name: {
      type: 'string'
    },
    description: {
      type: 'string'
    },
    sharedModules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          moduleCode: { type: 'string' },
          access: { type: 'string', enum: ['read', 'write'] }
        },
        required: ['moduleCode', 'access']
      },
      default: []
    },
    dataSourceTenantUserIds: {
      type: 'array',
      items: { type: 'string' },
      default: []
    },
    memberTenantUserIds: {
      type: 'array',
      items: { type: 'string' },
      default: []
    },
    status: {
      type: 'string',
      enum: ['open', 'closed']
    },
    options: {
      type: 'object'
    }
  }
};
