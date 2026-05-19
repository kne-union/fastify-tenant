'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const modelDir = path.join(__dirname, '../libs/models');
const files = fs.readdirSync(modelDir).filter(f => f.endsWith('.js'));

describe('模型工厂', () => {
  for (const file of files) {
    it(`${file} 应导出可执行的工厂并返回 model 定义`, () => {
      const factory = require(path.join(modelDir, file));
      assert.equal(typeof factory, 'function');
      const mockUserModel = () => ({});
      const out = factory({
        DataTypes: {
          STRING: 'STRING',
          TEXT: 'TEXT',
          INTEGER: 'INTEGER',
          JSON: 'JSON',
          JSONB: 'JSONB',
          DATE: 'DATE',
          ENUM: (...v) => `ENUM(${v.join(',')})`
        },
        definePrimaryType: () => 'STRING',
        options: { getUserModel: mockUserModel }
      });
      assert.ok(out.model);
      assert.ok(out.options);
    });
  }
});
