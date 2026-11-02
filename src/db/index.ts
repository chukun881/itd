import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { env } from '@/env';

const connectionString =
  env.DATABASE_URL || 'postgresql://postgres:postgres@ep-dummy.us-east-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
