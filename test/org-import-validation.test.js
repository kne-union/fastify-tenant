'use strict';

const assert = require('node:assert/strict');
const { buildServiceApp } = require('./support/service-app');

describe('org.importFromRows 校验', () => {
  let ctx;
  let tenantId;

  before(async () => {
    ctx = await buildServiceApp();
    const t = await ctx.ns.services.tenant.create({
      name: 'ImportValCo',
      description: '',
      logo: 'l',
      themeColor: '#000',
      accountCount: 50,
      supportLanguage: ['zh-CN'],
      defaultLanguage: 'zh-CN',
      serviceStartTime: new Date().toISOString(),
      serviceEndTime: new Date().toISOString()
    });
    tenantId = t.id;
  });

  after(async () => {
    await ctx.fastify.close();
  });

  it('同级组织名称不能重复', async () => {
    await assert.rejects(
      () =>
        ctx.ns.services.org.importFromRows({
          tenantId,
          parentOrgId: null,
          rows: [
            { rowType: 'org', orgName: '同级重复', parentOrgName: null, isLeader: false },
            { rowType: 'org', orgName: '同级重复', parentOrgName: null, isLeader: false }
          ]
        }),
      /同级/
    );
  });

  it('不同上级可同名', async () => {
    const r = await ctx.ns.services.org.importFromRows({
      tenantId,
      parentOrgId: null,
      rows: [
        { rowType: 'org', orgName: '上级A', parentOrgName: null, isLeader: false },
        { rowType: 'org', orgName: '上级B', parentOrgName: null, isLeader: false },
        { rowType: 'org', orgName: '同名子部门', parentOrgName: '上级A', isLeader: false },
        { rowType: 'org', orgName: '同名子部门', parentOrgName: '上级B', isLeader: false }
      ]
    });
    assert.equal(r.createdOrgs, 4);
  });

  it('邮箱不能与已有用户重复', async () => {
    await ctx.ns.services.org.importFromRows({
      tenantId,
      parentOrgId: null,
      rows: [
        { rowType: 'org', orgName: 'EmailOrgA', parentOrgName: null, isLeader: false },
        {
          rowType: 'user',
          orgName: 'EmailOrgA',
          userName: '已有用户',
          email: 'dup-import@test.local',
          phone: null,
          isLeader: false
        }
      ]
    });

    await assert.rejects(
      () =>
        ctx.ns.services.org.importFromRows({
          tenantId,
          parentOrgId: null,
          rows: [
            { rowType: 'org', orgName: 'EmailOrgB', parentOrgName: null, isLeader: false },
            {
              rowType: 'user',
              orgName: 'EmailOrgB',
              userName: '新用户',
              email: 'dup-import@test.local',
              phone: null,
              isLeader: false
            }
          ]
        }),
      /邮箱.*已被使用/
    );
  });

  it('手机号不能与已有用户重复且格式化为 +86', async () => {
    await ctx.ns.services.org.importFromRows({
      tenantId,
      parentOrgId: null,
      rows: [
        { rowType: 'org', orgName: 'PhoneOrgA', parentOrgName: null, isLeader: false },
        {
          rowType: 'user',
          orgName: 'PhoneOrgA',
          userName: '手机用户',
          email: null,
          phone: '13900139001',
          isLeader: false
        }
      ]
    });

    const u = await ctx.ns.models.user.findOne({ where: { tenantId, phone: '+86 13900139001' } });
    assert.ok(u);

    await assert.rejects(
      () =>
        ctx.ns.services.org.importFromRows({
          tenantId,
          parentOrgId: null,
          rows: [
            { rowType: 'org', orgName: 'PhoneOrgB', parentOrgName: null, isLeader: false },
            {
              rowType: 'user',
              orgName: 'PhoneOrgB',
              userName: '新手机用户',
              email: null,
              phone: '13900139001',
              isLeader: false
            }
          ]
        }),
      /手机号.*已被使用/
    );
  });
});
