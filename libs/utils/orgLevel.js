'use strict';

function orgLevelKey(parentId, name) {
  return `${parentId == null ? '' : String(parentId)}::${String(name).trim()}`;
}

function parseOrgLevelKey(key) {
  const idx = key.lastIndexOf('::');
  if (idx < 0) {
    return { parentId: null, name: key };
  }
  const parentPart = key.slice(0, idx);
  return {
    parentId: parentPart === '' ? null : parentPart,
    name: key.slice(idx + 2)
  };
}

function collectOrgIdsByName(orgPathToId, name) {
  const ids = new Set();
  for (const [key, id] of orgPathToId) {
    const { name: n } = parseOrgLevelKey(key);
    if (n === name) {
      ids.add(id);
    }
  }
  return [...ids];
}

module.exports = {
  orgLevelKey,
  parseOrgLevelKey,
  collectOrgIdsByName
};
