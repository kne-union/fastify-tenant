'use strict';

const assert = require('node:assert/strict');
const { normalizeLeaderUserId } = require('../libs/utils/normalizeLeaderUserId');

describe('normalizeLeaderUserId', () => {
  it('returns null for empty values', () => {
    assert.equal(normalizeLeaderUserId(null), null);
    assert.equal(normalizeLeaderUserId(undefined), null);
    assert.equal(normalizeLeaderUserId(''), null);
    assert.equal(normalizeLeaderUserId({}), null);
    assert.equal(normalizeLeaderUserId({ id: '' }), null);
  });

  it('extracts id from object', () => {
    assert.equal(normalizeLeaderUserId({ id: 'u1', name: 'A' }), 'u1');
  });
});
