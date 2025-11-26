const fastify = require('fastify')({
  logger: true,
  routerOptions: {
    querystringParser: str => require('qs').parse(str)
  }
});
const fastifyEnv = require('@fastify/env');
const version = `v1`;

const options = {
  prefix: `/api/${version}`,
  getUserModel: () => {
    return fastify.account.models.user;
  }
};

const createServer = () => {
  fastify.register(fastifyEnv, {
    dotenv: true,
    schema: {
      type: 'object',
      properties: {
        DB_DIALECT: { type: 'string', default: 'sqlite' },
        DB_HOST: { type: 'string', default: 'data.db' },
        DB_PORT: { type: 'number' },
        DB_USERNAME: { type: 'string' },
        DB_PASSWORD: { type: 'string' },
        DB_DATABASE: { type: 'string' },
        ENV: { type: 'string', default: 'local' },
        PORT: { type: 'number', default: 8045 },
        ORIGIN: { type: 'string', default: '' }
      }
    }
  });
  fastify.register(
    require('fastify-plugin')(async fastify => {
      fastify.register(require('@kne/fastify-sequelize'), {
        db: {
          dialect: fastify.config.DB_DIALECT,
          host: fastify.config.DB_HOST,
          port: fastify.config.DB_PORT,
          database: fastify.config.DB_DATABASE,
          username: fastify.config.DB_USERNAME,
          password: fastify.config.DB_PASSWORD
        },
        modelsGlobOptions: {
          syncOptions: {}
        }
      });
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      fastify.register(require('@kne/fastify-account'), {
        prefix: `${options.prefix}`
      });
      fastify.register(require('../index'), {
        prefix: `${options.prefix}/tenant`,
        options
      });
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      await fastify.sequelize.sync();
    })
  );

  fastify.register(require('@kne/fastify-response-data-format'));
};

createServer();
fastify.then(() => {
  fastify.listen({ port: fastify.config.PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) throw err;
    console.log(`Server is now listening on ${address}`);
  });
});
