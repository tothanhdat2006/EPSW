import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const DEFAULT_SOURCE = 'data/data.json';
const DEFAULT_DETAIL = 'data/data_detail.json';
const DEFAULT_TARGET_DIR = resolve(repoRoot, 'apps/web-portal/public/mock');

function getArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return fallback;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

async function readAndValidateJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed, null, 2);
}

async function main() {
  const source = getArg('--source', DEFAULT_SOURCE);
  const detail = getArg('--detail', DEFAULT_DETAIL);
  const targetDir = getArg('--target-dir', DEFAULT_TARGET_DIR);

  const targetData = resolve(targetDir, 'qwen-data.json');
  const targetDetail = resolve(targetDir, 'qwen-data-detail.json');

  const [dataJson, detailJson] = await Promise.all([
    readAndValidateJson(source),
    readAndValidateJson(detail),
  ]);

  await mkdir(targetDir, { recursive: true });
  await Promise.all([
    writeFile(targetData, dataJson + '\n', 'utf8'),
    writeFile(targetDetail, detailJson + '\n', 'utf8'),
  ]);

  console.log('Synced qwen-rag data successfully.');
  console.log(`- source: ${source}`);
  console.log(`- detail: ${detail}`);
  console.log(`- out: ${targetData}`);
  console.log(`- out: ${targetDetail}`);
}

main().catch((error) => {
  console.error('Failed to sync qwen-rag data.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
