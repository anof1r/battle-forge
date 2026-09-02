import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const collections = [
  { path: 'rooms', keys: ['rooms'] },
  { path: 'players', keys: ['players'] },
  { path: 'dm-library/creatures', keys: ['dm-library', 'creatures'] },
  { path: 'dm-library/scenes', keys: ['dm-library', 'scenes'] },
  { path: 'dm-library/items', keys: ['dm-library', 'items'] },
  { path: 'dm-library/spells', keys: ['dm-library', 'spells'] },
  { path: 'dm-library/enemy-actions', keys: ['dm-library', 'enemy-actions'] },
  {
    path: 'dm-library/stories/main/sections',
    keys: ['dm-library', 'stories', 'main', 'sections'],
  },
];

const [, , operation, fileName = 'battle-forge-data.json', serverUrl = 'http://127.0.0.1:8080'] =
  process.argv;
const endpoint = new URL('/api/data', serverUrl);

if (operation === 'export') await exportData();
else if (operation === 'import') await importData();
else fail('Usage: data-transfer.mjs <export|import> [file] [server-url]');

async function exportData() {
  const result = {};
  for (const collection of collections) {
    const url = new URL(endpoint);
    url.searchParams.set('path', collection.path);
    const response = await fetch(url);
    if (!response.ok) fail(`Cannot read ${collection.path}: HTTP ${response.status}`);
    const responseBody = await response.text();
    const value = responseBody ? JSON.parse(responseBody) : null;
    if (value !== null) setNested(result, collection.keys, value);
  }
  await writeFile(fileName, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Exported Battle Forge data to ${fileName}`);
}

async function importData() {
  const source = JSON.parse(await readFile(fileName, 'utf8'));
  for (const collection of collections) {
    const value = getNested(source, collection.keys);
    if (value === undefined) continue;
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: collection.path, data: value }),
    });
    if (!response.ok) fail(`Cannot write ${collection.path}: HTTP ${response.status}`);
  }
  console.log(`Imported Battle Forge data from ${fileName}`);
}

function getNested(value, keys) {
  let current = value;
  for (const key of keys) {
    if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
    current = current[key];
  }
  return current;
}

function setNested(target, keys, value) {
  let current = target;
  for (const key of keys.slice(0, -1)) {
    current[key] ??= {};
    current = current[key];
  }
  current[keys.at(-1)] = value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
