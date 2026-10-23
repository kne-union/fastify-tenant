const fp = require('fastify-plugin');
const toPartialSchema = require('../utils/toPartialSchema');
const sharedGroupSchema = require('../schema/shared-group');
const R = require('../schema/response');

module.exports = fp(async (fastify, options) => {
  const { services, authenticate } = fastify[options.name];
  const userAuthenticate = authenticate.user;

  fastify.get(
    `${options.prefix}/shared-group/list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-共享组'],
        summary: '共享组列表',
        description: '分页查询当前租户的共享组，含数据来源与成员',
        query: {
          type: 'object',
          properties: {
            filter: { type: 'object', default: {}, description: '筛选条件：keyword 按名称/说明模糊匹配，status 按状态（open / closed）' },
            perPage: { type: 'number', default: 20, description: '每页条数' },
            currentPage: { type: 'number', default: 1, description: '当前页码，从 1 开始' }
          }
        },
        response: R.success('共享组分页列表', R.pageResult('共享组', R.sharedGroup()))
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
        tags: ['租户-共享组'],
        summary: '创建共享组',
        description: '在当前租户下创建共享组，创建人为当前租户用户；tenantId 取自登录态，传入会被忽略',
        body: Object.assign({}, sharedGroupSchema, {
          required: ['name']
        }),
        response: R.success('创建后的共享组详情', R.sharedGroup())
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
        tags: ['租户-共享组'],
        summary: '编辑共享组',
        description: '编辑当前租户下的共享组；只更新传入的字段；dataSourceTenantUserIds / memberTenantUserIds / sharedModules 传入时整体覆盖，未传则保持不变',
        body: toPartialSchema(sharedGroupSchema, {
          required: ['id']
        }),
        response: R.success('编辑后的共享组详情', R.sharedGroup())
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
        tags: ['租户-共享组'],
        summary: '修改共享组状态',
        description: '开启或关闭共享组，关闭后不再参与数据权限合并',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '共享组 ID' },
            status: { type: 'string', enum: ['open', 'closed'], description: '目标状态：open 开启，closed 关闭' }
          },
          required: ['id', 'status']
        },
        response: R.empty()
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
        tags: ['租户-共享组'],
        summary: '删除共享组',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '要删除的共享组 ID' }
          },
          required: ['id']
        },
        response: R.empty()
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
