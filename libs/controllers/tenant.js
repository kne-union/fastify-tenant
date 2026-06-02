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
          type: 'object',
          properties: {
            name: { type: 'string' },
            fullName: { type: 'string' },
            logo: { type: 'string' },
            industry: { type: 'string' },
            scale: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            foundedDate: { type: 'string' },
            companyTags: { type: 'array', items: { type: 'object' } },
            website: { type: 'string' },
            description: { type: 'string' },
            banners: { type: 'array', items: { type: 'object' } },
            teamDescription: { type: 'object' },
            developmentHistory: { type: 'object' },
            contact: { type: 'object' },
            options: { type: 'object' }
          }
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
            },
            leaderUserId: {
              type: ['string', 'null'],
              default: null,
              description: '部门负责人（租户用户 ID），不传或 null 表示无负责人'
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
            },
            leaderUserId: {
              type: ['string', 'null'],
              default: null,
              description: '部门负责人（租户用户 ID），传 null 清空'
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
    `${options.prefix}/org-batch-import`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '批量导入组织与用户（JSON，由前端解析 Excel 后提交）',
        body: {
          type: 'object',
          properties: {
            parentOrgId: {
              type: 'string',
              description: '锚点组织节点 ID，可选'
            },
            rows: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  rowType: { type: 'string', enum: ['org', 'user'] },
                  orgName: { type: ['string', 'null'] },
                  parentOrgName: { type: ['string', 'null'] },
                  userName: { type: ['string', 'null'] },
                  email: { type: ['string', 'null'] },
                  phone: { type: ['string', 'null'] },
                  description: { type: ['string', 'null'] },
                  isLeader: { type: ['boolean', 'null'] }
                },
                required: ['rowType']
              }
            }
          },
          required: ['rows']
        }
      }
    },
    async request => {
      const tenantId = request.tenantUserInfo.tenantId;
      const { parentOrgId, rows } = request.body;
      return services.org.importFromRows({
        tenantId,
        parentOrgId: parentOrgId ? String(parentOrgId).trim() : null,
        rows
      });
    }
  );

  fastify.get(
    `${options.prefix}/org-link-config`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '获取组织关联配置'
      }
    },
    async request => {
      return services.orgSync.getConfig({ tenantId: request.tenantUserInfo.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/org-link-save`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '保存组织关联配置',
        body: {
          type: 'object',
          properties: {
            source: { type: 'string', enum: ['wecom', 'dingtalk'] },
            syncInterval: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly', 'off'] },
            targetId: { type: 'string' }
          },
          required: ['source', 'syncInterval', 'targetId']
        }
      }
    },
    async request => {
      const { source, syncInterval, targetId } = request.body;
      await services.orgSync.saveConfig({ tenantId: request.tenantUserInfo.tenantId, source, syncInterval, targetId });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/org-link-cancel`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '取消组织关联'
      }
    },
    async request => {
      await services.orgSync.cancelConfig({ tenantId: request.tenantUserInfo.tenantId });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/org-link-sync`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '手动同步组织架构'
      }
    },
    async request => {
      await services.orgSync.triggerSync({ tenantId: request.tenantUserInfo.tenantId });
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
            tenantOrgIds: {
              type: 'array',
              items: { type: 'string' }
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

  fastify.get(
    `${options.prefix}/user-detail`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '获取租户用户详情',
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
      return await services.user.detail(
        Object.assign({}, request.query, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
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
            tenantOrgIds: {
              type: 'array',
              items: { type: 'string' }
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

  fastify.post(
    `${options.prefix}/send-org-message`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '发送组织同步消息',
        body: {
          type: 'object',
          properties: {
            userIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1
            },
            content: {
              type: 'object',
              properties: {
                content: { type: 'string' }
              },
              required: ['content']
            },
            msgtype: {
              type: 'string',
              enum: ['text', 'markdown'],
              default: 'text'
            }
          },
          required: ['userIds', 'content']
        }
      }
    },
    async request => {
      const { userIds, content, msgtype } = request.body;
      return services.orgSync.sendMessage({
        tenantId: request.tenantUserInfo.tenantId,
        userIds,
        content,
        msgtype
      });
    }
  );

  fastify.get(
    `${options.prefix}/custom-component-detail`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        summary: '自定义组件详情',
        query: {
          type: 'object',
          properties: {
            key: {
              type: 'string'
            }
          },
          required: ['key']
        }
      }
    },
    async request => {
      return services.setting.customComponentDetail(
        Object.assign({}, request.query, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );
    }
  );
});
