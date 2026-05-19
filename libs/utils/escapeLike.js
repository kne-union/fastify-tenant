/**
 * 转义 SQL LIKE 通配符，防止用户输入的 % 和 _ 被当作通配符。
 * @param {string} str 原始输入
 * @returns {string} 转义后的字符串
 */
const escapeLike = str => str.replace(/[%_\\]/g, m => '\\' + m);

module.exports = { escapeLike };
