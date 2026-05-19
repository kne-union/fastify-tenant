'use strict';

const assert = require('node:assert/strict');
const { normalizeDataScopeList, DEFAULT_DATA_SCOPE_LIST } = require('../libs/utils/normalizeDataScopeList');

describe('normalizeDataScopeList', () => {
  it('defaults to read and write when list missing or empty', () => {
    assert.deepEqual(normalizeDataScopeList(undefined), DEFAULT_DATA_SCOPE_LIST);
    assert.deepEqual(normalizeDataScopeList(null), DEFAULT_DATA_SCOPE_LIST);
    assert.deepEqual(normalizeDataScopeList([]), DEFAULT_DATA_SCOPE_LIST);
  });

  it('keeps configured order and deduplicates', () => {
    assert.deepEqual(normalizeDataScopeList(['write', 'read', 'write']), ['write', 'read']);
    assert.deepEqual(normalizeDataScopeList(['read']), ['read']);
  });

  it('falls back when list has no valid entries', () => {
    assert.deepEqual(normalizeDataScopeList(['invalid']), DEFAULT_DATA_SCOPE_LIST);
  });
});
