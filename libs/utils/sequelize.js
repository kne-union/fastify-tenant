/** @kne/fastify-sequelize 将真实实例挂在 .instance 上；测试 mock 可能直接挂在 fastify.sequelize */
const getSequelize = fastify => fastify.sequelize.instance || fastify.sequelize;

module.exports = { getSequelize };
