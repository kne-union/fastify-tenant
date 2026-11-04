const fp = require('fastify-plugin');
const groupBy = require('lodash/groupBy');
const transform = require('lodash/transform');
const get = require('lodash/get');
const pick = require('lodash/pick');
const { withTransaction } = require('../utils/withTransaction');
const { createError } = require('../utils/intl');

// maxAge 单位秒：同一登录会话内距上次 MFA 验证超过该时长需重新验证，0 表示每次授权都验证
const MFA_DEFAULT = { enabled: false, methods: ['sms'], maxAge: 86400 };
const MFA_FIELDS = Object.keys(MFA_DEFAULT);

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];

  const appendArgs = async ({ tenantId, args }, outerTransaction) => {
    const run = async t => {
      let setting = await detail({ tenantId });
      args.forEach(({ key }) => {
        if ((setting.args || []).find(item => item.key === key)) {
          throw createError(null, 'envVariableExists', { key });
        }
      });
      const { secrets, args: targetArgs } = groupBy(args, item => (item.secret ? 'secrets' : 'args'));
      await saveSecrets({ secrets, tenantId, transaction: t });
      setting.args = [...(setting.args || []), ...(targetArgs || []), ...(secrets || []).map(item => Object.assign({}, item, { value: '******' }))];
      await setting.save({ transaction: t });
    };
    return withTransaction(fastify, run, outerTransaction);
  };

  const saveSecrets = async ({ secrets, tenantId, transaction }) => {
    if (!(secrets && secrets.length > 0)) {
      return;
    }
    await detail({ tenantId });
    const setting = await models.setting.findOne({
      where: {
        tenantId
      },
      transaction
    });
    const newSecrets = setting.secrets.slice(0);
    setting.secrets = newSecrets.concat(secrets);
    await setting.save({ transaction });
  };

  const removeSecret = async ({ tenantId, key }, outerTransaction) => {
    const run = async t => {
      await detail({ tenantId });
      const setting = await models.setting.findOne({
        where: {
          tenantId
        },
        transaction: t
      });
      const newSecrets = setting.secrets.slice(0);
      const secretIndex = newSecrets.findIndex(item => item.key === key);
      if (secretIndex === -1) {
        return;
      }
      newSecrets.splice(secretIndex, 1);
      setting.secrets = newSecrets;
      await setting.save({ transaction: t });
    };
    return withTransaction(fastify, run, outerTransaction);
  };

  const getSecrets = async ({ tenantId, key }) => {
    await detail({ tenantId });
    const setting = await models.setting.findOne({
      attributes: ['secrets'],
      where: {
        tenantId
      }
    });
    if (!setting) {
      return null;
    }
    return get(
      (setting.secrets || []).find(item => item.key === key),
      'value',
      null
    );
  };

  const appendCustomComponent = async ({ tenantId, customComponent }) => {
    let setting = await detail({ tenantId });
    const customComponentItem = await models.customComponent.create({
      content: customComponent.content,
      tenantId
    });

    if ((setting.customComponents || []).find(item => item.key === customComponent.key)) {
      throw createError(null, 'customComponentExists', { key: customComponent.key });
    }

    setting.customComponents = [...(setting.customComponents || []), Object.assign({}, customComponent, { content: customComponentItem.id })];

    await setting.save();
  };

  const copyCustomComponent = async ({ tenantId, key }) => {
    const setting = await detail({ tenantId });
    const customComponentItemIndex = setting.customComponents.findIndex(item => item.key === key);
    if (customComponentItemIndex === -1) {
      throw createError(null, 'customComponentNotFound');
    }
    const customComponentItem = setting.customComponents[customComponentItemIndex];
    const customComponentInstance = await models.customComponent.findByPk(customComponentItem.content);

    await appendCustomComponent({
      tenantId,
      customComponent: Object.assign({}, customComponentItem, {
        content: customComponentInstance.content,
        key: `${customComponentItem.key}_COPY`
      })
    });
  };

  const saveCustomComponents = async ({ tenantId, customComponent }) => {
    const setting = await detail({ tenantId });
    const customComponentItemIndex = setting.customComponents.findIndex(item => item.key === customComponent.key);

    if (customComponentItemIndex === -1) {
      throw createError(null, 'customComponentNotFound');
    }
    const customComponentItem = setting.customComponents[customComponentItemIndex];
    const customComponentInstance = await models.customComponent.findByPk(customComponentItem.content);
    customComponentInstance.content = customComponent.content;
    await customComponentInstance.save();
    const newCustomComponents = setting.customComponents.slice(0);
    newCustomComponents.splice(
      customComponentItemIndex,
      1,
      Object.assign({}, customComponentItem, customComponent, {
        content: customComponentInstance.id
      })
    );
    setting.customComponents = newCustomComponents;
    await setting.save();
  };

  const customComponentDetail = async ({ tenantId, key }) => {
    const setting = await detail({ tenantId });
    const customComponentItem = (setting?.customComponents || []).find(item => item.key === key);
    if (!customComponentItem) {
      throw createError(null, 'settingKeyNotFound', { key });
    }
    return await models.customComponent.findByPk(customComponentItem.content);
  };

  const removeCustomComponent = async ({ tenantId, key }) => {
    let setting = await detail({ tenantId });
    const customComponentIndex = (setting?.customComponents || []).findIndex(item => item.key === key);
    if (customComponentIndex === -1) {
      throw createError(null, 'settingKeyNotFound', { key });
    }
    const customComponentId = setting.customComponents[customComponentIndex].content;
    const newCustomComponents = setting.customComponents.slice(0);
    newCustomComponents.splice(customComponentIndex, 1);
    setting.customComponents = newCustomComponents;
    await setting.save();
    await models.customComponent.destroy({
      where: {
        id: customComponentId
      }
    });
  };

  const detail = async ({ tenantId }) => {
    const tenant = await models.tenant.findByPk(tenantId);
    if (!tenant) {
      throw createError(null, 'tenantNotFound');
    }
    const setting = await models.setting.findOne({
      attributes: ['id', 'args', 'customComponents', 'permissions', 'options'],
      where: {
        tenantId: tenant.id
      }
    });
    if (!setting) {
      return await models.setting.create({ tenantId });
    }
    setting.setDataValue(
      'argsValue',
      transform(
        setting.args,
        (result, value) => {
          result[value.key] = value.value;
        },
        {}
      )
    );
    // 确保 secrets 不被暴露给前端
    setting.setDataValue('secrets', undefined);
    return setting;
  };

  const removeArg = async ({ tenantId, key }, outerTransaction) => {
    const run = async t => {
      const setting = await detail({ tenantId });
      const argIndex = (setting?.args || []).findIndex(item => item.key === key);
      if (argIndex === -1) {
        throw createError(null, 'settingKeyNotFound', { key });
      }
      const arg = setting.args[argIndex];

      if (arg.secret) {
        await removeSecret({ tenantId, key }, t);
      }

      const newArgs = setting.args.slice(0);
      newArgs.splice(argIndex, 1);
      setting.args = newArgs;
      await setting.save({ transaction: t });
    };
    return withTransaction(fastify, run, outerTransaction);
  };

  const savePermissions = async ({ tenantId, permissions }) => {
    const setting = await detail({ tenantId });
    setting.permissions = permissions;
    await setting.save();
  };

  const resolveMfa = setting => Object.assign({}, MFA_DEFAULT, pick(get(setting, 'options.mfa') || {}, MFA_FIELDS));

  const getMfa = async ({ tenantId }) => resolveMfa(await detail({ tenantId }));

  // options 为 JSON 列，需整体重新赋值才会被保存；只合并 mfa 键，保留 options 里的其他配置
  const saveMfa = async ({ tenantId, mfa }) => {
    const setting = await detail({ tenantId });
    const next = Object.assign(resolveMfa(setting), pick(mfa || {}, MFA_FIELDS));
    setting.options = Object.assign({}, setting.options, { mfa: next });
    await setting.save();
    return next;
  };

  Object.assign(fastify[options.name].services, {
    setting: {
      appendArgs,
      appendCustomComponent,
      saveCustomComponents,
      customComponentDetail,
      copyCustomComponent,
      removeCustomComponent,
      savePermissions,
      detail,
      removeArg,
      getSecrets,
      getMfa,
      saveMfa
    }
  });
});
