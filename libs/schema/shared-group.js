module.exports = {
  type: 'object',
  properties: {
    tenantId: {
      type: 'string',
      description: '所属租户 ID'
    },
    id: {
      type: 'string',
      description: '共享组 ID，编辑时必传'
    },
    name: {
      type: 'string',
      description: '共享组名称'
    },
    description: {
      type: 'string',
      description: '共享组说明'
    },
    sharedModules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          moduleCode: { type: 'string', description: '共享的权限模块编码' },
          access: { type: 'string', enum: ['read', 'write'], description: '共享权限：read 只读，write 可写' }
        },
        required: ['moduleCode', 'access']
      },
      default: [],
      description: '共享模块列表'
    },
    dataSourceTenantUserIds: {
      type: 'array',
      items: { type: 'string' },
      default: [],
      description: '数据来源租户用户 ID 列表：这些用户的数据会共享给共享组成员'
    },
    memberTenantUserIds: {
      type: 'array',
      items: { type: 'string' },
      default: [],
      description: '共享组成员租户用户 ID 列表：可查看数据来源用户的数据'
    },
    status: {
      type: 'string',
      enum: ['open', 'closed'],
      description: '共享组状态：open 开启，closed 关闭'
    },
    options: {
      type: 'object',
      description: '共享组扩展字段'
    }
  }
};
