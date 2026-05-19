'use strict';

const assert = require('node:assert/strict');
const { buildServiceApp } = require('./support/service-app');

/**
 * 回归：生产环境 @kne/fastify-sequelize 的 fastify.sequelize 是包装对象，
 * transaction 只在 fastify.sequelize.instance 上，不在包装对象本身。
 * 旧实现误用 fastify.sequelize.transaction() 会在生产 500，但测试 mock 把 transaction 挂在包装对象上会误通过。
 */
describe('org.importFromRows 与 fastify-sequelize 契约', () => {
  let ctx;
  let tenantId;

  before(async () => {
    ctx = await buildServiceApp();
    const t = await ctx.ns.services.tenant.create({
      name: 'CoSeq',
      description: '',
      logo: 'l',
      themeColor: '#000',
      accountCount: 20,
      supportLanguage: ['zh-CN'],
      defaultLanguage: 'zh-CN',
      serviceStartTime: new Date().toISOString(),
      serviceEndTime: new Date().toISOString()
    });
    tenantId = t.id;

    const { Sequelize, instance } = ctx.fastify.sequelize;
    ctx.fastify.sequelize = { Sequelize, instance };
  });

  after(async () => {
    await ctx.fastify.close();
  });

  it('在仅 instance 提供 transaction 时仍能导入', async () => {
    assert.equal(typeof ctx.fastify.sequelize.transaction, 'undefined');
    assert.equal(typeof ctx.fastify.sequelize.instance.transaction, 'function');

    const r = await ctx.ns.services.org.importFromRows({
      tenantId,
      parentOrgId: null,
      rows: [
        {
          rowType: 'org',
          orgName: '契约测试部门',
          parentOrgName: null,
          userName: null,
          email: null,
          phone: null,
          description: null,
          isLeader: false
        }
      ]
    });

    assert.equal(r.createdOrgs, 1);
    assert.equal(r.rowCount, 1);
  });
});
