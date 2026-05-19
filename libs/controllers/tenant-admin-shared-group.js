const fp = require('fastify-plugin');
const merge = require('lodash/merge');
const sharedGroupSchema = require('../schema/shared-group');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();
  const adminAuthenticate = options.getAdminUserAuthenticate();

  fastify.get(
    `${options.prefix}/admin/shared-group/list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '租户共享组列表',
        query: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            filter: { type: 'object', default: {} },
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 }
          },
          required: ['tenantId']
        }
      }
    },
    async request => {
      return services.sharedGroup.list(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/shared-group/create`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '创建租户共享组',
        body: merge({}, sharedGroupSchema, {
          required: ['tenantId', 'name']
        })
      }
    },
    async request => {
      return services.sharedGroup.create(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/admin/shared-group/save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '编辑租户共享组',
        body: merge({}, sharedGroupSchema, {
          required: ['tenantId', 'id']
        })
      }
    },
    async request => {
      return services.sharedGroup.save(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/admin/shared-group/set-status`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '修改租户共享组状态',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string', enum: ['open', 'closed'] }
          },
          required: ['tenantId', 'id', 'status']
        }
      }
    },
    async request => {
      await services.sharedGroup.setStatus(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/shared-group/remove`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '删除租户共享组',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            id: { type: 'string' }
          },
          required: ['tenantId', 'id']
        }
      }
    },
    async request => {
      await services.sharedGroup.remove(request.body);
      return {};
    }
  );
});
