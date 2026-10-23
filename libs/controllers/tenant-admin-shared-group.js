const fp = require('fastify-plugin');
const toPartialSchema = require('../utils/toPartialSchema');
const sharedGroupSchema = require('../schema/shared-group');
const R = require('../schema/response');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();
  const adminAuthenticate = options.getAdminUserAuthenticate();

  fastify.get(
    `${options.prefix}/admin/shared-group/list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-共享组'],
        summary: '租户共享组列表',
        description: '管理员分页查询指定租户的共享组，含数据来源与成员',
        query: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', description: '租户 ID' },
            filter: { type: 'object', default: {}, description: '筛选条件：keyword 按名称/说明模糊匹配，status 按状态（open / closed）' },
            perPage: { type: 'number', default: 20, description: '每页条数' },
            currentPage: { type: 'number', default: 1, description: '当前页码，从 1 开始' }
          },
          required: ['tenantId']
        },
        response: R.success('共享组分页列表', R.pageResult('共享组', R.sharedGroup()))
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
        tags: ['租户管理后台-共享组'],
        summary: '创建租户共享组',
        description: '管理员在指定租户下创建共享组',
        body: Object.assign({}, sharedGroupSchema, {
          required: ['tenantId', 'name']
        }),
        response: R.success('创建后的共享组详情', R.sharedGroup())
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
        tags: ['租户管理后台-共享组'],
        summary: '编辑租户共享组',
        description: '管理员编辑指定租户的共享组；只更新传入的字段；dataSourceTenantUserIds / memberTenantUserIds / sharedModules 传入时整体覆盖，未传则保持不变',
        body: toPartialSchema(sharedGroupSchema, {
          required: ['tenantId', 'id']
        }),
        response: R.success('编辑后的共享组详情', R.sharedGroup())
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
        tags: ['租户管理后台-共享组'],
        summary: '修改租户共享组状态',
        description: '开启或关闭共享组，关闭后不再参与数据权限合并',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', description: '租户 ID' },
            id: { type: 'string', description: '共享组 ID' },
            status: { type: 'string', enum: ['open', 'closed'], description: '目标状态：open 开启，closed 关闭' }
          },
          required: ['tenantId', 'id', 'status']
        },
        response: R.empty()
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
        tags: ['租户管理后台-共享组'],
        summary: '删除租户共享组',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', description: '租户 ID' },
            id: { type: 'string', description: '要删除的共享组 ID' }
          },
          required: ['tenantId', 'id']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.sharedGroup.remove(request.body);
      return {};
    }
  );
});
