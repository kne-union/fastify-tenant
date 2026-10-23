const fp = require('fastify-plugin');
const schema = require('../schema/tenant');
const toPartialSchema = require('../utils/toPartialSchema');
const tenantUserSchema = require('../schema/tenant-user');
const R = require('../schema/response');

const tenantIdProp = () => ({ type: 'string', description: '租户 ID' });

const thirdLoginPlatformProp = description => ({ type: 'string', enum: ['wecom', 'dingtalk', 'beisen'], description: `${description}：wecom 企业微信，dingtalk 钉钉，beisen 北森` });

const customComponentProp = () => ({
  type: 'object',
  properties: {
    key: {
      type: 'string',
      description: '组件唯一标识，租户内不可重复'
    },
    name: {
      type: 'string',
      description: '组件名称'
    },
    description: {
      type: 'string',
      description: '组件描述'
    },
    type: {
      type: 'string',
      description: '组件类型'
    },
    content: {
      type: 'string',
      description: '组件内容（代码）'
    }
  },
  required: ['key', 'name', 'type', 'content'],
  description: '自定义组件'
});

const orgImportRowsProp = () => ({
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    properties: {
      rowType: { type: 'string', enum: ['org', 'user'], description: '行类型：org 组织行，user 用户行' },
      orgName: { type: ['string', 'null'], description: '组织名称；用户行表示用户所属组织' },
      parentOrgName: { type: ['string', 'null'], description: '上级组织名称，仅组织行使用，为空则挂在锚点组织下' },
      userName: { type: ['string', 'null'], description: '用户姓名，仅用户行使用' },
      email: { type: ['string', 'null'], description: '用户邮箱，仅用户行使用' },
      phone: { type: ['string', 'null'], description: '用户手机号，仅用户行使用' },
      description: { type: ['string', 'null'], description: '组织或用户描述' },
      isLeader: { type: ['boolean', 'null'], description: '用户是否为所属组织的部门负责人，仅用户行使用' }
    },
    required: ['rowType']
  },
  description: '导入行列表（由前端解析 Excel 得到）'
});

const companyProps = () => ({
  name: { type: 'string', description: '公司名称' },
  fullName: { type: 'string', description: '公司全称' },
  logo: { type: 'string', description: '公司 Logo 文件 ID' },
  industry: { type: 'string', description: '所属行业' },
  scale: { type: 'string', description: '公司规模' },
  address: { type: 'string', description: '公司地址' },
  phone: { type: 'string', description: '联系电话' },
  email: { type: 'string', description: '联系邮箱' },
  foundedDate: { type: 'string', description: '成立日期' },
  companyTags: { type: 'array', items: { type: 'object' }, description: '公司标签列表' },
  website: { type: 'string', description: '公司主页' },
  description: { type: 'string', description: '公司描述' },
  banners: { type: 'array', items: { type: 'string' }, description: 'banner 图片文件 ID 列表' },
  teamDescription: { type: 'array', items: { type: 'object' }, description: '团队介绍' },
  developmentHistory: { type: 'array', items: { type: 'object' }, description: '发展历程' },
  contact: { type: 'object', description: '联系方式' },
  options: { type: 'object', description: '扩展字段' }
});

const orgMessageProps = () => ({
  userIds: {
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
    description: '接收消息的租户用户 ID 列表，仅通过组织同步进入系统的用户可收到'
  },
  content: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '消息正文' }
    },
    required: ['content'],
    description: '消息内容'
  },
  msgtype: {
    type: 'string',
    enum: ['text', 'markdown'],
    default: 'text',
    description: '消息类型：text 文本，markdown'
  }
});

const pageQueryProps = () => ({
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
});

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const userAuthenticate = options.getUserAuthenticate();
  const adminAuthenticate = options.getAdminUserAuthenticate();
  fastify.get(
    `${options.prefix}/admin/list`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-租户'],
        summary: '租户列表',
        description: '管理员分页查询全部租户',
        query: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: '筛选条件：keyword 按名称/描述模糊匹配，status 按状态（open / closed）'
            },
            ...pageQueryProps()
          }
        },
        response: R.success('租户分页列表', R.pageResult('租户', R.tenant()))
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
        tags: ['租户管理后台-租户'],
        summary: '租户详情',
        description: '返回租户信息，含公司信息与租户设置',
        query: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '租户 ID'
            }
          },
          required: ['id']
        },
        response: R.success('租户详情', R.tenant())
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
        tags: ['租户管理后台-环境变量'],
        summary: '设置租户环境变量',
        description: '追加租户环境变量，key 已存在时报错；secret 为 true 的变量存为密钥，列表中 value 显示为 ******',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            args: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                    description: '环境变量名'
                  },
                  value: {
                    type: 'string',
                    description: '环境变量值'
                  },
                  secret: {
                    type: 'boolean',
                    default: false,
                    description: '是否为密钥，密钥不会通过接口返回明文'
                  }
                }
              },
              minItems: 1,
              description: '要追加的环境变量列表'
            }
          },
          required: ['tenantId', 'args']
        },
        response: R.empty()
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
        tags: ['租户管理后台-环境变量'],
        summary: '删除一个环境变量',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            key: {
              type: 'string',
              description: '要删除的环境变量名'
            }
          },
          required: ['tenantId', 'key']
        },
        response: R.empty()
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
        tags: ['租户管理后台-自定义组件'],
        summary: '设置租户自定义组件',
        description: '新增租户自定义组件，key 已存在时报错',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            customComponent: customComponentProp()
          },
          required: ['tenantId', 'customComponent']
        },
        response: R.empty()
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
        tags: ['租户管理后台-自定义组件'],
        summary: '自定义组件详情',
        description: '按 key 获取租户自定义组件内容',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            key: {
              type: 'string',
              description: '自定义组件 key'
            }
          },
          required: ['tenantId', 'key']
        },
        response: R.success('自定义组件内容', R.customComponent())
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
        tags: ['租户管理后台-自定义组件'],
        summary: '删除一个自定义组件',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            key: {
              type: 'string',
              description: '要删除的自定义组件 key'
            }
          },
          required: ['tenantId', 'key']
        },
        response: R.empty()
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
        tags: ['租户管理后台-自定义组件'],
        summary: '保存一个自定义组件',
        description: '按 key 更新已存在的自定义组件',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            customComponent: customComponentProp()
          },
          required: ['tenantId', 'customComponent']
        },
        response: R.empty()
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
        tags: ['租户管理后台-自定义组件'],
        summary: '复制一个自定义组件',
        description: '复制出 key 为“原 key_COPY”的新组件',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            key: {
              type: 'string',
              description: '被复制的自定义组件 key'
            }
          },
          required: ['tenantId', 'key']
        },
        response: R.empty()
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
        tags: ['租户管理后台-租户'],
        summary: '添加租户',
        description: '创建租户，同时初始化公司信息、系统角色（租户管理员、默认角色）与租户权限',
        body: schema,
        response: R.success('创建后的租户信息', R.tenant())
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
        tags: ['租户管理后台-租户'],
        summary: '保存租户',
        description: '编辑租户基本信息，只更新传入的字段；托管租户不可编辑',
        body: toPartialSchema(schema, {
          properties: {
            id: {
              type: 'string',
              description: '要编辑的租户 ID'
            }
          },
          required: ['id']
        }),
        response: R.success('编辑后的租户信息', R.tenant())
      }
    },
    async request => {
      return services.tenant.save(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/admin/save-languages`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-租户'],
        summary: '保存租户系统语言设置',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            supportLanguage: {
              type: 'array',
              items: {
                type: 'string'
              },
              minItems: 1,
              description: '支持的系统语言列表，如 ["zh-CN", "en-US"]'
            },
            defaultLanguage: {
              type: 'string',
              description: '默认系统语言，需包含在 supportLanguage 中'
            }
          },
          required: ['tenantId', 'supportLanguage', 'defaultLanguage']
        },
        response: R.success('保存后的语言设置', R.languages())
      }
    },
    async request => {
      return services.tenant.saveLanguages(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/admin/set-status`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-租户'],
        summary: '设置租户状态',
        description: '开启或关闭租户，关闭后租户用户无法登录使用',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '租户 ID'
            },
            status: {
              type: 'string',
              enum: ['open', 'closed'],
              description: '目标状态：open 开启，closed 关闭'
            }
          },
          required: ['id', 'status']
        },
        response: R.empty()
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
        tags: ['租户管理后台-租户'],
        summary: '删除租户',
        description: '删除租户及其公司信息，托管租户不可删除',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '要删除的租户 ID'
            }
          },
          required: ['id']
        },
        response: R.empty()
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
        tags: ['租户管理后台-公司信息'],
        summary: '查询公司信息',
        description: '获取指定租户的公司信息，不存在时按租户名称自动创建',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp()
          },
          required: ['tenantId']
        },
        response: R.success('公司信息', R.company())
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
        tags: ['租户管理后台-公司信息'],
        summary: '保存公司信息',
        description: '只更新传入的字段',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            ...companyProps()
          },
          required: ['tenantId']
        },
        response: R.success('保存后的公司信息', R.company())
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
        tags: ['租户管理后台-组织架构'],
        summary: '创建组织节点',
        description: '同一父级下组织名称不可重复',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            parentId: {
              type: 'string',
              description: '父级组织 ID，不传表示创建根节点'
            },
            name: {
              type: 'string',
              description: '组织名称'
            },
            description: {
              type: 'string',
              description: '组织描述'
            },
            leaderUserId: {
              type: ['string', 'null'],
              default: null,
              description: '部门负责人（租户用户 ID），不传或 null 表示无负责人'
            }
          },
          required: ['tenantId', 'name']
        },
        response: R.success('创建后的组织节点', R.org())
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
        tags: ['租户管理后台-组织架构'],
        summary: '获取租户组织',
        description: '返回租户全部组织节点（扁平列表，按 parentId 组装树），含负责人与用户数',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            status: {
              type: 'string',
              enum: ['open', 'closed'],
              description: '组织与用户状态，不传默认 open'
            }
          },
          required: ['tenantId']
        },
        response: R.success('组织节点列表', R.list('组织节点列表', R.org()))
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
        tags: ['租户管理后台-组织架构'],
        summary: '删除组织节点',
        description: '组织下仍有用户时不可删除',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: {
              type: 'string',
              description: '要删除的组织 ID'
            }
          },
          required: ['tenantId', 'id']
        },
        response: R.empty()
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
        tags: ['租户管理后台-组织架构'],
        summary: '编辑组织节点',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: {
              type: 'string',
              description: '要编辑的组织 ID'
            },
            name: {
              type: 'string',
              description: '组织名称'
            },
            description: {
              type: 'string',
              description: '组织描述'
            },
            leaderUserId: {
              type: ['string', 'null'],
              default: null,
              description: '部门负责人（租户用户 ID），传 null 清空'
            }
          },
          required: ['id', 'tenantId']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.org.save(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/org-batch-import`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-组织架构'],
        summary: '批量导入组织与用户（JSON，由前端解析 Excel 后提交）',
        description: '在一个事务内批量创建组织与用户，任一行失败整体回滚',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            parentOrgId: { type: 'string', description: '锚点组织节点 ID，导入的顶层组织挂在其下；不传则挂在根' },
            rows: orgImportRowsProp()
          },
          required: ['tenantId', 'rows']
        },
        response: R.success('导入结果统计', R.orgImportResult())
      }
    },
    async request => {
      const { tenantId, parentOrgId, rows } = request.body;
      return services.org.importFromRows({
        tenantId,
        parentOrgId: parentOrgId ? String(parentOrgId).trim() : null,
        rows
      });
    }
  );

  fastify.get(
    `${options.prefix}/admin/org-link-config`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-组织架构'],
        summary: '获取组织关联配置',
        description: '获取租户与第三方组织架构（企业微信/钉钉/北森）的关联同步配置',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp()
          },
          required: ['tenantId']
        },
        response: R.success('组织关联配置', R.orgSyncConfig())
      }
    },
    async request => {
      return services.orgSync.getConfig({ tenantId: request.query.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/admin/org-link-save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-组织架构'],
        summary: '保存组织关联配置',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            source: thirdLoginPlatformProp('同步源'),
            syncInterval: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly', 'yearly', 'off'],
              description: '自动同步周期：daily 每天，weekly 每周，monthly 每月，yearly 每年，off 关闭自动同步'
            },
            targetId: { type: 'string', description: '关联的租户环境变量目标 ID（存放同步源配置）' }
          },
          required: ['tenantId', 'source', 'syncInterval', 'targetId']
        },
        response: R.empty()
      }
    },
    async request => {
      const { tenantId, source, syncInterval, targetId } = request.body;
      await services.orgSync.saveConfig({ tenantId, source, syncInterval, targetId });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/org-link-cancel`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-组织架构'],
        summary: '取消组织关联',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp()
          },
          required: ['tenantId']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.orgSync.cancelConfig({ tenantId: request.body.tenantId });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/org-link-sync`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-组织架构'],
        summary: '手动同步组织架构',
        description: '立即按组织关联配置从第三方同步组织与用户',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp()
          },
          required: ['tenantId']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.orgSync.triggerSync({ tenantId: request.body.tenantId });
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/admin/third-login-config`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-第三方登录'],
        summary: '获取第三方登录配置列表',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp()
          },
          required: ['tenantId']
        },
        response: R.success('第三方登录配置', R.thirdLoginConfigList())
      }
    },
    async request => {
      return services.thirdLogin.list({ tenantId: request.query.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/admin/third-login-config-save`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-第三方登录'],
        summary: '保存第三方登录配置',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            source: thirdLoginPlatformProp('第三方登录渠道'),
            targetId: { type: 'string', description: '关联的租户环境变量目标 ID（存放渠道配置）' }
          },
          required: ['tenantId', 'source', 'targetId']
        },
        response: R.empty()
      }
    },
    async request => {
      const { tenantId, source, targetId } = request.body;
      await services.thirdLogin.saveConfig({ tenantId, source, targetId });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/third-login-config-cancel`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-第三方登录'],
        summary: '取消第三方登录配置',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            source: thirdLoginPlatformProp('第三方登录渠道'),
            targetId: { type: 'string', description: '要取消的渠道配置对应的目标 ID' }
          },
          required: ['tenantId', 'source', 'targetId']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.thirdLogin.cancelConfig({
        tenantId: request.body.tenantId,
        source: request.body.source,
        targetId: request.body.targetId
      });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/third-login-bind-setting`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-第三方登录'],
        summary: '保存第三方登录自定义绑定开关',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            allowThirdLoginBind: { type: 'boolean', description: '是否允许为租户用户生成绑定链接以绑定第三方账号' }
          },
          required: ['tenantId', 'allowThirdLoginBind']
        },
        response: R.success('保存后的开关状态', R.thirdLoginBindSetting())
      }
    },
    async request => {
      return services.thirdLogin.saveBindSetting({
        tenantId: request.body.tenantId,
        allowThirdLoginBind: request.body.allowThirdLoginBind
      });
    }
  );

  fastify.post(
    `${options.prefix}/admin/third-login-bind-token`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-第三方登录'],
        summary: '生成第三方登录绑定链接',
        description: '为指定租户用户生成第三方账号绑定短链（5 分钟有效），需已开启自定义绑定开关',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: { type: 'string', description: '要绑定的租户用户 ID' },
            platform: thirdLoginPlatformProp('第三方渠道，租户只配置了一个渠道时可不传'),
            targetId: { type: 'string', description: '渠道配置目标 ID，同一渠道配置多个时必传' }
          },
          required: ['tenantId', 'id']
        },
        response: R.success('绑定链接信息', R.thirdLoginBindToken())
      }
    },
    async request => {
      const { tenantId, id, platform, targetId } = request.body;
      return services.user.thirdLoginBindToken({ tenantId, id, platform, targetId });
    }
  );

  fastify.post(
    `${options.prefix}/admin/third-login-unbind`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-第三方登录'],
        summary: '解除第三方登录绑定',
        description: '解除租户用户的第三方账号绑定；不传 platform 时解除所有可解除的绑定（组织同步来源渠道不可解除）',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: { type: 'string', description: '租户用户 ID' },
            platform: thirdLoginPlatformProp('要解除的第三方渠道，不传表示全部')
          },
          required: ['tenantId', 'id']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.user.thirdLoginUnbind({
        tenantId: request.body.tenantId,
        id: request.body.id,
        platform: request.body.platform
      });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/user-create`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-成员'],
        summary: '创建租户用户',
        body: tenantUserSchema,
        response: R.empty()
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
        tags: ['租户管理后台-成员'],
        summary: '编辑租户用户',
        body: Object.assign({}, tenantUserSchema, {
          required: ['id', 'tenantId', 'name']
        }),
        response: R.empty()
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
        tags: ['租户管理后台-成员'],
        summary: '删除租户用户',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '要删除的租户用户 ID'
            },
            tenantId: tenantIdProp()
          },
          required: ['id', 'tenantId']
        },
        response: R.empty()
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
        tags: ['租户管理后台-成员'],
        summary: '租户用户列表',
        description: '管理员分页查询指定租户的用户',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            filter: {
              type: 'object',
              description: '筛选条件：keyword 按姓名/邮箱/手机/描述模糊匹配，email、phone 模糊匹配，status 状态，tenantOrgId 所属组织（含下级），roles / role 角色 ID，id / ids 用户 ID，synced 是否同步用户'
            },
            ...pageQueryProps()
          },
          required: ['tenantId']
        },
        response: R.success('租户用户分页列表', R.pageResult('租户用户', R.tenantUser()))
      }
    },
    async request => {
      return await services.user.list(request.query);
    }
  );

  fastify.get(
    `${options.prefix}/admin/user-detail`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-成员'],
        summary: '获取租户用户详情',
        query: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '租户用户 ID'
            },
            tenantId: tenantIdProp()
          },
          required: ['id', 'tenantId']
        },
        response: R.success('租户用户详情，含所属租户、角色详情与所属组织', R.tenantUser())
      }
    },
    async request => {
      return await services.user.detail(Object.assign({}, request.query));
    }
  );

  fastify.post(
    `${options.prefix}/admin/user-set-status`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-成员'],
        summary: '修改租户用户状态',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: {
              type: 'string',
              description: '租户用户 ID'
            },
            status: {
              type: 'string',
              enum: ['open', 'closed'],
              description: '目标状态：open 正常，closed 关闭（关闭后无法登录租户）'
            }
          },
          required: ['tenantId', 'id', 'status']
        },
        response: R.empty()
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
        tags: ['租户管理后台-成员'],
        summary: '查看租户用户权限列表',
        description: '返回租户权限树，以及该用户所有角色合并后的权限码',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: {
              type: 'string',
              description: '租户用户 ID'
            }
          },
          required: ['tenantId', 'id']
        },
        response: R.success('租户用户权限', R.permissionResult('租户用户权限'))
      }
    },
    async request => {
      return fastify[options.name].translator.withTranslatedPermissions(request, await services.user.permissionList(request.query));
    }
  );

  fastify.get(
    `${options.prefix}/admin/user-invite-token`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-成员'],
        summary: '获取用户邀请链接',
        description: '生成租户用户的邀请 token，用于拼接加入租户链接',
        query: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: {
              type: 'string',
              description: '被邀请的租户用户 ID'
            }
          },
          required: ['tenantId', 'id']
        },
        response: R.success('邀请信息', R.inviteToken())
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
        tags: ['租户管理后台-成员'],
        summary: '发送邀请租户消息',
        description: '向租户用户的邮箱（优先）或手机号发送加入租户邀请',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            id: {
              type: 'string',
              description: '被邀请的租户用户 ID'
            }
          },
          required: ['tenantId', 'id']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.user.sendInviteMessage(request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/admin/send-org-message`,
    {
      onRequest: [userAuthenticate, adminAuthenticate],
      schema: {
        tags: ['租户管理后台-组织架构'],
        summary: '发送组织同步消息（管理端）',
        description: '通过组织关联的第三方渠道（如企业微信）向同步用户发送消息，需宿主实现 sendOrgMessage',
        body: {
          type: 'object',
          properties: {
            tenantId: tenantIdProp(),
            ...orgMessageProps()
          },
          required: ['tenantId', 'userIds', 'content']
        },
        response: R.success('发送结果', R.orgMessageResult())
      }
    },
    async request => {
      const { tenantId, userIds, content, msgtype } = request.body;
      return services.orgSync.sendMessage({
        tenantId,
        userIds,
        content,
        msgtype
      });
    }
  );
});
