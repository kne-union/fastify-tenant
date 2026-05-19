'use strict';

const assert = require('node:assert/strict');
const { pickOrgIdsFromInput, getUserOrgIds, userBelongsToOrg } = require('../libs/utils/tenantOrgIds');
const { buildOrgSubtreeUserCounts } = require('../libs/utils/orgUserCount');

describe('tenantOrgIds utils', () => {
  it('pickOrgIdsFromInput merges single and multi', () => {
    assert.deepEqual(
      pickOrgIdsFromInput({
        tenantOrgId: 'a',
        tenantOrgIds: [{ id: 'b' }, 'c']
      }),
      { tenantOrgIds: ['b', 'c', 'a'], tenantOrgId: 'b' }
    );
  });

  it('getUserOrgIds deduplicates legacy tenantOrgId and tenantOrgIds', () => {
    assert.deepEqual(getUserOrgIds({ tenantOrgId: 'a', tenantOrgIds: ['a', 'b'] }), ['a', 'b']);
  });

  it('userBelongsToOrg checks tenantOrgIds', () => {
    assert.equal(userBelongsToOrg({ tenantOrgIds: ['x'] }, 'x'), true);
    assert.equal(userBelongsToOrg({ tenantOrgId: 'y' }, 'x'), false);
  });
});

describe('buildOrgSubtreeUserCounts with multi org', () => {
  it('counts user in multiple direct orgs', () => {
    const orgs = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: null }
    ];
    const users = [{ tenantOrgIds: ['a', 'b'] }];
    const map = buildOrgSubtreeUserCounts(orgs, users);
    assert.equal(map.get('a'), 1);
    assert.equal(map.get('b'), 1);
  });
});
