const get = require('lodash/get');

const MANAGED_NAME_SUFFIX = '（宿主）';

const getManagedBy = tenant => {
  const options = tenant && typeof tenant.get === 'function' ? tenant.get('options') : tenant?.options;
  return get(options, 'managedBy') || {};
};

const isManagedTenant = tenant => !!getManagedBy(tenant).hostTenantId;

/**
 * 托管租户名与本地租户重名时依次追加「（宿主）」「（宿主2）」…，直到不冲突
 */
const resolveManagedTenantName = async (name, isNameTaken) => {
  if (!(await isNameTaken(name))) {
    return name;
  }
  for (let index = 1; ; index++) {
    const candidate = `${name}${index === 1 ? MANAGED_NAME_SUFFIX : MANAGED_NAME_SUFFIX.replace('）', `${index}）`)}`;
    if (!(await isNameTaken(candidate))) {
      return candidate;
    }
  }
};

module.exports = { MANAGED_NAME_SUFFIX, getManagedBy, isManagedTenant, resolveManagedTenantName };
