import 'dotenv/config';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URLが設定されていません');
}

// URLオブジェクトを使ってsslmodeを強制的に 'verify-full' に設定・上書きする
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.set('sslmode', 'verify-full');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});