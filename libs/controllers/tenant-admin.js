const fp = require('fastify-plugin');
const merge = require('lodash/merge');
const schema = require('../schema/tenant');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();
  const adminAuthenticate = options.getAdminUserAuthenticate();
  fastify.get(
    `${options.prefix}/admin/list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '租户列表',
        query: {
          type: 'object',
          properties: {
            filter: {
              type: 'object'
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
      return services.tenant.list(request.query);
    }
  );

  fastify.get(
    `${options.prefix}/admin/detail`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '租户详情',
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
      return services.tenant.detail(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/append-args`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '设置租户环境变量',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            args: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string'
                  },
                  value: {
                    type: 'string'
                  },
                  secret: {
                    type: 'boolean',
                    default: false
                  }
                }
              },
              minItems: 1
            }
          },
          required: ['tenantId', 'args']
        }
      }
    },
    async request => {
      await services.setting.appendArgs(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/remove-arg`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '删除一个环境变量',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            key: {
              type: 'string'
            }
          },
          required: ['tenantId', 'key']
        }
      }
    },
    async request => {
      await services.setting.removeArg(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/append-custom-component`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '设置租户自定义组件',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            customComponent: {
              type: 'object',
              properties: {
                key: {
                  type: 'string'
                },
                name: {
                  type: 'string'
                },
                description: {
                  type: 'string'
                },
                type: {
                  type: 'string'
                },
                content: {
                  type: 'string'
                }
              },
              required: ['key', 'name', 'type', 'content']
            }
          },
          required: ['tenantId', 'customComponent']
        }
      }
    },
    async request => {
      await services.setting.appendCustomComponent(request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/admin/custom-component-detail`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '自定义组件详情',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            key: {
              type: 'string'
            }
          },
          required: ['tenantId', 'key']
        }
      }
    },
    async request => {
      return services.setting.customComponentDetail(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/remove-custom-component`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '删除一个自定义组件',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            key: {
              type: 'string'
            }
          },
          required: ['tenantId', 'key']
        }
      }
    },
    async request => {
      await services.setting.removeCustomComponent(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/save-custom-component`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '保存一个自定义组件',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            customComponent: {
              type: 'object',
              properties: {
                key: {
                  type: 'string'
                },
                name: {
                  type: 'string'
                },
                description: {
                  type: 'string'
                },
                type: {
                  type: 'string'
                },
                content: {
                  type: 'string'
                }
              },
              required: ['key', 'name', 'type', 'content']
            }
          },
          required: ['tenantId', 'customComponent']
        }
      }
    },
    async request => {
      await services.setting.saveCustomComponents(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/copy-custom-component`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '复制一个自定义组件',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            key: {
              type: 'string'
            }
          },
          required: ['tenantId', 'key']
        }
      }
    },
    async request => {
      await services.setting.copyCustomComponent(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/create`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '添加租户',
        body: merge({}, schema)
      }
    },
    async request => {
      return services.tenant.create(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/admin/save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '保存租户',
        body: merge({}, schema, {
          properties: {
            id: {
              type: 'string'
            },
            description: {
              type: 'string',
              default: ''
            }
          },
          required: ['id']
        })
      }
    },
    async request => {
      return services.tenant.save(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/admin/set-status`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '设置租户状态',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            status: {
              type: 'string'
            }
          },
          required: ['id', 'status']
        }
      }
    },
    async request => {
      await services.tenant.setStatus(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/remove`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '删除租户',
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
      await services.tenant.remove(request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/admin/company-detail`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '查询公司信息',
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
      return services.company.detail(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/company-save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '保存公司信息',
        body: {
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
      return services.company.save(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/admin/org-create`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '创建组织节点',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            parentId: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string'
            }
          },
          required: ['tenantId', 'name']
        }
      }
    },
    async request => {
      return services.org.create(request.body);
    }
  );

  fastify.get(
    `${options.prefix}/admin/org-list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '获取租户组织',
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
      return services.org.list(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/org-remove`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '删除组织节点',
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
      await services.org.remove(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/org-save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '编辑组织节点',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string'
            }
          },
          required: ['id', 'tenantId']
        }
      }
    },
    async request => {
      await services.org.save(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/user-create`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '创建租户用户',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            tenantOrgId: {
              type: 'string'
            },
            avatar: {
              type: 'string'
            },
            email: {
              type: 'string'
            },
            phone: {
              type: 'string'
            },
            description: {
              type: 'string'
            }
          },
          required: ['tenantId', 'name']
        }
      }
    },
    async request => {
      await services.user.create(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/user-save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '编辑租户用户',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            tenantId: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            tenantOrgId: {
              type: 'string',
              default: ''
            },
            avatar: {
              type: 'string',
              default: ''
            },
            email: {
              type: 'string',
              default: ''
            },
            phone: {
              type: 'string',
              default: ''
            },
            description: {
              type: 'string',
              default: ''
            }
          },
          required: ['id', 'tenantId', 'name']
        }
      }
    },
    async request => {
      await services.user.save(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/user-remove`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '删除租户用户',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            tenantId: {
              type: 'string'
            }
          },
          required: ['id', 'tenantId']
        }
      }
    },
    async request => {
      await services.user.remove(request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/admin/user-list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '租户用户列表',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            filter: {
              type: 'object'
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
      return await services.user.list(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/user-set-status`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '修改租户用户状态',
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
      await services.user.setStatus(request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/admin/user-permission-list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '查看租户用户权限列表',
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
      return await services.user.permissionList(request.query);
    }
  );

  fastify.get(
    `${options.prefix}/admin/user-invite-token`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '获取用户邀请链接',
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
      return await services.user.inviteToken(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/admin/send-invite-message`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        summary: '发送邀请租户消息',
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
      await services.user.sendInviteMessage(request.body);
      return {};
    }
  );
});
