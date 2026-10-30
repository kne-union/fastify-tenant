'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');

const NS = 'tenantMail';

// fastify-message 模版服务的内存实现，只覆盖 services.mail 用到的方法
function createMessageServices() {
  const templates = [];
  let seq = 1;
  const find = id => {
    const tpl = templates.find(item => item.id === id);
    if (!tpl) throw Object.assign(new Error('模版不存在'), { statusCode: 404 });
    return tpl;
  };
  const verified = [];
  return {
    templates,
    verified,
    add: data => {
      const tpl = Object.assign({ id: `tpl_${seq++}`, type: 0, level: 0, status: 0, tenantId: '' }, data);
      templates.push(tpl);
      return tpl;
    },
    services: {
      verifyEmailConfig: async payload => {
        verified.push(payload);
        return { success: true };
      },
      template: {
        list: async ({ filter }) => ({
          pageData: templates.filter(tpl => Object.keys(filter).every(key => tpl[key] === filter[key]))
        }),
        copy: async ({ id, tenantId }) => {
          const source = find(id);
          const tpl = Object.assign({}, source, { id: `tpl_${seq++}`, level: 1, status: 1, tenantId, name: `${source.name}（副本）` });
          templates.push(tpl);
          return tpl;
        },
        save: async ({ id, ...data }) => Object.assign(find(id), data),
        setStatus: async ({ id, status }) => Object.assign(find(id), { status }),
        remove: async ({ id }) => {
          templates.splice(templates.indexOf(find(id)), 1);
          return {};
        },
        render: async ({ templateId, template, props }) => {
          const target = template || find(templateId);
          return { subject: target.subject, html: target.content, props };
        }
      }
    }
  };
}

async function buildServiceApp({ excludeMessageCodes = [] } = {}) {
  const fastify = Fastify({ logger: false });
  const tenants = new Map([['t1', { id: 't1', name: 'Acme' }]]);
  const configs = new Map();
  const models = {
    tenant: { findByPk: async id => tenants.get(id) || null },
    smtpConfig: {
      findOne: async ({ where }) => configs.get(where.tenantId) || null,
      create: async data => {
        const row = Object.assign({ enabled: true, port: 465, secure: true }, data);
        row.update = async patch => Object.assign(row, patch);
        row.destroy = async () => configs.delete(row.tenantId);
        configs.set(data.tenantId, row);
        return row;
      }
    }
  };
  fastify.decorate(NS, { models, services: {} });
  const message = createMessageServices();
  fastify.decorate('message', { services: message.services });
  await fastify.register(require('../libs/services/mail.js'), { name: NS, excludeMessageCodes });
  await fastify.ready();
  return { fastify, mail: fastify[NS].services.mail, message, configs };
}

describe('services.mail', () => {
  it('SMTP 配置：首次保存必须有密码，返回脱敏；留空密码保留原值；停用后 resolve 为空', async () => {
    const { fastify, mail, configs } = await buildServiceApp();
    try {
      await assert.rejects(() => mail.saveSmtpConfig({ tenantId: 't1', host: 'smtp.a.com', user: 'u@a.com' }), /密码不能为空/);
      const saved = await mail.saveSmtpConfig({ tenantId: 't1', host: 'smtp.a.com', user: 'u@a.com', pass: 'p1', fromName: 'Acme' });
      assert.equal(saved.pass, undefined);
      assert.equal(saved.hasPassword, true);
      assert.equal(saved.configured, true);

      await mail.saveSmtpConfig({ tenantId: 't1', host: 'smtp.b.com', user: 'u@a.com', pass: '' });
      assert.equal(configs.get('t1').pass, 'p1');
      assert.deepEqual(await mail.resolveEmailConfig({ tenantId: 't1' }), { host: 'smtp.b.com', port: 465, secure: true, user: 'u@a.com', pass: 'p1', fromName: 'Acme' });

      await mail.saveSmtpConfig({ tenantId: 't1', enabled: false });
      assert.equal(await mail.resolveEmailConfig({ tenantId: 't1' }), null);

      await mail.removeSmtpConfig({ tenantId: 't1' });
      assert.equal((await mail.getSmtpConfig({ tenantId: 't1' })).configured, false);
      await assert.rejects(() => mail.getSmtpConfig({ tenantId: 'missing' }), /租户不存在/);
    } finally {
      await fastify.close();
    }
  });

  it('测试 SMTP：表单未填密码时使用已保存的密码', async () => {
    const { fastify, mail, message } = await buildServiceApp();
    try {
      await mail.saveSmtpConfig({ tenantId: 't1', host: 'smtp.a.com', user: 'u@a.com', pass: 'saved' });
      await mail.testSmtpConfig({ tenantId: 't1', host: 'smtp.new.com', user: 'u@a.com', to: 'x@b.com' });
      assert.equal(message.verified[0].config.host, 'smtp.new.com');
      assert.equal(message.verified[0].config.pass, 'saved');
      assert.equal(message.verified[0].to, 'x@b.com');
    } finally {
      await fastify.close();
    }
  });

  it('模版：列表排除 excludeMessageCodes，自定义后启用并可停用、恢复默认', async () => {
    const { fastify, mail, message } = await buildServiceApp({ excludeMessageCodes: ['VERIFY'] });
    try {
      message.add({ code: 'INVITETENANT', name: '加入租户邀请', subject: '系统', content: '<p>sys</p>' });
      message.add({ code: 'INVITETENANT', name: '业务版邀请', level: 1, subject: '业务', content: '<p>biz</p>' });
      message.add({ code: 'VERIFY', name: '验证码', subject: 'v', content: 'v' });
      message.add({ code: 'SMS', type: 1, name: '短信', content: 's' });

      let { list } = await mail.templateList({ tenantId: 't1' });
      assert.deepEqual(
        list.map(item => [item.code, item.name, item.customized]),
        [['INVITETENANT', '业务版邀请', false]]
      );

      const own = await mail.templateCustomize({ tenantId: 't1', code: 'INVITETENANT' });
      assert.equal(own.tenantId, 't1');
      assert.equal(own.status, 0);
      assert.equal(own.name, '业务版邀请');
      assert.equal(own.subject, '业务');
      assert.equal((await mail.templateCustomize({ tenantId: 't1', code: 'INVITETENANT' })).id, own.id);

      await mail.templateSave({ tenantId: 't1', code: 'INVITETENANT', subject: '租户', content: '<p>t</p>' });
      const detail = await mail.templateDetail({ tenantId: 't1', code: 'INVITETENANT' });
      assert.equal(detail.customized, true);
      assert.equal(detail.template.subject, '租户');

      const preview = await mail.templatePreview({ tenantId: 't1', code: 'INVITETENANT', template: { subject: '未保存', content: 'x' }, props: { a: 1 } });
      assert.equal(preview.subject, '未保存');

      await mail.templateSetStatus({ tenantId: 't1', code: 'INVITETENANT', status: 1 });
      ({ list } = await mail.templateList({ tenantId: 't1' }));
      assert.equal(list[0].customized, true);
      assert.equal(list[0].status, 1);

      await mail.templateReset({ tenantId: 't1', code: 'INVITETENANT' });
      assert.equal((await mail.templateDetail({ tenantId: 't1', code: 'INVITETENANT' })).customized, false);

      await assert.rejects(() => mail.templateCustomize({ tenantId: 't1', code: 'VERIFY' }), /不存在/);
      await assert.rejects(() => mail.templateSave({ tenantId: 't1', code: 'INVITETENANT', subject: 's' }), /尚未自定义/);
    } finally {
      await fastify.close();
    }
  });

  it('未注册 fastify-message 时模版接口报错', async () => {
    const fastify = Fastify({ logger: false });
    fastify.decorate(NS, { models: { tenant: { findByPk: async () => ({ id: 't1' }) }, smtpConfig: {} }, services: {} });
    await fastify.register(require('../libs/services/mail.js'), { name: NS });
    await fastify.ready();
    try {
      await assert.rejects(() => fastify[NS].services.mail.templateList({ tenantId: 't1' }), /未注册 fastify-message/);
    } finally {
      await fastify.close();
    }
  });
});

describe('mail-setting 路由', () => {
  const prefix = '/api/tenant';

  async function buildControllerApp({ permissions = [], isAdmin = false } = {}) {
    const fastify = Fastify({ logger: false });
    const calls = [];
    const record = name => async payload => {
      calls.push([name, payload]);
      return { success: true };
    };
    fastify.decorate(NS, {
      services: {
        user: { resolveIsTenantAdmin: async () => isAdmin },
        mail: {
          getSmtpConfig: record('getSmtpConfig'),
          saveSmtpConfig: record('saveSmtpConfig'),
          removeSmtpConfig: record('removeSmtpConfig'),
          testSmtpConfig: record('testSmtpConfig'),
          templateList: async payload => {
            calls.push(['templateList', payload]);
            return { list: [] };
          },
          templateDetail: record('templateDetail'),
          templateCustomize: record('templateCustomize'),
          templateSave: record('templateSave'),
          templateSetStatus: record('templateSetStatus'),
          templateReset: record('templateReset'),
          templatePreview: record('templatePreview')
        }
      },
      authenticate: {
        user: async () => {},
        tenantUser: async request => {
          request.tenantUserInfo = { id: 'tu-1', tenantId: 'tid-1', permissions };
        }
      }
    });
    await fastify.register(require('../libs/controllers/mail-setting.js'), {
      name: NS,
      prefix,
      getUserAuthenticate: () => async () => {},
      getAdminUserAuthenticate: () => async () => {}
    });
    await fastify.ready();
    return { fastify, calls };
  }

  it('租户端：无权限 403，只有 view 权限时可查看不可修改', async () => {
    let { fastify } = await buildControllerApp();
    try {
      const res = await fastify.inject({ method: 'GET', url: `${prefix}/mail-setting/smtp-detail` });
      assert.equal(res.statusCode, 403);
    } finally {
      await fastify.close();
    }

    let calls;
    ({ fastify, calls } = await buildControllerApp({ permissions: ['setting:mail-setting:view'] }));
    try {
      assert.equal((await fastify.inject({ method: 'GET', url: `${prefix}/mail-setting/template-list` })).statusCode, 200);
      assert.deepEqual(calls[0], ['templateList', { tenantId: 'tid-1' }]);
      const res = await fastify.inject({ method: 'POST', url: `${prefix}/mail-setting/smtp-save`, payload: { host: 'h', user: 'u' } });
      assert.equal(res.statusCode, 403);
    } finally {
      await fastify.close();
    }
  });

  it('租户端：租户管理员可修改，tenantId 取自登录态', async () => {
    const { fastify, calls } = await buildControllerApp({ isAdmin: true });
    try {
      const res = await fastify.inject({ method: 'POST', url: `${prefix}/mail-setting/smtp-save`, payload: { tenantId: 'other', host: 'h', user: 'u', pass: 'p' } });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(calls[0], ['saveSmtpConfig', { host: 'h', user: 'u', pass: 'p', tenantId: 'tid-1' }]);
      assert.equal((await fastify.inject({ method: 'POST', url: `${prefix}/mail-setting/smtp-remove` })).statusCode, 200);
      const status = await fastify.inject({ method: 'POST', url: `${prefix}/mail-setting/template-set-status`, payload: { code: 'A', status: 1 } });
      assert.equal(status.statusCode, 200);
      assert.deepEqual(calls[2], ['templateSetStatus', { tenantId: 'tid-1', code: 'A', status: 1 }]);
    } finally {
      await fastify.close();
    }
  });

  it('管理端：必须传 tenantId', async () => {
    const { fastify, calls } = await buildControllerApp();
    try {
      assert.equal((await fastify.inject({ method: 'GET', url: `${prefix}/admin/mail-setting/smtp-detail` })).statusCode, 400);
      assert.equal((await fastify.inject({ method: 'GET', url: `${prefix}/admin/mail-setting/template-detail?tenantId=t9&code=A` })).statusCode, 200);
      assert.deepEqual(calls[0], ['templateDetail', { tenantId: 't9', code: 'A' }]);
      const res = await fastify.inject({ method: 'POST', url: `${prefix}/admin/mail-setting/template-customize`, payload: { tenantId: 't9', code: 'A' } });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(calls[1], ['templateCustomize', { tenantId: 't9', code: 'A' }]);
    } finally {
      await fastify.close();
    }
  });
});
