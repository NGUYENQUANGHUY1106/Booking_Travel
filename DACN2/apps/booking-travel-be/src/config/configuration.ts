export default () => ({
  app: {
    environment: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.API_PORT ?? 3000),
    prefix: process.env.API_PREFIX ?? 'api',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  storage: {
    endpoint: process.env.R2_ENDPOINT,
    bucket: process.env.R2_BUCKET,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
  },
});
