const get = require('lodash/get');

const resolveLinkedTargetProps = (tenantSetting, targetId) => {
  if (!targetId) {
    return {};
  }
  return Object.fromEntries(
    get(tenantSetting.getDataValue('argsValue'), targetId, '')
      ?.split(';')
      .filter(pair => pair.includes(':'))
      .map(pair => {
        const [key, ...rest] = pair.split(':');
        return [key.trim(), rest.join(':').trim()];
      }) || []
  );
};

module.exports = { resolveLinkedTargetProps };
