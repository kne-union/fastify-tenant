module.exports = {
  type: 'object',
  properties: {
    name: {
      type: 'string'
    },
    status: {
      type: 'string',
      enum: ['open', 'closed']
    },
    themeColor: {
      type: 'string'
    },
    logo: {
      type: 'string'
    },
    accountCount: {
      type: 'number'
    },
    description: {
      type: 'string'
    },
    supportLanguage: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    defaultLanguage: {
      type: 'string'
    },
    serviceStartTime: {
      type: 'string'
    },
    serviceEndTime: {
      type: 'string'
    }
  },
  required: ['name', 'themeColor', 'logo', 'serviceStartTime', 'serviceEndTime']
};
