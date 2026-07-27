const fp = require('fastify-plugin');
const get = require('lodash/get');
const { resolveLinkedTargetProps } = require('../utils/resolveLinkedTargetProps');

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];

  const parseSourceOptions = typeStr => {
    if (!typeStr) return [];
    return typeStr.split(',').map(item => {
      const [value, label] = item.split(':');
      return { value: value?.trim(), label: (label || value)?.trim() };
    });
  };

  const sourceOptions = parseSourceOptions(options.syncOrgType);

  const mapRecord = async (record, tenantSetting) => {
    const targetId = get(record, 'config.targetId') || null;
    return {
      source: record.type,
      targetId,
      props: resolveLinkedTargetProps(tenantSetting, targetId)
    };
  };

  const list = async ({ tenantId }) => {
    const records = await models.thirdLogin.findAll({
      where: { tenantId },
      order: [['type', 'ASC']]
    });
    const tenantSetting = await fastify.tenant.services.setting.detail({ tenantId });
    const listData = await Promise.all(records.map(record => mapRecord(record, tenantSetting)));
    return {
      sourceOptions,
      list: listData
    };
  };

  const getConfig = async ({ tenantId, type }) => {
    const record = await models.thirdLogin.findOne({
      where: { tenantId, type }
    });
    if (!record) {
      return { enabled: false, source: type || null, targetId: null, props: {}, sourceOptions };
    }
    const tenantSetting = await fastify.tenant.services.setting.detail({ tenantId });
    const mapped = await mapRecord(record, tenantSetting);
    return {
      enabled: true,
      source: mapped.source,
      targetId: mapped.targetId,
      props: mapped.props,
      sourceOptions
    };
  };

  const saveConfig = async ({ tenantId, source, targetId }) => {
    const [record, created] = await models.thirdLogin.findOrCreate({
      where: { tenantId, type: source },
      defaults: {
        tenantId,
        type: source,
        config: { targetId }
      }
    });
    if (!created) {
      await record.update({
        config: { targetId }
      });
    }
    return record;
  };

  const cancelConfig = async ({ tenantId, source }) => {
    const record = await models.thirdLogin.findOne({
      where: { tenantId, type: source }
    });
    if (record) {
      await record.destroy();
    }
    return {};
  };

  Object.assign(fastify[options.name].services, {
    thirdLogin: { list, getConfig, saveConfig, cancelConfig }
  });
});
