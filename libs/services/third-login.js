const fp = require('fastify-plugin');
const get = require('lodash/get');
const { resolveLinkedTargetProps } = require('../utils/resolveLinkedTargetProps');

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

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
      order: [
        ['type', 'ASC'],
        ['id', 'ASC']
      ]
    });
    const tenantSetting = await fastify.tenant.services.setting.detail({ tenantId });
    const listData = await Promise.all(records.map(record => mapRecord(record, tenantSetting)));
    return {
      sourceOptions,
      list: listData
    };
  };

  const getConfig = async ({ tenantId, type, targetId }) => {
    const records = await models.thirdLogin.findAll({
      where: { tenantId, type },
      order: [['id', 'ASC']]
    });

    if (!records.length) {
      return { enabled: false, source: type || null, targetId: null, props: {}, sourceOptions };
    }

    let record;
    if (targetId) {
      record = records.find(item => get(item, 'config.targetId') === targetId);
      if (!record) {
        throw new Error('未找到对应的第三方登录配置');
      }
    } else if (records.length === 1) {
      record = records[0];
    } else {
      throw new Error('请指定第三方登录配置 targetId');
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
    if (!targetId) {
      throw new Error('targetId不能为空');
    }

    const [record, created] = await models.thirdLogin.findOrCreate({
      where: {
        tenantId,
        type: source,
        config: {
          [Op.contains]: { targetId }
        }
      },
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

  const cancelConfig = async ({ tenantId, source, targetId }) => {
    if (!targetId) {
      throw new Error('targetId不能为空');
    }

    const record = await models.thirdLogin.findOne({
      where: {
        tenantId,
        type: source,
        config: {
          [Op.contains]: { targetId }
        }
      }
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
