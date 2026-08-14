/** Throwaway: proves whether APP_DATABASE_URL can actually authenticate. */
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

loadEnv({ path: '../../.env', quiet: true });

async function main() {
  const url = process.env.APP_DATABASE_URL;
  if (!url) {
    console.log('APP_DATABASE_URL is not set');
    return;
  }
  const parsed = new URL(url);
  console.log(`host: ${parsed.host}`);
  console.log(`user: ${parsed.username}`);
  console.log(
    `pass: ${parsed.password.slice(0, 6)}...${parsed.password.slice(-4)} (len ${parsed.password.length})`,
  );
  console.log(
    `APP_DB_PASSWORD env: ${(process.env.APP_DB_PASSWORD ?? '').slice(0, 6)}...${(process.env.APP_DB_PASSWORD ?? '').slice(-4)} (len ${(process.env.APP_DB_PASSWORD ?? '').length})`,
  );
  console.log(`match: ${parsed.password === process.env.APP_DB_PASSWORD}`);

  for (const [label, target] of [
    ['POOLED  ', url],
    ['DIRECT  ', url.replace('-pooler.', '.')],
  ] as const) {
    const sql = postgres(target, { max: 1, prepare: false, ssl: 'require' });
    try {
      const rows = await sql`select current_user, current_setting('is_superuser') as su`;
      console.log(`${label} OK:`, rows[0]);
    } catch (e) {
      console.log(`${label} FAILED:`, (e as Error).message);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
}

main();
