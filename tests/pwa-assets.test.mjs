import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { GAMES } from '../core/registry.js';

// O sw.js decide o que abre sem internet: arquivo fora de ASSETS quebra o jogo
// offline, e asset alterado sem subir VERSION deixa o aparelho com o cache antigo.
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const lines = text => text.split(/\r?\n/).filter(Boolean);
const versionOf = source => source.match(/const VERSION = '([^']+)'/)?.[1];
const repeated = list => list.filter((item, i) => list.indexOf(item) !== i);

const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const assets = [...(sw.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
const cached = new Set(assets.filter(asset => asset !== './').map(asset => asset.replace(/^\.\//, '')));

test('sw.js tem VERSION e ASSETS sem repetição', () => {
  // Extrair ASSETS por regex não detecta uma vírgula ausente entre arquivos.
  // O navegador rejeita o worker inteiro antes de instalar o cache nesse caso.
  assert.doesNotThrow(() => new Script(sw), 'sw.js precisa ser JavaScript válido');
  assert.ok(versionOf(sw), 'VERSION não encontrada no sw.js');
  assert.ok(cached.has('index.html') && cached.has('play.html'), 'ASSETS não encontrado no sw.js');
  assert.deepEqual(repeated(assets), [], 'ASSETS repetido no sw.js');
});

test('todo arquivo de ASSETS existe', () => {
  assert.deepEqual([...cached].filter(file => !existsSync(join(root, file))), [], 'ASSETS aponta para arquivo inexistente');
});

test('todo arquivo servido pelo site está em ASSETS', () => {
  const served = ['index.html', 'play.html', 'manifest.webmanifest',
    ...lines(git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'assets', 'core', 'games'))]
    .filter(file => existsSync(join(root, file)));
  assert.deepEqual(served.filter(file => !cached.has(file)), [], 'Inclua em ASSETS no sw.js e suba VERSION');
});

test('catálogo e pastas de jogos batem', () => {
  assert.deepEqual(repeated(GAMES.map(game => game.id)), [], 'id repetido em core/registry.js');
  for (const game of GAMES.filter(game => game.status === 'ready')) {
    const entry = game.entry.replace(/^\.\//, '');
    assert.ok(existsSync(join(root, entry)), `${game.id}: ${game.entry} não existe`);
    assert.ok(cached.has(entry), `${game.id}: ${game.entry} fora de ASSETS`);
  }
  const registered = new Set(GAMES.map(game => game.entry.split('/').at(-2)));
  const folders = readdirSync(join(root, 'games'), { withFileTypes: true }).filter(dir => dir.isDirectory()).map(dir => dir.name);
  assert.deepEqual(folders.filter(folder => !registered.has(folder)), [], 'Pasta em games/ sem entrada em core/registry.js');
});

test('asset alterado desde BASE_REF sobe VERSION', t => {
  const base = process.env.BASE_REF;
  if (!base || /^0+$/.test(base)) return t.skip('defina BASE_REF (ex.: origin/main) para comparar');
  const changed = lines(git('diff', '--name-only', base)).filter(file => cached.has(file));
  if (!changed.length) return;
  const before = versionOf(git('show', `${base}:sw.js`));
  assert.notEqual(versionOf(sw), before, `VERSION continua ${before}, mas mudaram: ${changed.join(', ')}`);
});
