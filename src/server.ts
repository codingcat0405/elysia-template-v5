import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import responseMiddleware from './middlewares/responseMiddleware'
import errorMiddleware from './middlewares/errorMiddleware'
import userController from './modules/user'
import { setup } from './middlewares/setup'
import { initORM } from './db'
import logger from './utils/logger'

const startApp = async () => {


  const { orm } = await initORM() // same cached instance `setup.ts` forks from

  const app = new Elysia()
    .use(cors())
    .use(setup)
    .onAfterHandle(responseMiddleware)
    .onError(errorMiddleware)
    .get('/', () => "It's works!")
    .get('/health', () => ({ status: 'ok' }))
    .group('/api', (group) => group.use(userController))

  // compose everything BEFORE listen — never .use() after the server is live
  if (process.env.ENABLE_SWAGGER === 'true') {
    app.use(
      swagger({
        path: '/swagger-ui',
        provider: 'swagger-ui',
        documentation: {
          info: {
            title: 'Elysia template v4',
            description: 'Elysia + MikroORM template API documentation',
            version: '1.0.0',
          },
          components: {
            securitySchemes: {
              JwtAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT Bearer token **_only_**',
              },
            },
          },
        },
        swaggerOptions: { persistAuthorization: true },
      }),
    )
  }

  app.listen(Number(process.env.PORT ?? 3000))

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`)
    await app.stop()
    await orm.close() // release the pool this process owns
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

startApp().catch((err) => {
  console.error(err)
  process.exit(1)
})