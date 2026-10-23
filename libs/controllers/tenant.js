const fp = require('fastify-plugin');
const { createBusinessError } = require('../utils/intl');
const R = require('../schema/response');

const thirdLoginPlatformProp = description => ({ type: 'string', enum: ['wecom', 'dingtalk', 'beisen'], description: `${description}：wecom 企业微信，dingtalk 钉钉，beisen 北森` });

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

const userListFilterDescription = '筛选条件：keyword 按姓名/邮箱/手机/描述模糊匹配，email、phone 模糊匹配，status 状态，tenantOrgId 所属组织（含下级），roles / role 角色 ID，id / ids 用户 ID，synced 是否同步用户';

const dataScopeTypeDescription = '数据范围：self 仅本人，owner 本人负责，org 本部门，orgSubtree 本部门及以下';

module.exports = fp(async (fastify, options) => {
  const { services, authenticate } = fastify[options.name];
  const userAuthenticate = authenticate.user; //options.getUserAuthenticate();

  fastify.post(
    `${options.prefix}/third-login`,
    {
      schema: {
        tags: ['租户-第三方登录'],
        summary: '获取第三方登录跳转信息',
        description: '无需登录；按租户渠道配置生成第三方登录跳转地址，需宿主实现 thirdLogin.getThirdLoginUrl',
        body: {
          type: 'object',
          properties: {
            platform: thirdLoginPlatformProp('第三方登录渠道'),
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            redirect: {
              type: 'string',
              description: '登录成功后回跳的前端地址'
            },
            bindToken: {
              type: 'string',
              description: '第三方账号绑定 token，通过绑定链接进入时传入，登录后完成绑定'
            },
            targetId: {
              type: 'string',
              description: '渠道配置目标 ID，同一渠道配置多个时必传'
            }
          },
          required: ['platform', 'tenantId']
        },
        response: R.success(
          '第三方登录跳转信息',
          R.obj('第三方登录跳转信息', {
            companyName: R.str('公司名称'),
            logo: R.str('公司 Logo 文件 ID'),
            configProps: R.any('渠道配置参数'),
            targetId: R.str('实际使用的渠道配置目标 ID'),
            redirectUrl: R.str('第三方登录跳转地址')
          })
        )
      }
    },
    async request => {
      return services.user.getThirdLoginUrl(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/third-login-result`,
    {
      schema: {
        tags: ['租户-第三方登录'],
        summary: '第三方登录结果处理',
        description: '无需登录；处理第三方登录回调，匹配租户用户后签发登录 token，需宿主实现 thirdLogin.getThirdLoginResult',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '租户 ID'
            },
            platform: thirdLoginPlatformProp('第三方登录渠道'),
            bindToken: {
              type: 'string',
              description: '第三方账号绑定 token，存在时将第三方账号绑定到对应租户用户'
            },
            targetId: {
              type: 'string',
              description: '渠道配置目标 ID'
            }
          },
          required: ['tenantId'],
          additionalProperties: true,
          description: '除上述字段外，第三方回调参数（如 code、state 等）原样透传给宿主处理'
        },
        response: R.success(
          '第三方登录结果',
          R.obj('第三方登录结果', {
            token: R.str('第三方登录 token，有效期 7 天，请求时放在 x-third-login-token 头'),
            platform: R.str('第三方登录渠道'),
            redirectUrl: R.str('登录成功后回跳地址'),
            name: R.str('租户用户姓名'),
            avatar: R.str('头像文件 ID'),
            email: R.str('邮箱'),
            phone: R.str('手机号')
          })
        )
      }
    },
    async request => {
      return services.user.getThirdLoginResult(request.body);
    }
  );

  fastify.get(
    `${options.prefix}/third-login-config`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-第三方登录'],
        summary: '获取第三方登录配置列表',
        response: R.success('当前租户的第三方登录配置', R.thirdLoginConfigList())
      }
    },
    async request => {
      return services.thirdLogin.list({ tenantId: request.tenantUserInfo.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/third-login-config-save`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-第三方登录'],
        summary: '保存第三方登录配置',
        body: {
          type: 'object',
          properties: {
            source: thirdLoginPlatformProp('第三方登录渠道'),
            targetId: { type: 'string', description: '关联的租户环境变量目标 ID（存放渠道配置）' }
          },
          required: ['source', 'targetId']
        },
        response: R.empty()
      }
    },
    async request => {
      const { source, targetId } = request.body;
      await services.thirdLogin.saveConfig({ tenantId: request.tenantUserInfo.tenantId, source, targetId });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/third-login-config-cancel`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-第三方登录'],
        summary: '取消第三方登录配置',
        body: {
          type: 'object',
          properties: {
            source: thirdLoginPlatformProp('第三方登录渠道'),
            targetId: { type: 'string', description: '要取消的渠道配置对应的目标 ID' }
          },
          required: ['source', 'targetId']
        },
        response: R.empty()
      }
    },
    async request => {
      await services.thirdLogin.cancelConfig({
        tenantId: request.tenantUserInfo.tenantId,
        source: request.body.source,
        targetId: request.body.targetId
      });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/third-login-bind-setting`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-第三方登录'],
        summary: '保存第三方登录自定义绑定开关',
        body: {
          type: 'object',
          properties: {
            allowThirdLoginBind: { type: 'boolean', description: '是否允许为租户用户生成绑定链接以绑定第三方账号' }
          },
          required: ['allowThirdLoginBind']
        },
        response: R.success('保存后的开关状态', R.thirdLoginBindSetting())
      }
    },
    async request => {
      return services.thirdLogin.saveBindSetting({
        tenantId: request.tenantUserInfo.tenantId,
        allowThirdLoginBind: request.body.allowThirdLoginBind
      });
    }
  );

  fastify.post(
    `${options.prefix}/third-login-bind-token`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-第三方登录'],
        summary: '生成第三方登录绑定链接',
        description: '为租户用户生成第三方账号绑定短链（5 分钟有效），需已开启自定义绑定开关',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '要绑定的租户用户 ID，不传则为当前登录用户' },
            platform: thirdLoginPlatformProp('第三方渠道，租户只配置了一个渠道时可不传'),
            targetId: { type: 'string', description: '渠道配置目标 ID，同一渠道配置多个时必传' }
          }
        },
        response: R.success('绑定链接信息', R.thirdLoginBindToken())
      }
    },
    async request => {
      const { id, platform, targetId } = request.body;
      return services.user.thirdLoginBindToken({
        tenantId: request.tenantUserInfo.tenantId,
        id,
        platform,
        targetId,
        tenantUserId: request.tenantUserInfo.id
      });
    }
  );

  fastify.post(
    `${options.prefix}/third-login-unbind`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-第三方登录'],
        summary: '解除第三方登录绑定',
        description: '解除租户用户的第三方账号绑定；不传 platform 时解除所有可解除的绑定（组织同步来源渠道不可解除）',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '租户用户 ID，不传则为当前登录用户' },
            platform: thirdLoginPlatformProp('要解除的第三方渠道，不传表示全部')
          }
        },
        response: R.empty()
      }
    },
    async request => {
      await services.user.thirdLoginUnbind({
        tenantId: request.tenantUserInfo.tenantId,
        id: request.body.id,
        tenantUserId: request.tenantUserInfo.id,
        platform: request.body.platform
      });
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/parse-join-token`,
    {
      onRequest: [userAuthenticate],
      schema: {
        tags: ['租户-当前用户'],
        summary: '解析租户邀请数据',
        description: '解析邀请 token，返回邀请所属的租户、公司与被邀请的租户用户，用于加入前确认',
        body: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: '邀请 token（来自获取用户邀请链接接口）'
            }
          },
          required: ['token']
        },
        response: R.success(
          '邀请数据',
          R.obj('邀请数据', {
            tenant: R.tenant(),
            company: R.company(),
            tenantUser: R.tenantUser()
          })
        )
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
        tags: ['租户-当前用户'],
        summary: '加入租户',
        description: '当前账号通过邀请 token 关联到对应租户用户，并设为默认租户；邀请链接只能使用一次',
        body: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: '邀请 token'
            }
          },
          required: ['token']
        },
        response: R.empty()
      }
    },
    async request => {
      if (!request.userInfo.id) {
        throw createBusinessError(500, 'userInfoUnavailable');
      }
      await services.user.join(request.userInfo, request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/available-list`,
    {
      onRequest: [userAuthenticate],
      schema: {
        tags: ['租户-当前用户'],
        summary: '用户可用租户列表',
        description: '返回当前账号已加入的租户（以租户用户形式，含租户与公司信息）及默认租户',
        response: R.success(
          '可用租户列表',
          R.obj('可用租户列表', {
            list: R.list('当前账号关联的租户用户列表', R.tenantUser()),
            defaultTenantId: R.any('默认租户 ID，未设置时为空')
          })
        )
      }
    },
    async request => {
      if (!request.userInfo.id) {
        throw createBusinessError(500, 'userInfoUnavailable');
      }
      return services.user.tenantList(request.userInfo);
    }
  );

  fastify.post(
    `${options.prefix}/switch-default-tenant`,
    {
      onRequest: [userAuthenticate],
      schema: {
        tags: ['租户-当前用户'],
        summary: '切换用户默认租户',
        description: '设置当前账号的默认租户，需已加入该租户',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              description: '要切换到的租户 ID'
            }
          },
          required: ['tenantId']
        },
        response: R.empty()
      }
    },
    async request => {
      if (!request.userInfo.id) {
        throw createBusinessError(500, 'userInfoUnavailable');
      }
      await services.user.setDefaultTenant(request.userInfo, request.body);
      return {};
    }
  );

  fastify.get(
    `${options.prefix}/getUserInfo`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-当前用户'],
        summary: '获取登录租户用户信息',
        response: R.success(
          '当前登录用户在当前租户下的信息',
          R.obj('当前登录信息', {
            userInfo: R.any('账号用户信息（来自账号插件；第三方登录时为空对象）'),
            tenantUserInfo: Object.assign(R.tenantUser(), {
              description: '当前租户用户信息，额外包含 permissions（已授权权限码列表）与 tenantSetting'
            }),
            company: R.company(),
            tenant: R.tenant()
          })
        )
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
    `${options.prefix}/languages`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-当前用户'],
        summary: '获取当前租户系统语言设置',
        response: R.success('当前租户的语言设置', R.languages())
      }
    },
    async request => {
      return services.tenant.getLanguages({ tenantId: request.tenantUserInfo.tenantId });
    }
  );

  fastify.get(
    `${options.prefix}/data-permission`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-数据权限'],
        summary: '获取当前用户数据权限（可见租户用户）',
        description: '租户管理员（系统角色 admin）返回 allVisible=true 且 tenantUserIds 为空；普通用户默认 allVisible=false，按组织范围返回可见用户 ID。',
        query: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['self', 'owner', 'org', 'orgSubtree'],
              default: 'owner',
              description: `${dataScopeTypeDescription}，默认 owner`
            },
            moduleCode: {
              type: 'string',
              description: '非空时合并该模块下共享组数据来源；不传或空则忽略共享组'
            }
          }
        },
        response: R.success(
          '数据权限',
          R.obj('数据权限', {
            allVisible: R.bool('是否可见全部用户（租户管理员），为 true 时调用方应跳过数据范围过滤'),
            tenantUserIds: R.strArray('可见的租户用户 ID 列表；allVisible 为 true 时为空数组（未计算）'),
            type: R.str('实际使用的数据范围'),
            moduleCode: R.str('实际使用的模块编码')
          })
        )
      }
    },
    async request => {
      const type = request.query.type;
      const moduleCode = request.query.moduleCode != null && String(request.query.moduleCode).trim() ? String(request.query.moduleCode).trim() : null;
      const tu = request.tenantUserInfo;
      return services.dataScope.resolveDataPermission({
        tenantId: tu.tenantId,
        currentTenantUserId: tu.id,
        roleDetails: typeof tu.getDataValue === 'function' ? tu.getDataValue('roleDetails') : tu.roleDetails,
        roles: typeof tu.getDataValue === 'function' ? tu.getDataValue('roles') : tu.roles,
        type,
        moduleCode
      });
    }
  );

  fastify.get(
    `${options.prefix}/data-permission-by-code`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-数据权限'],
        summary: '按权限码获取当前用户数据权限（可见租户用户）',
        description: '租户管理员返回 allVisible=true；普通用户默认 allVisible=false，按权限码对应模块 dataScope 解析。',
        query: {
          type: 'object',
          properties: {
            permissionCode: {
              type: 'string',
              description: '功能权限码，用于定位模块 dataScope 并合并共享组'
            }
          },
          required: ['permissionCode']
        },
        response: R.success(
          '数据权限',
          R.obj('数据权限', {
            allVisible: R.bool('是否可见全部用户（租户管理员），为 true 时调用方应跳过数据范围过滤'),
            tenantUserIds: R.strArray('可见的租户用户 ID 列表；allVisible 为 true 时为空数组（未计算）'),
            moduleCode: R.str('权限码所属模块编码'),
            type: R.str('模块 dataScope 配置的数据范围，未开启时为 self'),
            dataScopeOpen: R.bool('模块是否开启了数据范围控制')
          })
        )
      }
    },
    async request => {
      const tu = request.tenantUserInfo;
      return services.dataScope.resolveDataPermissionByCode({
        tenantId: tu.tenantId,
        currentTenantUserId: tu.id,
        roleDetails: typeof tu.getDataValue === 'function' ? tu.getDataValue('roleDetails') : tu.roleDetails,
        roles: typeof tu.getDataValue === 'function' ? tu.getDataValue('roles') : tu.roles,
        permissionCode: String(request.query.permissionCode).trim()
      });
    }
  );

  fastify.get(
    `${options.prefix}/company-detail`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-公司信息'],
        summary: '获取公司信息',
        description: '获取当前租户的公司信息，不存在时按租户名称自动创建',
        response: R.success('公司信息', R.company())
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
        tags: ['租户-公司信息'],
        summary: '保存公司信息',
        description: '只更新传入的字段；托管租户不可编辑',
        body: {
          type: 'object',
          properties: {
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
          }
        },
        response: R.success('保存后的公司信息', R.company())
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
        tags: ['租户-组织架构'],
        summary: '创建组织节点',
        description: '同一父级下组织名称不可重复',
        body: {
          type: 'object',
          properties: {
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
          required: ['name']
        },
        response: R.success('创建后的组织节点', R.org())
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
        tags: ['租户-组织架构'],
        summary: '获取租户组织',
        description: '返回当前租户全部组织节点（扁平列表，按 parentId 组装树），含负责人与用户数',
        query: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['open', 'closed'],
              description: '组织与用户状态，不传默认 open'
            }
          }
        },
        response: R.success('组织节点列表', R.list('组织节点列表', R.org()))
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
        tags: ['租户-组织架构'],
        summary: '删除组织节点',
        description: '组织下仍有用户时不可删除',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '要删除的组织 ID'
            }
          },
          required: ['id']
        },
        response: R.empty()
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
        tags: ['租户-组织架构'],
        summary: '编辑组织节点',
        body: {
          type: 'object',
          properties: {
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
          required: ['id']
        },
        response: R.empty()
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
        tags: ['租户-组织架构'],
        summary: '批量导入组织与用户（JSON，由前端解析 Excel 后提交）',
        description: '在一个事务内批量创建组织与用户，任一行失败整体回滚',
        body: {
          type: 'object',
          properties: {
            parentOrgId: {
              type: 'string',
              description: '锚点组织节点 ID，可选；导入的顶层组织挂在其下，不传则挂在根'
            },
            rows: {
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
            }
          },
          required: ['rows']
        },
        response: R.success('导入结果统计', R.orgImportResult())
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
        tags: ['租户-组织架构'],
        summary: '获取组织关联配置',
        description: '获取当前租户与第三方组织架构（企业微信/钉钉/北森）的关联同步配置',
        response: R.success('组织关联配置', R.orgSyncConfig())
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
        tags: ['租户-组织架构'],
        summary: '保存组织关联配置',
        body: {
          type: 'object',
          properties: {
            source: thirdLoginPlatformProp('同步源'),
            syncInterval: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly', 'yearly', 'off'],
              description: '自动同步周期：daily 每天，weekly 每周，monthly 每月，yearly 每年，off 关闭自动同步'
            },
            targetId: { type: 'string', description: '关联的租户环境变量目标 ID（存放同步源配置）' }
          },
          required: ['source', 'syncInterval', 'targetId']
        },
        response: R.empty()
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
        tags: ['租户-组织架构'],
        summary: '取消组织关联',
        response: R.empty()
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
        tags: ['租户-组织架构'],
        summary: '手动同步组织架构',
        description: '立即按组织关联配置从第三方同步组织与用户',
        response: R.empty()
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
        tags: ['租户-成员'],
        summary: '创建租户用户',
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: '租户用户姓名'
            },
            tenantOrgIds: {
              type: 'array',
              items: { type: 'string' },
              description: '所属组织 ID 列表，可多选'
            },
            avatar: {
              type: 'string',
              description: '头像文件 ID'
            },
            email: {
              type: 'string',
              description: '邮箱，用于发送邀请消息'
            },
            phone: {
              type: 'string',
              description: '手机号，用于发送邀请消息'
            },
            description: {
              type: 'string',
              description: '用户描述'
            }
          },
          required: ['name']
        },
        response: R.empty()
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
        tags: ['租户-成员'],
        summary: '获取租户用户详情',
        query: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '租户用户 ID'
            }
          },
          required: ['id']
        },
        response: R.success('租户用户详情，含所属租户、角色详情与所属组织', R.tenantUser())
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
        tags: ['租户-成员'],
        summary: '编辑租户用户',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '要编辑的租户用户 ID'
            },
            name: {
              type: 'string',
              description: '租户用户姓名'
            },
            tenantOrgIds: {
              type: 'array',
              items: { type: 'string' },
              description: '所属组织 ID 列表，可多选'
            },
            avatar: {
              type: 'string',
              description: '头像文件 ID'
            },
            email: {
              type: 'string',
              description: '邮箱'
            },
            phone: {
              type: 'string',
              description: '手机号'
            },
            description: {
              type: 'string',
              default: '',
              description: '用户描述'
            }
          },
          required: ['id', 'name']
        },
        response: R.empty()
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
        tags: ['租户-成员'],
        summary: '删除租户用户',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '要删除的租户用户 ID'
            }
          },
          required: ['id']
        },
        response: R.empty()
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
        tags: ['租户-成员'],
        summary: '租户用户列表',
        description: '分页查询当前租户的全部用户（不做数据权限过滤）',
        query: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: userListFilterDescription
            },
            ...pageQueryProps()
          }
        },
        response: R.success('租户用户分页列表', R.pageResult('租户用户', R.tenantUser()))
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

  fastify.get(
    `${options.prefix}/user-list-by-data-permission`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-成员'],
        summary: '租户用户列表（数据权限）',
        description: '租户管理员可见全部；普通用户默认本部门及以下（orgSubtree）。传入 moduleCode 或 permissionCode 时合并对应模块共享组数据来源。',
        query: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: userListFilterDescription
            },
            ...pageQueryProps(),
            type: {
              type: 'string',
              enum: ['self', 'owner', 'org', 'orgSubtree'],
              default: 'orgSubtree',
              description: `${dataScopeTypeDescription}，默认 orgSubtree（本部门及以下）`
            },
            moduleCode: {
              type: 'string',
              description: '非空时合并该模块下共享组数据来源'
            },
            permissionCode: {
              type: 'string',
              description: '功能权限码：校验菜单权限，并用于定位模块以合并共享组'
            }
          }
        },
        response: R.success('数据权限范围内的租户用户分页列表', R.pageResult('租户用户', R.tenantUser()))
      }
    },
    async request => {
      const tu = request.tenantUserInfo;
      return await services.user.listByDataPermission(
        Object.assign({}, request.query, {
          tenantId: tu.tenantId,
          currentTenantUserId: tu.id,
          roleDetails: typeof tu.getDataValue === 'function' ? tu.getDataValue('roleDetails') : tu.roleDetails,
          roles: typeof tu.getDataValue === 'function' ? tu.getDataValue('roles') : tu.roles,
          permissions: typeof tu.getDataValue === 'function' ? tu.getDataValue('permissions') : tu.permissions
        })
      );
    }
  );

  fastify.post(
    `${options.prefix}/user-set-status`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
      schema: {
        tags: ['租户-成员'],
        summary: '修改租户用户状态',
        body: {
          type: 'object',
          properties: {
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
          required: ['id', 'status']
        },
        response: R.empty()
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
        tags: ['租户-成员'],
        summary: '获取用户邀请链接',
        description: '生成租户用户的邀请 token，用于拼接加入租户链接',
        query: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '被邀请的租户用户 ID'
            }
          },
          required: ['id']
        },
        response: R.success('邀请信息', R.inviteToken())
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
        tags: ['租户-成员'],
        summary: '发送邀请租户消息',
        description: '向租户用户的邮箱（优先）或手机号发送加入租户邀请',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '被邀请的租户用户 ID'
            }
          },
          required: ['id']
        },
        response: R.empty()
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
        tags: ['租户-组织架构'],
        summary: '发送组织同步消息',
        description: '通过组织关联的第三方渠道（如企业微信）向同步用户发送消息，需宿主实现 sendOrgMessage',
        body: {
          type: 'object',
          properties: {
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
          },
          required: ['userIds', 'content']
        },
        response: R.success('发送结果', R.orgMessageResult())
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
        tags: ['租户-自定义组件'],
        summary: '自定义组件详情',
        description: '按 key 获取当前租户的自定义组件内容',
        query: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: '自定义组件 key'
            }
          },
          required: ['key']
        },
        response: R.success('自定义组件内容', R.customComponent())
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
