import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from environment');
}

if (!process.argv[2]) {
  throw new Error('Usage: node republish-from-backup.mjs <backup-json-path>');
}

const backupPath = path.resolve(process.argv[2]);
const entries = JSON.parse(readFileSync(backupPath, 'utf8'));

if (!Array.isArray(entries) || entries.length === 0) {
  throw new Error('Backup file must contain a non-empty array of {id, ...}');
}

const isBlog = Object.prototype.hasOwnProperty.call(entries[0], 'slug');
const table = isBlog ? 'Blog' : 'Product';
const patchBody = isBlog ? { status: 'PUBLISHED' } : { isPublished: true };

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  let updatedCount = 0;
  for (const entry of entries) {
    const id = entry.id;
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(patchBody),
      },
    );

    if (!updateRes.ok) {
      console.error(
        `FAILED ${table} ${id} (${entry.title}): ${updateRes.status} ${await updateRes.text()}`,
      );
      continue;
    }

    const updated = await updateRes.json();
    const row = updated[0];
    const checkField = isBlog ? row?.status : row?.isPublished;
    const ok = isBlog ? checkField === 'PUBLISHED' : checkField === true;
    if (ok) {
      updatedCount++;
      console.log(`OK ${table} ${id} (${entry.title})`);
    } else {
      console.warn(`VERIFY ${table} ${id} (${entry.title}): returned ${JSON.stringify(row)}`);
    }
  }
  console.log(`\nRepublished ${updatedCount}/${entries.length} ${table} row(s).`);
  if (updatedCount !== entries.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
