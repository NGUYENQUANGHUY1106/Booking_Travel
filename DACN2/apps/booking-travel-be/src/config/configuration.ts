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
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2_592_000),
    otpHashSecret: process.env.OTP_HASH_SECRET ?? process.env.JWT_ACCESS_SECRET,
    otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 600),
    otpResendCooldownSeconds: Number(
      process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60,
    ),
    otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    otpMaxSends: Number(process.env.OTP_MAX_SENDS ?? 5),
    exposeDevelopmentOtp:
      process.env.NODE_ENV !== 'production' &&
      process.env.AUTH_EXPOSE_DEVELOPMENT_OTP === 'true',
  },
});
