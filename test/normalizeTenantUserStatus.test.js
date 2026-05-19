'use strict';

const assert = require('node:assert/strict');
const { normalizeTenantUserStatus } = require('../libs/utils/normalizeTenantUserStatus');

describe('normalizeTenantUserStatus', () => {
  it('maps active/inactive aliases', () => {
    assert.equal(normalizeTenantUserStatus('active'), 'open');
    assert.equal(normalizeTenantUserStatus('inactive'), 'closed');
  });

  it('accepts open and closed', () => {
    assert.equal(normalizeTenantUserStatus('open'), 'open');
    assert.equal(normalizeTenantUserStatus('closed'), 'closed');
  });

  it('returns null for unknown values', () => {
    assert.equal(normalizeTenantUserStatus('pending'), null);
  });
});
