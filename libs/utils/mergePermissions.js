const get = require('lodash/get');
const cloneDeep = require('lodash/cloneDeep');
const mergePermissions = (origin, target) => {
  let result = cloneDeep(origin);
  const core = (modules, path = 'modules') => {
    if (!(Array.isArray(modules) && modules.length > 0)) {
      return;
    }
    let current = get(result, path);
    modules.forEach(module => {
      if (!Array.isArray(current)) {
        current = [];
      }
      const sameCodeItemIndex = current.findIndex(item => item.code === module.code);
      if (sameCodeItemIndex === -1) {
        current.push(module);
        return;
      }
      current[sameCodeItemIndex] = Object.assign({}, current[sameCodeItemIndex], {
        name: module.name,
        permissions: [...(current[sameCodeItemIndex].permissions || []), ...(module.permissions || [])]
      });
      core(module.modules, `${path}.${sameCodeItemIndex}.modules`);
    });
    result[path] = current.sort((a, b) => (b.index || 0) - (a.index || 0));
  };
  core(target.modules);
  return result;
};

module.exports = mergePermissions;
