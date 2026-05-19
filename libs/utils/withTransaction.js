const { getSequelize } = require('./sequelize');

/**
 * 统一事务管理：如果已有外部事务则复用，否则新建事务。
 * @param {object} fastify Fastify 实例
 * @param {function} fn 业务函数，接收 transaction 参数
 * @param {object} [outerTransaction] 外部传入的事务（可选）
 * @returns {Promise<*>} fn 的返回值
 */
const withTransaction = async (fastify, fn, outerTransaction) => {
  if (outerTransaction) {
    return fn(outerTransaction);
  }
  const sq = getSequelize(fastify);
  const t = await sq.transaction();
  try {
    const result = await fn(t);
    await t.commit();
    return result;
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

module.exports = { withTransaction };
