import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const environmentPath = resolve(repositoryRoot, 'src/environments/environment.ts');
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be provided to the GitHub Pages build.');
}

if (!/^https:\/\//u.test(supabaseUrl)) {
  throw new Error('SUPABASE_URL must be an https URL.');
}

const environment = {
  production: true,
  supabaseUrl,
  supabasePublishableKey,
};

await mkdir(dirname(environmentPath), { recursive: true });
await writeFile(
  environmentPath,
  `export const environment = ${JSON.stringify(environment, null, 2)} as const;\n`,
  'utf8',
);

console.log('Generated production Angular environment configuration.');
