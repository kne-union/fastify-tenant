'use strict';

const assert = require('node:assert/strict');
const { collectOrgSubtreeIds } = require('../libs/utils/dataScopeOrgIds');

describe('collectOrgSubtreeIds', () => {
  it('应包含根及所有后代', () => {
    const orgs = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'x', parentId: null }
    ];
    const set = collectOrgSubtreeIds(orgs, 'a');
    assert.deepEqual([...set].sort(), ['a', 'b', 'c']);
  });

  it('单节点无子时应仅含根', () => {
    const set = collectOrgSubtreeIds([{ id: 'only', parentId: null }], 'only');
    assert.deepEqual([...set], ['only']);
  });
});
