const fp = require('fastify-plugin');
const { createError } = require('../utils/intl');

const SMTP_FIELDS = ['enabled', 'host', 'port', 'secure', 'user', 'fromName', 'fromAddress'];
const EMAIL_TYPE = 0;
const TEMPLATE_PAGE_SIZE = 1000;

const pickFields = (source, fields) =>
  fields.reduce((result, key) => {
    if (source[key] !== undefined) result[key] = source[key];
    return result;
  }, {});

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const excludeMessageCodes = options.excludeMessageCodes || [];

  const getMessageServices = () => {
    if (!fastify.message?.services?.template) {
      throw createError(null, 'messagePluginNotRegistered');
    }
    return fastify.message.services;
  };

  const assertTenant = async tenantId => {
    const tenant = await models.tenant.findByPk(tenantId);
    if (!tenant) {
      throw createError(null, 'tenantNotFound');
    }
    return tenant;
  };

  const findSmtpConfig = tenantId => models.smtpConfig.findOne({ where: { tenantId } });

  const toPublicSmtpConfig = record => {
    if (!record) {
      return { configured: false, enabled: false, port: 465, secure: true, hasPassword: false };
    }
    return Object.assign(pickFields(record, SMTP_FIELDS), { configured: true, hasPassword: !!record.pass });
  };

  const toEmailConfig = source => pickFields(source, ['host', 'port', 'secure', 'user', 'pass', 'fromName', 'fromAddress']);

  // 密码只写不读，返回 hasPassword 表示是否已保存
  const getSmtpConfig = async ({ tenantId }) => {
    await assertTenant(tenantId);
    return toPublicSmtpConfig(await findSmtpConfig(tenantId));
  };

  // pass 为空时保留原密码
  const saveSmtpConfig = async ({ tenantId, pass, ...data }) => {
    await assertTenant(tenantId);
    const fields = pickFields(data, SMTP_FIELDS);
    if (pass) {
      fields.pass = pass;
    }
    const current = await findSmtpConfig(tenantId);
    if (current) {
      await current.update(fields);
      return toPublicSmtpConfig(current);
    }
    if (!fields.pass) {
      throw createError(null, 'smtpPasswordRequired');
    }
    return toPublicSmtpConfig(await models.smtpConfig.create(Object.assign({ tenantId }, fields)));
  };

  const removeSmtpConfig = async ({ tenantId }) => {
    await assertTenant(tenantId);
    const current = await findSmtpConfig(tenantId);
    if (current) {
      await current.destroy();
    }
  };

  // 测试表单中的配置（未保存也可测试）；密码未填时使用已保存的密码
  const testSmtpConfig = async ({ tenantId, to, ...data }) => {
    const tenant = await assertTenant(tenantId);
    const current = await findSmtpConfig(tenantId);
    const config = Object.assign({}, current ? toEmailConfig(current) : {}, toEmailConfig(pickFields(data, [...SMTP_FIELDS, 'pass'])));
    if (!data.pass && current) {
      config.pass = current.pass;
    }
    if (!config.host) {
      throw createError(null, 'smtpHostRequired');
    }
    return await getMessageServices().verifyEmailConfig({
      config,
      to,
      subject: `${tenant.name} SMTP Test`,
      html: `<p>${tenant.name}: SMTP OK</p>`
    });
  };

  // 供 fastify-message 的 getEmailConfig 使用：只返回启用中的完整配置（含密码），不要通过接口返回
  const resolveEmailConfig = async ({ tenantId }) => {
    if (!tenantId) {
      return null;
    }
    const current = await findSmtpConfig(tenantId);
    if (!current || !current.enabled || !current.host) {
      return null;
    }
    return toEmailConfig(current);
  };

  const listTemplates = async filter => (await getMessageServices().template.list({ filter: Object.assign({ type: EMAIL_TYPE }, filter), perPage: TEMPLATE_PAGE_SIZE })).pageData;

  // 全局邮件模版按编码分组，取当前生效的一条：启用的优先，同为启用 / 停用时业务模版优先
  const getSystemTemplates = async () => {
    const result = new Map();
    for (const tpl of await listTemplates({ tenantId: '' })) {
      if (excludeMessageCodes.includes(tpl.code)) continue;
      const current = result.get(tpl.code);
      const rank = item => (Number(item.status) === 0 ? 10 : 0) + Number(item.level);
      if (!current || rank(tpl) > rank(current)) {
        result.set(tpl.code, tpl);
      }
    }
    return result;
  };

  const getSystemTemplate = async code => {
    const tpl = (await getSystemTemplates()).get(code);
    if (!tpl) {
      throw createError(null, 'mailTemplateNotFound', { code });
    }
    return tpl;
  };

  const findTenantTemplate = async ({ tenantId, code }) => (await listTemplates({ tenantId: String(tenantId), code, level: 1 }))[0] || null;

  const getTenantTemplate = async ({ tenantId, code }) => {
    const tpl = await findTenantTemplate({ tenantId, code });
    if (!tpl) {
      throw createError(null, 'mailTemplateNotCustomized', { code });
    }
    return tpl;
  };

  const templateList = async ({ tenantId }) => {
    await assertTenant(tenantId);
    const systemTemplates = await getSystemTemplates();
    const tenantTemplates = new Map((await listTemplates({ tenantId: String(tenantId), level: 1 })).map(item => [item.code, item]));
    return {
      list: [...systemTemplates.values()].map(tpl => {
        const own = tenantTemplates.get(tpl.code);
        return {
          code: tpl.code,
          name: tpl.name,
          description: tpl.description,
          systemTemplateId: tpl.id,
          customized: !!own,
          templateId: own ? own.id : null,
          status: own ? Number(own.status) : null,
          updatedAt: own ? own.updatedAt : null
        };
      })
    };
  };

  // 已自定义返回租户模版，否则返回当前生效的全局模版
  const templateDetail = async ({ tenantId, code }) => {
    await assertTenant(tenantId);
    const systemTemplate = await getSystemTemplate(code);
    const own = await findTenantTemplate({ tenantId, code });
    return { customized: !!own, template: own || systemTemplate };
  };

  // 把全局模版复制为本租户的模版并启用；已自定义时直接返回
  const templateCustomize = async ({ tenantId, code }) => {
    await assertTenant(tenantId);
    const systemTemplate = await getSystemTemplate(code);
    const own = await findTenantTemplate({ tenantId, code });
    if (own) {
      return own;
    }
    const { template } = getMessageServices();
    const copied = await template.copy({ id: systemTemplate.id, tenantId: String(tenantId) });
    await template.save({ id: copied.id, name: systemTemplate.name });
    return await template.setStatus({ id: copied.id, status: 0 });
  };

  const templateSave = async ({ tenantId, code, ...data }) => {
    await assertTenant(tenantId);
    const own = await getTenantTemplate({ tenantId, code });
    return await getMessageServices().template.save(Object.assign({ id: own.id }, pickFields(data, ['name', 'subject', 'content', 'description', 'variables', 'extra'])));
  };

  const templateSetStatus = async ({ tenantId, code, status }) => {
    await assertTenant(tenantId);
    const own = await getTenantTemplate({ tenantId, code });
    return await getMessageServices().template.setStatus({ id: own.id, status });
  };

  // 删除租户模版，恢复使用全局模版
  const templateReset = async ({ tenantId, code }) => {
    await assertTenant(tenantId);
    const own = await findTenantTemplate({ tenantId, code });
    if (own) {
      await getMessageServices().template.remove({ id: own.id });
    }
  };

  // 传 template 时预览未保存的内容，否则预览当前生效的模版
  const templatePreview = async ({ tenantId, code, template, props }) => {
    const { template: current } = await templateDetail({ tenantId, code });
    const target = template ? Object.assign({ type: EMAIL_TYPE, variables: current.variables }, template) : null;
    return await getMessageServices().template.render(target ? { template: target, props } : { templateId: current.id, props });
  };

  Object.assign(fastify[options.name].services, {
    mail: {
      getSmtpConfig,
      saveSmtpConfig,
      removeSmtpConfig,
      testSmtpConfig,
      resolveEmailConfig,
      templateList,
      templateDetail,
      templateCustomize,
      templateSave,
      templateSetStatus,
      templateReset,
      templatePreview
    }
  });
});
