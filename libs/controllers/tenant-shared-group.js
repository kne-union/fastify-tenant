const fp = require('fastify-plugin');
const merge = require('lodash/merge');
const sharedGroupSchema = require('../schema/shared-group');

module.exports = fp(async (fastify, options) => {
  const { services, authenticate } = fastify[options.name];
  const userAuthenticate = authenticate.user;

  fastify.get(
    `${options.prefix}/shared-group/list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '共享组列表',
        query: {
          type: 'object',
          properties: {
            filter: { type: 'object', default: {} },
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 }
          }
        }
      }
    },
    async request => {
      return services.sharedGroup.list(
        Object.assign({}, request.query, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/shared-group/create`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '创建共享组',
        body: merge({}, sharedGroupSchema, {
          required: ['name']
        })
      }
    },
    async request => {
      return services.sharedGroup.create(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId,
          createdTenantUserId: request.tenantUserInfo.id
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/shared-group/save`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '编辑共享组',
        body: merge({}, sharedGroupSchema, {
          required: ['id']
        })
      }
    },
    async request => {
      return services.sharedGroup.save(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/shared-group/set-status`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '修改共享组状态',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: ['open', 'closed'] }
          },
          required: ['id', 'status']
        }
      }
    },
    async request => {
      await services.sharedGroup.setStatus(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/shared-group/remove`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '删除共享组',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      }
    },
    async request => {
      await services.sharedGroup.remove(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );
});
