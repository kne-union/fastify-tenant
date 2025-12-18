const fp = require('fastify-plugin');
const merge = require('lodash/merge');
const roleSchema = require('../schema/role');

module.exports = fp(async (fastify, options) => {
  const { services, authenticate } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();

  fastify.post(
    `${options.prefix}/role/create`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '创建租户角色',
        body: merge({}, roleSchema)
      }
    },
    async request => {
      return await services.role.create(Object.assign({}, request.body, { tenantId: request.tenantUserInfo.tenantId }));
    }
  );

  fastify.get(
    `${options.prefix}/role/list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '租户角色列表',
        query: {
          type: 'object',
          properties: {
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
          }
        }
      }
    },
    async request => {
      return await services.role.list(Object.assign({}, request.query, { tenantId: request.tenantUserInfo.tenantId }));
    }
  );

  fastify.post(
    `${options.prefix}/role/remove`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '删除租户角色',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      await services.role.remove(Object.assign({}, request.body, { tenantId: request.tenantUserInfo.tenantId }));
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/role/set-status`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '修改租户角色状态',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['open', 'closed']
            }
          },
          required: ['id', 'status']
        }
      }
    },
    async request => {
      await services.role.setStatus(Object.assign({}, request.body, { tenantId: request.tenantUserInfo.tenantId }));
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/role/save`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '编辑租户角色',
        body: merge({}, roleSchema, {
          required: ['id']
        })
      }
    },
    async request => {
      return await services.role.save(Object.assign({}, request.body, { tenantId: request.tenantUserInfo.tenantId }));
    }
  );

  fastify.get(
    `${options.prefix}/role/permission-list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '租户角色权限列表',
        query: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return await services.role.permissionList(Object.assign({}, request.query, { tenantId: request.tenantUserInfo.tenantId }));
    }
  );

  fastify.post(
    `${options.prefix}/role/save-permission`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '保存租户角色权限',
        body: {
          type: 'object',
          properties: {
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
          required: ['id', 'permissions']
        }
      }
    },
    async request => {
      await services.role.savePermission(Object.assign({}, request.body, { tenantId: request.tenantUserInfo.tenantId }));
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/permission/list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '租户权限列表'
      }
    },
    async request => {
      return await services.permission.list({ tenantId: request.tenantUserInfo.tenantId });
    }
  );
});
