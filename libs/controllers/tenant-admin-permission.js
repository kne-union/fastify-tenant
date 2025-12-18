const fp = require('fastify-plugin');
const merge = require('lodash/merge');
const roleSchema = require('../schema/role');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();
  const adminAuthenticate = options.getAdminUserAuthenticate();

  fastify.post(
    `${options.prefix}/admin/role/create`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '创建租户角色',
        body: merge({}, roleSchema, {
          required: ['tenantId']
        })
      }
    },
    async request => {
      return await services.role.create(request.body);
    }
  );

  fastify.get(
    `${options.prefix}/admin/role/list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '租户角色列表',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            filter: {
              type: 'object',
              default: {}
            },
            perPage: {
              type: 'number',
              default: 20
            },
            currentPage: {
              type: 'number',
              default: 1
            }
          },
          required: ['tenantId']
        }
      }
    },
    async request => {
      return await services.role.list(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/role/remove`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '删除租户角色',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            id: {
              type: 'string'
            }
          },
          required: ['tenantId', 'id']
        }
      }
    },
    async request => {
      await services.role.remove(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/role/set-status`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '修改租户角色状态',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            id: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['open', 'closed']
            }
          },
          required: ['tenantId', 'id', 'status']
        }
      }
    },
    async request => {
      await services.role.setStatus(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/role/save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '编辑租户角色',
        body: merge({}, roleSchema, {
          required: ['id', 'tenantId']
        })
      }
    },
    async request => {
      return await services.role.save(request.body);
    }
  );

  fastify.get(
    `${options.prefix}/admin/role/permission-list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '租户角色权限列表',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            id: {
              type: 'string'
            }
          },
          required: ['tenantId', 'id']
        }
      }
    },
    async request => {
      return await services.role.permissionList(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/role/save-permission`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '保存租户角色权限',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            id: {
              type: 'string'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: []
            }
          },
          required: ['tenantId', 'id', 'permissions']
        }
      }
    },
    async request => {
      await services.role.savePermission(request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/admin/permission/list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '租户权限列表',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            }
          },
          required: ['tenantId']
        }
      }
    },
    async request => {
      return await services.permission.list(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/permission/save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '保存租户权限',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: []
            }
          },
          required: ['tenantId', 'permissions']
        }
      }
    },
    async request => {
      await services.permission.save(request.body);
      return {};
    }
  );
});
