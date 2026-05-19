'use strict';

/**
 * 入口 index.js 的导出形态由本文件做最小断言；完整装载见 doc/summary.md「测试与覆盖率」。
 */
const assert = require('node:assert/strict');
const tenantPlugin = require('../index.js');

describe('index 插件导出', () => {
  it('应为可注册的函数（fastify-plugin 包装）', () => {
    assert.strictEqual(typeof tenantPlugin, 'function');
  });
});
