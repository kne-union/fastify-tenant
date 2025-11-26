const fp = require('fastify-plugin');
const groupBy = require('lodash/groupBy');
const transform = require('lodash/transform');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { transaction } = fastify.sequelize.instance;
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
    setting: { appendArgs, detail, removeArg }
  });
});
