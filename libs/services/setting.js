const fp = require('fastify-plugin');
const groupBy = require('lodash/groupBy');
const transform = require('lodash/transform');
const get = require('lodash/get');
const { withTransaction } = require('../utils/withTransaction');

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];

  const appendArgs = async ({ tenantId, args }, outerTransaction) => {
    const run = async t => {
      let setting = await detail({ tenantId });
      args.forEach(({ key }) => {
        if ((setting.args || []).find(item => item.key === key)) {
          throw new Error(`环境变量${key}已存在，请先删除后再添加新的值`);
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
      throw new Error(`自定义组件${customComponent.key}已存在，请先删除后再添加新的值`);
    }

    setting.customComponents = [...(setting.customComponents || []), Object.assign({}, customComponent, { content: customComponentItem.id })];

    await setting.save();
  };

  const copyCustomComponent = async ({ tenantId, key }) => {
    const setting = await detail({ tenantId });
    const customComponentItemIndex = setting.customComponents.findIndex(item => item.key === key);
    if (customComponentItemIndex === -1) {
      throw new Error('自定义组件不存在');
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
      throw new Error('自定义组件不存在');
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
      throw new Error(`${key}已不存在`);
    }
    return await models.customComponent.findByPk(customComponentItem.content);
  };

  const removeCustomComponent = async ({ tenantId, key }) => {
    let setting = await detail({ tenantId });
    const customComponentIndex = (setting?.customComponents || []).findIndex(item => item.key === key);
    if (customComponentIndex === -1) {
      throw new Error(`${key}已不存在`);
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
      throw new Error('租户不存在');
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
        throw new Error(`${key}已不存在`);
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
      getSecrets
    }
  });
});
