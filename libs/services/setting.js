const fp = require('fastify-plugin');
const groupBy = require('lodash/groupBy');
const transform = require('lodash/transform');

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const appendArgs = async ({ tenantId, args }) => {
    let setting = await detail({ tenantId });
    if (!setting) {
      setting = await models.setting.create({ tenantId });
    }

    args.forEach(({ key }) => {
      if ((setting.args || []).find(item => item.key === key)) {
        throw new Error(`环境变量${key}已存在，请先删除后再添加新的值`);
      }
    });

    setting.args = [...(setting.args || []), ...args];

    await setting.save();
  };

  const appendCustomComponent = async ({ tenantId, customComponent }) => {
    let setting = await detail({ tenantId });
    if (!setting) {
      setting = await models.setting.create({ tenantId });
    }

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
    let setting = await detail({ tenantId });
    if (!setting) {
      throw new Error('租户设置不存在');
    }
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
    let setting = await detail({ tenantId });
    if (!setting) {
      throw new Error('租户设置不存在');
    }
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

  const detail = async ({ tenantId, hasSecret }) => {
    const tenant = await models.tenant.findByPk(tenantId);
    if (!tenant) {
      throw new Error('租户不存在');
    }
    const setting = await models.setting.findOne({
      where: {
        tenantId: tenant.id
      }
    });
    if (!setting) {
      return null;
    }
    const { secret, args } = groupBy(setting?.args || [], item => (item.secret ? 'secret' : 'args'));

    const output = Object.assign(
      {},
      {
        args: transform(
          args,
          (result, value) => {
            result[value.key] = value.value;
          },
          {}
        ),
        options: setting?.options || {}
      },
      hasSecret
        ? {
            secret: transform(
              secret,
              (result, value) => {
                result[value.key] = value.value;
              },
              {}
            )
          }
        : {}
    );
    setting.setDataValue('output', output);
    setting.setDataValue(
      'args',
      (setting?.args || []).map(item => Object.assign({}, item, item.secret ? { value: '******' } : {}))
    );
    return setting;
  };

  const removeArg = async ({ tenantId, key }) => {
    const setting = await detail({ tenantId });
    const argIndex = (setting?.args || []).findIndex(item => item.key === key);
    if (argIndex === -1) {
      throw new Error(`${key}已不存在`);
    }
    const newArgs = setting.args.slice(0);
    newArgs.splice(argIndex, 1);
    setting.args = newArgs;
    await setting.save();
  };

  Object.assign(fastify[options.name].services, {
    setting: { appendArgs, appendCustomComponent, saveCustomComponents, customComponentDetail, copyCustomComponent, removeCustomComponent, detail, removeArg }
  });
});
