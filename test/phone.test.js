'use strict';

const assert = require('node:assert/strict');
const { normalizePhone } = require('../libs/utils/phone');

describe('normalizePhone', () => {
  it('无国家码补 +86', () => {
    assert.equal(normalizePhone('13800138000'), '+86 13800138000');
    assert.equal(normalizePhone('138 0013 8000'), '+86 13800138000');
  });

  it('86 前缀', () => {
    assert.equal(normalizePhone('8613800138000'), '+86 13800138000');
    assert.equal(normalizePhone('+8613800138000'), '+86 13800138000');
  });

  it('空值', () => {
    assert.equal(normalizePhone(null), null);
    assert.equal(normalizePhone(''), null);
  });
});
