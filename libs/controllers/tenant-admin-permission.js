const fp = require('fastify-plugin');
const toPartialSchema = require('../utils/toPartialSchema');
const roleSchema = require('../schema/role');
const R = require('../schema/response');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();
  const adminAuthenticate = options.getAdminUserAuthenticate();

  fastify.post(
    `${options.prefix}/admin/role/create`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-角色'],
        summary: '创建租户角色',
        description: '管理员在指定租户下创建角色',
        body: Object.assign({}, roleSchema, {
          required: ['tenantId', 'name', 'code']
        }),
        response: R.success('创建后的角色信息', R.role())
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
        tags: ['租户管理后台-角色'],
        summary: '租户角色列表',
        description: '管理员分页查询指定租户的角色',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            filter: {
              type: 'object',
              default: {},
              properties: {
                keyword: { type: 'string', description: '按角色名称/编码/描述模糊匹配' },
                status: { type: 'string', enum: ['open', 'closed'], description: '按角色状态筛选' },
                type: { type: 'string', enum: ['system', 'custom'], description: '按角色类型筛选' }
              },
              additionalProperties: true,
              description: '筛选条件'
            },
            perPage: {
              type: 'number',
              default: 20,
              description: '每页条数'
            },
            currentPage: {
              type: 'number',
              default: 1,
              description: '当前页码，从 1 开始'
            }
          },
          required: ['tenantId']
        },
        response: R.success('角色分页列表', R.pageResult('角色', R.role()))
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
        tags: ['租户管理后台-角色'],
        summary: '删除租户角色',
        description: '系统角色不可删除；仍有用户关联该角色时不可删除',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            id: {
              type: 'string',
              description: '要删除的角色 ID'
            }
          },
          required: ['tenantId', 'id']
        },
        response: R.empty()
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
        tags: ['租户管理后台-角色'],
        summary: '修改租户角色状态',
        description: '开启或关闭角色，系统角色不可修改',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            id: {
              type: 'string',
              description: '角色 ID'
            },
            status: {
              type: 'string',
              enum: ['open', 'closed'],
              description: '目标状态：open 开启，closed 关闭'
            }
          },
          required: ['tenantId', 'id', 'status']
        },
        response: R.empty()
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
        tags: ['租户管理后台-角色'],
        summary: '编辑租户角色',
        description: '管理员编辑指定租户的角色，只更新传入的字段；系统角色不可编辑',
        body: toPartialSchema(roleSchema, {
          properties: {
            id: { type: 'string', description: '要编辑的角色 ID' }
          },
          required: ['id', 'tenantId']
        }),
        response: R.success('编辑后的角色信息', R.role())
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
        tags: ['租户管理后台-角色'],
        summary: '租户角色权限列表',
        description: '返回租户已开通的权限树，以及该角色在其中已授权的权限码',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            id: {
              type: 'string',
              description: '角色 ID'
            }
          },
          required: ['tenantId', 'id']
        },
        response: R.success('角色权限', R.permissionResult('角色权限'))
      }
    },
    async request => {
      return fastify[options.name].translator.withTranslatedPermissions(request, await services.role.permissionList(request.query));
    }
  );

  fastify.post(
    `${options.prefix}/admin/role/save-permission`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-角色'],
        summary: '保存租户角色权限',
        description: '整体覆盖角色的权限码列表，租户未开通的权限码会被忽略',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            id: {
              type: 'string',
              description: '角色 ID'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: [],
              description: '授予角色的权限码列表，如 ["setting:org:view"]'
            }
          },
          required: ['tenantId', 'id', 'permissions']
        },
        response: R.empty()
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
        tags: ['租户管理后台-权限'],
        summary: '租户权限列表',
        description: '返回完整权限树，以及指定租户已开通的权限码',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            }
          },
          required: ['tenantId']
        },
        response: R.success('租户权限', R.permissionResult('租户权限'))
      }
    },
    async request => {
      return fastify[options.name].translator.withTranslatedPermissions(request, await services.permission.list(request.query));
    }
  );

  fastify.post(
    `${options.prefix}/admin/permission/save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-权限'],
        summary: '保存租户权限',
        description: '整体覆盖租户开通的权限码列表，权限树中不存在的权限码会被忽略',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: [],
              description: '租户开通的权限码列表'
            }
          },
          required: ['tenantId', 'permissions']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.permission.save(request.body);
      return {};
    }
  );
});
