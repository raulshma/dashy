import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/dashy.db',
  },
  // Verbose logging during migrations
  verbose: true,
  // Strict mode: require confirmation for destructive changes
  strict: true,
});
