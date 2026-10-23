'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');

const buildApp = async () => {
  const fastify = Fastify({ logger: false });
  await fastify.register(require('@kne/fastify-sequelize'), { db: { dialect: 'sqlite', storage: ':memory:', logging: false }, sqlPath: './test/__no_sql__' });
  await fastify.register(require('@kne/fastify-account'), {});
  await fastify.register(require('../index'), { permissionsProfile: null });
  await fastify.ready();
  await fastify.sequelize.sync();
  return fastify;
};

const createAccountUser = async (fastify, id) => {
  const account = await fastify.account.models.userAccount.create({ password: 'x', salt: 'y' });
  return fastify.account.models.user.create({ id, nickname: `u-${id}`, status: 0, userAccountId: account.id }, { hooks: false });
};

const createLocalTenant = (fastify, name) =>
  fastify.tenant.services.tenant.create({
    name,
    description: '',
    accountCount: 20,
    supportLanguage: ['zh-CN'],
    defaultLanguage: 'zh-CN',
    serviceStartTime: new Date().toISOString(),
    serviceEndTime: new Date(Date.now() + 86400000).toISOString()
  });

describe('user.tenantList（sqlite）', () => {
  let fastify;

  before(async () => {
    fastify = await buildApp();
    await createAccountUser(fastify, 'acc-1');
  });

  after(async () => {
    await fastify.close();
  });

  it('不返回已关闭或已删除租户下的成员记录', async () => {
    const { models, services } = fastify.tenant;
    const openTenant = await createLocalTenant(fastify, '开启租户');
    const closedTenant = await createLocalTenant(fastify, '关闭租户');
    const removedTenant = await createLocalTenant(fastify, '删除租户');
    for (const tenant of [openTenant, closedTenant, removedTenant]) {
      await models.user.create({ tenantId: tenant.id, userId: 'acc-1', name: '张三', status: 'open' });
    }
    await services.tenant.setStatus({ id: closedTenant.id, status: 'closed' });
    await removedTenant.destroy();

    const { list } = await services.user.tenantList({ id: 'acc-1' });
    assert.deepEqual(
      list.map(item => item.tenantId),
      [openTenant.id]
    );
    assert.equal(list[0].tenant.name, '开启租户');
  });
});
