const flattenPermissions = data => {
  const result = [];
  const processModule = (module, parentCode = '') => {
    const currentCode = parentCode ? `${parentCode}:${module.code}` : module.code;

    // 添加当前模块
    result.push({
      name: module.name,
      code: currentCode,
      type: 'module'
    });

    // 处理子模块
    if (module.modules) {
      module.modules.forEach(subModule => {
        processModule(subModule, currentCode);
      });
    }

    // 处理权限
    if (module.permissions) {
      module.permissions.forEach(permission => {
        result.push({
          name: permission.name,
          code: `${currentCode}:${permission.code}`,
          type: 'permission'
        });
      });
    }
  };
  // 处理所有顶级模块
  data.modules.forEach(module => {
    processModule(module);
  });

  return result;
};

module.exports = flattenPermissions;
