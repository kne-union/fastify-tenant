'use strict';

const assert = require('node:assert/strict');
const DT = {
  STRING: 'STRING',
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  JSON: 'JSON',
  JSONB: 'JSONB',
  DATE: 'DATE',
  ENUM: (...args) => `ENUM(${args.join(',')})`
};

const definePrimaryType = () => DT.STRING;

const mockUserModel = () => ({});

const rel = () => ({
  belongsTo() {},
  hasOne() {},
  hasMany() {}
});

const bag = {
  tenant: rel(),
  company: rel(),
  setting: rel(),
  org: rel(),
  role: rel(),
  user: rel(),
  userDefault: rel(),
  customComponent: rel(),
  sharedGroup: rel(),
  sharedGroupDataSource: rel(),
  sharedGroupMember: rel()
};

const factoryOpts = { DataTypes: DT, definePrimaryType, options: { getUserModel: mockUserModel } };

describe('模型 associate 可执行且不抛错', () => {
  it('tenant / company / setting / org / role / user / user-default / custom-component / shared-group / 关联表', () => {
    const tenantDef = require('../libs/models/tenant.js')(factoryOpts);
    tenantDef.associate({ company: bag.company, setting: bag.setting, tenant: bag.tenant });

    const companyDef = require('../libs/models/company.js')(factoryOpts);
    companyDef.associate({ company: bag.company, tenant: bag.tenant });

    const settingDef = require('../libs/models/setting.js')(factoryOpts);
    settingDef.associate({ setting: bag.setting, tenant: bag.tenant });

    const orgDef = require('../libs/models/org.js')(factoryOpts);
    orgDef.associate({ org: bag.org, tenant: bag.tenant, user: bag.user });

    const roleDef = require('../libs/models/role.js')(factoryOpts);
    roleDef.associate({ role: bag.role, tenant: bag.tenant, user: bag.user });

    const userDef = require('../libs/models/user.js')(factoryOpts);
    userDef.associate({ user: bag.user, tenant: bag.tenant, org: bag.org });

    const udDef = require('../libs/models/user-default.js')(factoryOpts);
    udDef.associate({ userDefault: bag.userDefault, tenant: bag.tenant });

    const ccDef = require('../libs/models/custom-component.js')(factoryOpts);
    ccDef.associate({ customComponent: bag.customComponent, tenant: bag.tenant });

    const sgDef = require('../libs/models/shared-group.js')(factoryOpts);
    sgDef.associate({
      sharedGroup: bag.sharedGroup,
      tenant: bag.tenant,
      user: bag.user,
      sharedGroupDataSource: bag.sharedGroupDataSource,
      sharedGroupMember: bag.sharedGroupMember
    });

    const sgdsDef = require('../libs/models/shared-group-data-source.js')(factoryOpts);
    sgdsDef.associate({
      sharedGroupDataSource: bag.sharedGroupDataSource,
      sharedGroup: bag.sharedGroup,
      user: bag.user
    });

    const sgmDef = require('../libs/models/shared-group-member.js')(factoryOpts);
    sgmDef.associate({
      sharedGroupMember: bag.sharedGroupMember,
      sharedGroup: bag.sharedGroup,
      user: bag.user
    });

    assert.ok(true);
  });
});
