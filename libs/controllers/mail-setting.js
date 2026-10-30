const fp = require('fastify-plugin');
const { Forbidden } = require('http-errors');
const { createError } = require('../utils/intl');
const R = require('../schema/response');

const smtpProperties = () => ({
  enabled: { type: 'boolean', description: '是否启用租户 SMTP，关闭后使用系统邮箱发送' },
  host: { type: 'string', description: 'SMTP 服务器地址' },
  port: { type: 'integer', description: 'SMTP 端口，默认 465' },
  secure: { type: 'boolean', description: '是否使用 SSL/TLS，默认 true' },
  user: { type: 'string', description: 'SMTP 账号' },
  pass: { type: 'string', description: 'SMTP 密码 / 授权码；留空表示不修改' },
  fromName: { type: 'string', description: '发件人名称' },
  fromAddress: { type: 'string', description: '发件人地址，为空时使用 SMTP 账号' }
});

const codeProp = () => ({ type: 'string', description: '邮件模版编码' });

const templateBodyProperties = () => ({
  name: { type: 'string', description: '模版名称' },
  subject: { type: 'string', description: '邮件主题（Liquid）' },
  content: { type: 'string', description: '邮件正文 HTML（Liquid）' },
  description: { type: 'string', description: '模版描述' },
  variables: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '模版变量 [{ name, label, example }]' }
});

const smtpConfig = () =>
  R.obj('租户 SMTP 配置（不返回密码）', {
    configured: R.bool('是否已保存过配置'),
    enabled: R.bool('是否启用'),
    host: R.str('SMTP 服务器地址'),
    port: R.num('SMTP 端口'),
    secure: R.bool('是否使用 SSL/TLS'),
    user: R.str('SMTP 账号'),
    fromName: R.str('发件人名称'),
    fromAddress: R.str('发件人地址'),
    hasPassword: R.bool('是否已保存密码')
  });

const template = () => R.obj('邮件模版（fastify-message 模版）', { id: R.any('模版 ID'), code: R.str('模版编码'), tenantId: R.str('所属租户，空字符串为全局模版') });

const templateList = () =>
  R.obj('邮件模版列表', {
    list: R.list(
      '可自定义的邮件模版',
      R.obj('邮件模版', {
        code: R.str('模版编码'),
        name: R.str('模版名称'),
        description: R.str('模版描述'),
        systemTemplateId: R.any('当前生效的全局模版 ID'),
        customized: R.bool('本租户是否已自定义'),
        templateId: R.any('租户模版 ID，未自定义时为空'),
        status: R.num('租户模版状态：0 启用，1 停用；未自定义时为空'),
        updatedAt: R.any('租户模版更新时间')
      })
    )
  });

const MAIL_PERMISSION = 'setting:mail-setting';

module.exports = fp(async (fastify, options) => {
  const { services, authenticate } = fastify[options.name];

  const readValue = (tenantUser, key) => (typeof tenantUser.getDataValue === 'function' ? tenantUser.getDataValue(key) : tenantUser[key]);

  // 租户管理员或拥有 setting:mail-setting 对应权限的成员可以操作；有 edit 权限即可查看
  const requireMailPermission = action => async request => {
    const tenantUser = request[options.tenantUserContextName || 'tenantUserInfo'];
    const permissions = readValue(tenantUser, 'permissions') || [];
    if (permissions.includes(`${MAIL_PERMISSION}:${action}`) || (action === 'view' && permissions.includes(`${MAIL_PERMISSION}:edit`))) {
      return;
    }
    const isAdmin = await services.user.resolveIsTenantAdmin({
      tenantId: tenantUser.tenantId,
      roleDetails: readValue(tenantUser, 'roleDetails'),
      roles: readValue(tenantUser, 'roles'),
      currentTenantUserId: tenantUser.id
    });
    if (!isAdmin) {
      throw createError(Forbidden, 'mailSettingForbidden');
    }
  };

  const scopes = [
    {
      prefix: `${options.prefix}/mail-setting`,
      tag: '租户-邮件设置',
      withTenantId: false,
      onRequest: action => [authenticate.user, authenticate.tenantUser, requireMailPermission(action)],
      getTenantId: request => request[options.tenantUserContextName || 'tenantUserInfo'].tenantId
    },
    {
      prefix: `${options.prefix}/admin/mail-setting`,
      tag: '管理员-邮件设置',
      withTenantId: true,
      onRequest: () => [options.getUserAuthenticate(), options.getAdminUserAuthenticate()],
      getTenantId: request => (request.method === 'GET' ? request.query : request.body).tenantId
    }
  ];

  const routes = [
    {
      method: 'GET',
      url: 'smtp-detail',
      action: 'view',
      summary: '获取租户 SMTP 配置',
      response: R.success('租户 SMTP 配置', smtpConfig()),
      handler: tenantId => services.mail.getSmtpConfig({ tenantId })
    },
    {
      method: 'POST',
      url: 'smtp-save',
      action: 'edit',
      summary: '保存租户 SMTP 配置',
      description: '启用后本租户的邮件（调用 sendMessage 时传 tenantId）通过该 SMTP 发送；密码留空表示不修改，首次保存必填',
      properties: smtpProperties(),
      required: ['host', 'user'],
      response: R.success('保存后的 SMTP 配置', smtpConfig()),
      handler: (tenantId, body) => services.mail.saveSmtpConfig(Object.assign({}, body, { tenantId }))
    },
    {
      method: 'POST',
      url: 'smtp-remove',
      action: 'edit',
      summary: '清除租户 SMTP 配置',
      description: '清除后本租户邮件恢复使用系统邮箱发送',
      response: R.empty(),
      handler: async tenantId => {
        await services.mail.removeSmtpConfig({ tenantId });
        return {};
      }
    },
    {
      method: 'POST',
      url: 'smtp-test',
      action: 'edit',
      summary: '测试租户 SMTP 配置',
      description: '用表单中的配置（未保存也可）连接 SMTP 并登录，传 to 时再发送一封测试邮件；密码留空时使用已保存的密码',
      properties: Object.assign(smtpProperties(), { to: { type: 'string', description: '测试邮件收件人' } }),
      response: R.success('测试结果', R.obj('测试结果', { success: R.bool('是否成功') })),
      handler: (tenantId, body) => services.mail.testSmtpConfig(Object.assign({}, body, { tenantId }))
    },
    {
      method: 'GET',
      url: 'template-list',
      action: 'view',
      summary: '获取可自定义的邮件模版列表',
      description: '列出全局邮件模版（不含 excludeMessageCodes），并标记本租户是否已自定义',
      response: R.success('邮件模版列表', templateList()),
      handler: tenantId => services.mail.templateList({ tenantId })
    },
    {
      method: 'GET',
      url: 'template-detail',
      action: 'view',
      summary: '获取邮件模版详情',
      description: '已自定义时返回租户模版，否则返回当前生效的全局模版',
      properties: { code: codeProp() },
      required: ['code'],
      response: R.success('邮件模版详情', R.obj('邮件模版详情', { customized: R.bool('是否已自定义'), template: template() })),
      handler: (tenantId, query) => services.mail.templateDetail({ tenantId, code: query.code })
    },
    {
      method: 'POST',
      url: 'template-customize',
      action: 'edit',
      summary: '自定义邮件模版',
      description: '把全局模版复制为本租户模版并启用；已自定义时直接返回',
      properties: { code: codeProp() },
      required: ['code'],
      response: R.success('租户模版', template()),
      handler: (tenantId, body) => services.mail.templateCustomize({ tenantId, code: body.code })
    },
    {
      method: 'POST',
      url: 'template-save',
      action: 'edit',
      summary: '保存租户邮件模版',
      properties: Object.assign({ code: codeProp() }, templateBodyProperties()),
      required: ['code'],
      response: R.success('保存后的租户模版', template()),
      handler: (tenantId, body) => services.mail.templateSave(Object.assign({}, body, { tenantId }))
    },
    {
      method: 'POST',
      url: 'template-set-status',
      action: 'edit',
      summary: '启用 / 停用租户邮件模版',
      description: '停用后本租户使用全局模版',
      properties: { code: codeProp(), status: { type: 'integer', enum: [0, 1], description: '0 启用，1 停用' } },
      required: ['code', 'status'],
      response: R.success('更新后的租户模版', template()),
      handler: (tenantId, body) => services.mail.templateSetStatus({ tenantId, code: body.code, status: body.status })
    },
    {
      method: 'POST',
      url: 'template-reset',
      action: 'edit',
      summary: '恢复默认邮件模版',
      description: '删除本租户模版，恢复使用全局模版',
      properties: { code: codeProp() },
      required: ['code'],
      response: R.empty(),
      handler: async (tenantId, body) => {
        await services.mail.templateReset({ tenantId, code: body.code });
        return {};
      }
    },
    {
      method: 'POST',
      url: 'template-preview',
      action: 'view',
      summary: '预览邮件模版',
      description: '传 template 时预览未保存的内容，否则预览当前生效的模版；props 与变量示例值合并',
      properties: {
        code: codeProp(),
        template: { type: 'object', additionalProperties: true, properties: templateBodyProperties(), description: '未保存的模版内容' },
        props: { type: 'object', additionalProperties: true, description: '模版变量' }
      },
      required: ['code'],
      response: R.success('渲染结果', R.obj('渲染结果', { subject: R.str('邮件主题'), html: R.str('邮件 HTML'), text: R.str('纯文本'), props: R.any('实际使用的变量') })),
      handler: (tenantId, body) => services.mail.templatePreview({ tenantId, code: body.code, template: body.template, props: body.props })
    }
  ];

  scopes.forEach(scope => {
    routes.forEach(route => {
      const properties = Object.assign(scope.withTenantId ? { tenantId: { type: 'string', description: '租户 ID' } } : {}, route.properties || {});
      const required = [...(scope.withTenantId ? ['tenantId'] : []), ...(route.required || [])];
      const inputSchema = Object.keys(properties).length ? { type: 'object', properties, ...(required.length ? { required } : {}) } : null;
      fastify.route({
        method: route.method,
        url: `${scope.prefix}/${route.url}`,
        onRequest: scope.onRequest(route.action),
        schema: Object.assign(
          { tags: [scope.tag], summary: route.summary, response: route.response },
          route.description ? { description: route.description } : {},
          inputSchema ? (route.method === 'GET' ? { querystring: inputSchema } : { body: inputSchema }) : {}
        ),
        handler: async request => {
          const input = Object.assign({}, route.method === 'GET' ? request.query : request.body);
          delete input.tenantId;
          return await route.handler(scope.getTenantId(request), input);
        }
      });
    });
  });
});
