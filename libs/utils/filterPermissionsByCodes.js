'use strict';

/**
 * 按已选权限 code 集合裁剪权限树（仅保留 code 路径在集合中的节点）。
 */
const filterPermissionsByCodes = (permissions, codes) => {
  const codeSet = new Set(codes);

  function filterNode(node, parentCode = '') {
    const fullCode = parentCode ? `${parentCode}:${node.code}` : node.code;

    if (!codeSet.has(fullCode)) {
      return null;
    }

    const filteredNode = { ...node };

    if (node.modules) {
      filteredNode.modules = node.modules.map(child => filterNode(child, fullCode)).filter(child => child !== null);
    }

    return filteredNode;
  }

  const filteredModules = permissions.modules.map(module => filterNode(module)).filter(module => module !== null);

  return {
    ...permissions,
    modules: filteredModules
  };
};

module.exports = filterPermissionsByCodes;
