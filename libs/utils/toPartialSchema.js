const cloneDeep = require('lodash/cloneDeep');

/**
 * 由创建用 schema 生成编辑（局部更新）用 schema：
 * - 去掉顶层字段的 default，否则未传字段会被默认值填充，覆盖库中已有值
 * - required 整体替换为传入值（lodash/merge 合并数组按下标覆盖，不能用来追加 required）
 * @param {object} schema 创建用 object schema
 * @param {{ properties?: object, required?: string[] }} [extra] 追加的字段与编辑接口的必填项
 */
const toPartialSchema = (schema, { properties = {}, required = [] } = {}) => {
  const result = cloneDeep(schema);
  Object.values(result.properties || {}).forEach(prop => {
    delete prop.default;
  });
  result.properties = Object.assign({}, result.properties, properties);
  result.required = required;
  return result;
};

module.exports = toPartialSchema;
