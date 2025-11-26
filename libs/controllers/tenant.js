const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services, authenticate } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();
  fastify.post(
    `${options.prefix}/parse-join-token`,
    {
      onRequest: [userAuthenticate],
      schema: {
        summary: '解析租户邀请数据',
        body: {
          type: 'object',
          properties: {
            token: {
              type: 'string'
            }
          }
        }
      }
    },
    async request => {
      return services.user.parseToken(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/join`,
    {
      onRequest: [userAuthenticate],
      schema: {
        summary: '加入租户',
        body: {
          type: 'object',
          properties: {
            token: {
              type: 'string'
            }
          }
        }
      }
    },
    async request => {
      await services.user.join(request.userInfo, request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/available-list`,
    {
      onRequest: [userAuthenticate],
      schema: {
        summary: '用户可用租户列表'
      }
    },
    async request => {
      return services.user.tenantList(request.userInfo);
    }
  );

  fastify.post(
    `${options.prefix}/switch-default-tenant`,
    {
      onRequest: [userAuthenticate],
      schema: {
        summary: '切换用户默认租户',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            }
          }
        }
      }
    },
    async request => {
      await services.user.setDefaultTenant(request.userInfo, request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/getUserInfo`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '获取登录租户用户信息'
      }
    },
    async request => {
      return {
        userInfo: request.userInfo,
        tenantUserInfo: request.tenantUserInfo,
        company: request.tenantUserInfo.tenant.tenantCompany,
        tenant: request.tenantUserInfo.tenant
      };
    }
  );

  fastify.get(
    `${options.prefix}/company-detail`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '获取公司信息'
      }
    },
    async request => {
      return services.company.detail({ tenantId: request.tenantUserInfo.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/company-save`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '保存公司信息',
        body: {
          type: 'object'
        }
      }
    },
    async request => {
      return services.company.save(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/org-create`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '创建组织节点',
        body: {
          type: 'object',
          properties: {
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
          required: ['name']
        }
      }
    },
    async request => {
      return services.org.create(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );

  fastify.get(
    `${options.prefix}/org-list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '获取租户组织'
      }
    },
    async request => {
      return services.org.list(
        Object.assign({}, request.query, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/org-remove`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '删除组织节点',
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
      await services.org.remove(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/org-save`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '编辑组织节点',
        body: {
          type: 'object',
          properties: {
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
          required: ['id']
        }
      }
    },
    async request => {
      await services.org.save(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/user-create`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '创建租户用户',
        body: {
          type: 'object',
          properties: {
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
          required: ['name']
        }
      }
    },
    async request => {
      await services.user.create(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/user-save`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '编辑租户用户',
        body: {
          type: 'object',
          properties: {
            id: {
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
              type: 'string',
              default: ''
            }
          },
          required: ['id', 'name']
        }
      }
    },
    async request => {
      await services.user.save(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/user-remove`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '删除租户用户',
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
      await services.user.remove(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/user-list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '租户用户列表',
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
      return await services.user.list(
        Object.assign({}, request.query, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/user-set-status`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '修改租户用户状态',
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
      await services.user.setStatus(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/user-invite-token`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '获取用户邀请链接',
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
      return await services.user.inviteToken(
        Object.assign({}, request.query, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/send-invite-message`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '发送邀请租户消息',
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
      await services.user.sendInviteMessage(
        Object.assign({}, request.body, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/statistics`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '获取统计数据',
        query: {
          type: 'object',
          properties: {
            timeRange: {
              type: 'number',
              enum: [7, 30],
              default: 7
            }
          }
        }
      }
    },
    async request => {
      return await services.statistics.getRecord(Object.assign({}, request.query, { tenantId: request.tenantUserInfo.tenantId }));
    }
  );
});
