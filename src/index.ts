import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { initORM } from './db'
import { setup } from './setup'
import responseMiddleware from './middlewares/responseMiddleware'
import errorMiddleware from './middlewares/errorMiddleware'
import userController from './modules/user'

const isProd = process.env.NODE_ENV === 'production'

const startApp = async () => {
  // fail fast on missing secrets: never boot with an empty JWT secret
  for (const key of ['JWT_SECRET', 'DATABASE_URL'])
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)

  const { orm } = await initORM()

  if (isProd) {
    // prod: explicit migrations only. updateSchema() can drop columns with data.
    // In cluster mode, run migrations once (deploy step / primary), not per worker.
    await orm.getMigrator().up()
  } else {
    await orm.getSchemaGenerator().updateSchema()
  }

  const app = new Elysia()
    .use(cors())
    .use(opentelemetry())
    .use(setup) // per-request em fork + services (see src/setup.ts)
    .onAfterHandle(responseMiddleware)
    .onError(errorMiddleware)
    .get('/', () => "It's works!")
    .get('/health', () => ({ status: 'ok' })) // for LB / k8s probes

  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
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

  app
    .group('/api', (group) => group.use(userController))
    .listen(Number(process.env.PORT ?? 3000))

  console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)
  if (!isProd)
    console.log(`🦊 Swagger UI: http://${app.server?.hostname}:${app.server?.port}/swagger-ui`)

  // graceful shutdown: stop accepting requests, then close DB pool cleanly
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down...`)
    await app.stop()
    await orm.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

startApp().catch((err) => {
  // exit non-zero so the orchestrator restarts us instead of a half-booted app
  console.error(err)
  process.exit(1)
})
