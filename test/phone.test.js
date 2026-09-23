'use strict';

const assert = require('node:assert/strict');
const { normalizePhone, resolvePhoneFilterPattern } = require('../libs/utils/phone');

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

describe('resolvePhoneFilterPattern', () => {
  it('统一为国内号码数字，兼容无空格区号', () => {
    assert.equal(resolvePhoneFilterPattern('13800138000'), '13800138000');
    assert.equal(resolvePhoneFilterPattern('+86 13800138000'), '13800138000');
    assert.equal(resolvePhoneFilterPattern('+8613800138000'), '13800138000');
    assert.equal(resolvePhoneFilterPattern({ code: '86', value: '13800138000' }), '13800138000');
  });

  it('空值', () => {
    assert.equal(resolvePhoneFilterPattern(null), '');
    assert.equal(resolvePhoneFilterPattern(''), '');
    assert.equal(resolvePhoneFilterPattern({}), '');
  });
});
