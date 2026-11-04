const fp = require('fastify-plugin');
const { Forbidden } = require('http-errors');
const { createError } = require('../utils/intl');
const R = require('../schema/response');

const mfaProperties = () => ({
  enabled: { type: 'boolean', description: '是否开启 MFA，开启后通过 OIDC 登录进入本租户需要短信验证' },
  methods: { type: 'array', items: { type: 'string', enum: ['sms'] }, minItems: 1, description: '验证方式，目前只支持 sms' },
  maxAge: { type: 'integer', minimum: 0, description: 'MFA 有效期（秒），同一登录会话内超过该时长需重新验证，0 表示每次授权都验证' }
});

const mfaConfig = () =>
  R.obj('租户 MFA 配置', {
    enabled: R.bool('是否开启'),
    methods: R.strArray('验证方式'),
    maxAge: R.num('MFA 有效期（秒）')
  });

const MFA_PERMISSION = 'setting:mfa-setting';

module.exports = fp(async (fastify, options) => {
  const { services, authenticate } = fastify[options.name];

  const readValue = (tenantUser, key) => (typeof tenantUser.getDataValue === 'function' ? tenantUser.getDataValue(key) : tenantUser[key]);

  // 租户管理员，或拥有 setting:mfa-setting:{view|edit} 的成员可以操作；有 edit 权限即可查看
  const requireMfaPermission = action => async request => {
    const tenantUser = request[options.tenantUserContextName || 'tenantUserInfo'];
    const permissions = readValue(tenantUser, 'permissions') || [];
    const actions = action === 'view' ? ['view', 'edit'] : [action];
    if (actions.some(item => permissions.includes(`${MFA_PERMISSION}:${item}`))) {
      return;
    }
    const isAdmin = await services.user.resolveIsTenantAdmin({
      tenantId: tenantUser.tenantId,
      roleDetails: readValue(tenantUser, 'roleDetails'),
      roles: readValue(tenantUser, 'roles'),
      currentTenantUserId: tenantUser.id
    });
    if (!isAdmin) {
      throw createError(Forbidden, 'mfaSettingForbidden');
    }
  };

  const scopes = [
    {
      prefix: `${options.prefix}/mfa-setting`,
      tag: '租户-MFA 设置',
      withTenantId: false,
      onRequest: route => [authenticate.user, authenticate.tenantUser, requireMfaPermission(route.action)],
      getTenantId: request => request[options.tenantUserContextName || 'tenantUserInfo'].tenantId
    },
    {
      prefix: `${options.prefix}/admin/mfa-setting`,
      tag: '管理员-MFA 设置',
      withTenantId: true,
      onRequest: () => [options.getUserAuthenticate(), options.getAdminUserAuthenticate()],
      getTenantId: request => (request.method === 'GET' ? request.query : request.body).tenantId
    }
  ];

  const routes = [
    {
      method: 'GET',
      url: 'detail',
      action: 'view',
      summary: '获取租户 MFA 配置',
      description: '未保存过时返回默认值 { enabled: false, methods: ["sms"], maxAge: 86400 }',
      response: R.success('租户 MFA 配置', mfaConfig()),
      handler: tenantId => services.setting.getMfa({ tenantId })
    },
    {
      method: 'POST',
      url: 'save',
      action: 'edit',
      summary: '保存租户 MFA 配置',
      description: '只更新传入的字段；由 fastify-oidc 在登录交互中读取，开启后进入本租户需要短信验证，账号没有手机号时无法进入',
      properties: mfaProperties(),
      response: R.success('保存后的租户 MFA 配置', mfaConfig()),
      handler: (tenantId, body) => services.setting.saveMfa({ tenantId, mfa: body })
    }
  ];

  scopes.forEach(scope => {
    routes.forEach(route => {
      const properties = Object.assign(scope.withTenantId ? { tenantId: { type: 'string', description: '租户 ID' } } : {}, route.properties || {});
      const required = scope.withTenantId ? ['tenantId'] : [];
      const inputSchema = Object.keys(properties).length ? { type: 'object', properties, ...(required.length ? { required } : {}) } : null;
      fastify.route({
        method: route.method,
        url: `${scope.prefix}/${route.url}`,
        onRequest: scope.onRequest(route),
        schema: Object.assign({ tags: [scope.tag], summary: route.summary, description: route.description, response: route.response }, inputSchema ? (route.method === 'GET' ? { querystring: inputSchema } : { body: inputSchema }) : {}),
        handler: async request => {
          const input = Object.assign({}, route.method === 'GET' ? request.query : request.body);
          delete input.tenantId;
          return await route.handler(scope.getTenantId(request), input);
        }
      });
    });
  });
});
