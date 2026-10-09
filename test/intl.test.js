'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { locale, createError, createBusinessError, createTranslator } = require('../libs/utils/intl');
const { normalizeImportRows } = require('../libs/utils/orgImportRows');
const mergePermissions = require('../libs/utils/mergePermissions');

const NAME = 'tenantIntlTest';

// @kne/fastify-intl 依赖 ESM-only 的 @formatjs/intl，Node 18 等不支持 require(esm) 的版本无法加载
const itWithIntl = (() => {
  try {
    require('@kne/fastify-intl');
    return it;
  } catch (e) {
    if (e.code === 'ERR_REQUIRE_ESM') return it.skip;
    throw e;
  }
})();

const buildApp = async ({ intl = true } = {}) => {
  const fastify = Fastify({ logger: false });
  if (intl) {
    await fastify.register(require('@kne/fastify-intl'), { defaultLocale: 'zh-CN' });
  }
  await fastify.register(require('@kne/fastify-namespace'), { name: NAME, options: { name: NAME }, modules: [['locale', locale]] });
  const translator = createTranslator({ fastify, options: { name: NAME, intlNamespace: 'intl' } });
  fastify.addHook('onError', translator.onError);
  fastify.get('/tenant', async () => {
    throw createError(null, 'tenantNotFound');
  });
  fastify.get('/setting', async () => {
    throw createError(null, 'settingKeyNotFound', { key: 'theme' });
  });
  fastify.get('/import', async () => {
    normalizeImportRows([{ rowType: 'user', orgName: 'A', userName: 'u', phone: '+86' }]);
  });
  fastify.get('/role', async () => {
    throw createBusinessError('ROLE_NOT_FOUND', 'roleNotFound', null, 404);
  });
  fastify.get('/foreign', async () => {
    throw Object.assign(new Error('其他插件的错误'), { messageScope: '@kne/fastify-account', messageId: 'tenantNotFound' });
  });
  await fastify.ready();
  return fastify;
};

const message = async (app, url, lang) => {
  const response = await app.inject({ method: 'GET', url, headers: lang ? { 'accept-language': lang } : {} });
  return { status: response.statusCode, message: response.json().message };
};

describe('国际化', () => {
  it('中英文语言包 key 与占位符一致', () => {
    const zh = locale['zh-CN'];
    const en = locale['en-US'];
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
    const placeholders = text => (text.match(/\{\w+\}/g) || []).sort();
    for (const key of Object.keys(zh)) {
      assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), key);
    }
  });

  it('未翻译时错误文案为内置中文', () => {
    const error = createError(null, 'settingKeyNotFound', { key: 'theme' });
    assert.equal(error.message, 'theme已不存在');
    assert.equal(error.messageId, 'settingKeyNotFound');
    assert.throws(() => normalizeImportRows([{ rowType: 'user', orgName: 'A', userName: 'u', phone: '+86' }]), { message: '第 1 条：手机号格式不正确' });
  });

  itWithIntl('按请求语言翻译错误', async () => {
    const app = await buildApp();
    try {
      assert.deepEqual(await message(app, '/tenant', 'en-US'), { status: 500, message: 'Tenant does not exist' });
      assert.deepEqual(await message(app, '/tenant', 'zh-CN'), { status: 500, message: '租户不存在' });
      assert.deepEqual(await message(app, '/setting', 'en-US'), { status: 500, message: 'theme no longer exists' });
      assert.deepEqual(await message(app, '/role', 'en-US'), { status: 404, message: 'Role does not exist' });
      assert.deepEqual(await message(app, '/tenant', 'ja-JP'), { status: 500, message: '租户不存在' });
    } finally {
      await app.close();
    }
  });

  itWithIntl('包装的底层错误一并翻译', async () => {
    const app = await buildApp();
    try {
      assert.equal((await message(app, '/import', 'en-US')).message, 'Row 1: Invalid phone number format');
      assert.equal((await message(app, '/import', 'zh-CN')).message, '第 1 条：手机号格式不正确');
    } finally {
      await app.close();
    }
  });

  itWithIntl('不翻译其他插件的错误', async () => {
    const app = await buildApp();
    try {
      assert.equal((await message(app, '/foreign', 'en-US')).message, '其他插件的错误');
    } finally {
      await app.close();
    }
  });

  itWithIntl('按请求语言翻译权限树名称，未配置翻译的权限保留原名', async () => {
    const fastify = Fastify({ logger: false });
    await fastify.register(require('@kne/fastify-intl'), { defaultLocale: 'zh-CN' });
    await fastify.register(require('@kne/fastify-namespace'), { name: NAME, options: { name: NAME }, modules: [['locale', locale]] });
    const translator = createTranslator({ fastify, options: { name: NAME, intlNamespace: 'intl' } });
    const permissions = mergePermissions(require('../libs/permissions'), {
      modules: [{ name: '业务模块', code: 'biz', permissions: [{ name: '审批', code: 'approve' }] }]
    });
    fastify.get('/permissions', async request => translator.withTranslatedPermissions(request, { codes: ['setting'], permissions }));
    await fastify.ready();
    try {
      const response = await fastify.inject({ method: 'GET', url: '/permissions', headers: { 'accept-language': 'en-US' } });
      const { codes, permissions: translated } = response.json();
      assert.deepEqual(codes, ['setting']);
      const setting = translated.modules.find(item => item.code === 'setting');
      assert.equal(setting.name, 'Settings');
      const role = setting.modules.find(item => item.code === 'permission').modules.find(item => item.code === 'role');
      assert.equal(role.name, 'Roles');
      assert.deepEqual(
        role.permissions.map(item => item.name),
        ['Create', 'View', 'Edit', 'Delete']
      );
      const biz = translated.modules.find(item => item.code === 'biz');
      assert.equal(biz.name, '业务模块');
      assert.equal(biz.permissions[0].name, '审批');
      assert.equal(require('../libs/permissions').modules[0].name, '设置');
    } finally {
      await fastify.close();
    }
  });

  it('未注册 fastify-intl 时权限树原样返回', async () => {
    const fastify = Fastify({ logger: false });
    const translator = createTranslator({ fastify, options: { name: NAME, intlNamespace: 'intl' } });
    const result = { codes: [], permissions: require('../libs/permissions') };
    assert.equal(await translator.withTranslatedPermissions({}, result), result);
  });

  it('未注册 fastify-intl 时回退中文', async () => {
    const app = await buildApp({ intl: false });
    try {
      assert.equal((await message(app, '/tenant', 'en-US')).message, '租户不存在');
    } finally {
      await app.close();
    }
  });
});
