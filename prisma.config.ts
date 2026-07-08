// Prisma 7 configuration.
// DATABASE_URL comes from process.env — injected by Docker, App Runner, or .env locally.
// dotenv is only attempted in development; a missing .env in production is normal and silent.
import { defineConfig } from 'prisma/config';

// Load .env in local development only (silently skipped if file doesn't exist)
if (process.env.NODE_ENV !== 'production') {
  try {
    const { configDotenv } = await import('dotenv');
    configDotenv({ path: '.env' });
  } catch { /* dotenv not available — DATABASE_URL must be set in the environment */ }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
