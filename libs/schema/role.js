module.exports = {
  type: 'object',
  properties: {
    tenantId: {
      type: 'string',
      description: '所属租户 ID'
    },
    name: {
      type: 'string',
      description: '角色名称'
    },
    code: {
      type: 'string',
      description: '角色编码，系统角色 admin、default 有特殊含义'
    },
    description: {
      type: 'string',
      default: '',
      description: '角色描述'
    },
    status: {
      type: 'string',
      enum: ['open', 'closed'],
      default: 'open',
      description: '角色状态：open 开启，closed 关闭'
    },
    type: {
      type: 'string',
      enum: ['system', 'custom'],
      default: 'custom',
      description: '角色类型：system 系统角色（不可编辑删除），custom 自定义角色'
    },
    options: {
      type: 'object',
      description: '角色扩展字段'
    },
    createdTenantUserId: {
      type: 'string',
      description: '创建人（租户用户 ID）'
    }
  },
  required: ['name', 'code']
};
