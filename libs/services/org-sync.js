const fp = require('fastify-plugin');
const get = require('lodash/get');
const { resolveLinkedTargetProps } = require('../utils/resolveLinkedTargetProps');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];

  const syncSupported = typeof options.syncOrgTask === 'function';

  const parseSourceOptions = typeStr => {
    if (!typeStr) return [];
    return typeStr.split(',').map(item => {
      const [value, label] = item.split(':');
      return { value: value?.trim(), label: (label || value)?.trim() };
    });
  };

  const sourceOptions = parseSourceOptions(options.syncOrgType);

  const getConfig = async ({ tenantId }) => {
    const record = await models.orgSync.findOne({
      where: { tenantId }
    });
    if (!record) {
      return { enabled: false, source: null, syncInterval: null, targetId: null, lastSyncTime: null, syncSupported, sourceOptions };
    }
    const tenantSetting = await fastify.tenant.services.setting.detail({ tenantId });
    const tenantProps = resolveLinkedTargetProps(tenantSetting, record.config.targetId);

    return {
      enabled: true,
      source: record.type,
      syncInterval: (record.config && record.config.syncInterval) || null,
      targetId: (record.config && record.config.targetId) || null,
      lastSyncTime: record.lastSyncAt,
      status: record.status,
      props: tenantProps,
      syncSupported,
      sourceOptions
    };
  };

  const saveConfig = async ({ tenantId, source, syncInterval, targetId }) => {
    const [record, created] = await models.orgSync.findOrCreate({
      where: { tenantId },
      defaults: {
        tenantId,
        type: source,
        config: { syncInterval, targetId },
        status: 'running'
      }
    });
    if (!created) {
      await record.update({
        type: source,
        config: { syncInterval, targetId }
      });
    }
    await services.thirdLogin.saveConfig({ tenantId, source, targetId });

    if (typeof options.syncOrgTask === 'function') {
      await triggerSync({ tenantId });
    }
    return record;
  };

  const cancelConfig = async ({ tenantId }) => {
    const record = await models.orgSync.findOne({
      where: { tenantId }
    });
    if (record) {
      await models.org.update({ status: 'closed' }, { where: { tenantId, synced: true } });
      await models.user.update({ status: 'closed' }, { where: { tenantId, synced: true } });
      await record.destroy();
    }
    return {};
  };

  const triggerSync = async ({ tenantId }) => {
    if (typeof options.syncOrgTask !== 'function') {
      throw new Error('syncOrgTask 未配置，无法执行同步');
    }
    const record = await models.orgSync.findOne({
      where: { tenantId }
    });
    if (!record || !record.type) {
      throw new Error('未找到同步配置，请先保存关联配置');
    }
    const config = await getConfig({ tenantId });
    await options.syncOrgTask({ tenantId, syncSource: record.type, config });
    await record.update({ status: 'running' });
    return {};
  };

  const sendMessage = async ({ tenantId, userIds, content, msgtype = 'text' }) => {
    if (typeof options.sendOrgMessage !== 'function') {
      throw new Error('sendOrgMessage 未配置，无法发送消息');
    }

    const config = await getConfig({ tenantId });
    if (!config.enabled) {
      throw new Error('未找到有效的组织同步配置，无法发送消息');
    }

    const { Op } = fastify.sequelize.Sequelize;
    const users = await models.user.findAll({
      where: {
        id: { [Op.in]: userIds },
        tenantId,
        synced: true,
        sourceId: { [Op.ne]: null }
      },
      attributes: ['id', 'name', 'sourceId', 'syncSource']
    });

    if (users.length === 0) {
      throw new Error('所选用户中没有可发送消息的外部用户');
    }

    const touser = users.map(u => u.sourceId);

    await options.sendOrgMessage({
      tenantId,
      syncSource: config.source,
      config,
      touser,
      msgtype,
      content
    });

    return { count: users.length };
  };

  Object.assign(fastify[options.name].services, {
    orgSync: { getConfig, saveConfig, cancelConfig, triggerSync, sendMessage }
  });
});
