'use strict';

const assert = require('node:assert/strict');
const { buildOrgSubtreeUserCounts } = require('../libs/utils/orgUserCount');

describe('buildOrgSubtreeUserCounts', () => {
  it('应统计本节点及子级组织下的用户数', () => {
    const orgs = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' }
    ];
    const users = [
      { tenantOrgIds: ['a'] },
      { tenantOrgIds: ['b'] },
      { tenantOrgIds: ['c'] },
      { tenantOrgIds: ['c'] }
    ];
    const map = buildOrgSubtreeUserCounts(orgs, users);
    assert.equal(map.get('a'), 4);
    assert.equal(map.get('b'), 3);
    assert.equal(map.get('c'), 2);
  });
});
