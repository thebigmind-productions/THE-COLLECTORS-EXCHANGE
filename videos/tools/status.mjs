#!/usr/bin/env node
/**
 * Video script status tracker — one clear place to plan and track video
 * production. You paste a video script (`<id>.md`) into scripts/undone/, the
 * agent picks it up and builds the composition, and the file moves through
 * the board as work progresses.
 *
 * Each video is a script file (`<id>.md`) living in exactly one of three
 * folders under scripts/:
 *
 *   scripts/undone/         idea/script not started
 *   scripts/in-progress/    being worked on (VO, edit, render)
 *   scripts/completed/      rendered and delivered
 *
 * Usage:
 *
 *   node tools/status.mjs                        list all videos grouped by status
 *   node tools/status.mjs new <id>               create a script file in undone/
 *   node tools/status.mjs promote <id>           undone -> in-progress -> completed
 *   node tools/status.mjs demote <id>            move one step back
 *   node tools/status.mjs set <id> <status>      move to a specific status
 *   node tools/status.mjs init                   (re)create the script folders
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(root, 'scripts');
const STATUSES = ['undone', 'in-progress', 'completed'];

const TEMPLATE = (id) => `# ${id}

## Idea
What is this video, who is it for, what job does it do?

## Structure
- Hook:
- Body:
- CTA:

## Script (Microsoft TTS — continuous flow, comma/em-dash joined)
> Write the voiceover here. Long flowing sentences, no abrupt 2-3 word
> endings, natural rhythm across clauses.

## Assets
- Photography: (candidate sources)
- Music: (SFX.music / SFX.musicSparse / SFX.bgMusic)
- Narration clips: (public/audio/narration/)

## Checklist
- [ ] Script approved
- [ ] Narration generated
- [ ] Composition built
- [ ] Rendered + ffprobe verified
`;

function ensureFolders() {
  for (const s of STATUSES) mkdirSync(join(SCRIPTS, s), { recursive: true });
}

function scriptFile(id) {
  const current = findStatus(id);
  return current ? join(SCRIPTS, current, `${id}.md`) : join(SCRIPTS, STATUSES[0], `${id}.md`);
}

function findStatus(id) {
  for (const s of STATUSES) {
    if (existsSync(join(SCRIPTS, s, `${id}.md`))) return s;
  }
  return null;
}

function listVideos() {
  const out = { undone: [], 'in-progress': [], completed: [] };
  for (const s of STATUSES) {
    const dir = join(SCRIPTS, s);
    if (!existsSync(dir)) continue;
    out[s] = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
  }
  return out;
}

function printStatus() {
  ensureFolders();
  const videos = listVideos();
  console.log('Video script board\n');
  for (const s of STATUSES) {
    const ids = videos[s];
    console.log(
      `  [${s}]${' '.repeat(Math.max(1, 11 - s.length))}${ids.length ? ids.join(', ') : '(empty)'}`,
    );
  }
}

function move(id, from, to) {
  const fromPath = join(SCRIPTS, from, `${id}.md`);
  const toPath = join(SCRIPTS, to, `${id}.md`);
  if (!existsSync(fromPath)) {
    console.error(`No script file for "${id}" in ${from}/ — nothing to move.`);
    process.exit(1);
  }
  mkdirSync(dirname(toPath), { recursive: true });
  writeFileSync(toPath, readFileSync(fromPath, 'utf-8'));
  rmSync(fromPath);
  console.log(`Moved ${id}: ${from} -> ${to}`);
}

const [cmd, arg1, arg2] = process.argv.slice(2);

ensureFolders();

switch (cmd) {
  case 'new': {
    const id = arg1;
    if (!id) {
      console.error('Usage: node tools/status.mjs new <id>');
      process.exit(1);
    }
    const dest = join(SCRIPTS, 'undone', `${id}.md`);
    if (existsSync(dest)) {
      console.error(`"${id}" already has a script file in undone/.`);
      process.exit(1);
    }
    writeFileSync(dest, TEMPLATE(id));
    console.log(`Created scripts/undone/${id}.md`);
    break;
  }

  case 'set': {
    const id = arg1;
    const to = arg2;
    if (!id || !STATUSES.includes(to)) {
      console.error(`Usage: node tools/status.mjs set <id> <${STATUSES.join('|')}>`);
      process.exit(1);
    }
    const from = findStatus(id);
    if (!from) {
      console.error(`No script file for "${id}". Run "node tools/status.mjs new ${id}".`);
      process.exit(1);
    }
    if (from === to) {
      console.log(`${id} is already ${to}.`);
      break;
    }
    move(id, from, to);
    break;
  }

  case 'promote': {
    const id = arg1;
    if (!id) {
      console.error('Usage: node tools/status.mjs promote <id>');
      process.exit(1);
    }
    const from = findStatus(id);
    if (!from) {
      console.error(`No script file for "${id}". Run "node tools/status.mjs new ${id}".`);
      process.exit(1);
    }
    const next = STATUSES[Math.min(STATUSES.length - 1, STATUSES.indexOf(from) + 1)];
    if (from === next) {
      console.log(`${id} is already ${next}.`);
      break;
    }
    move(id, from, next);
    break;
  }

  case 'demote': {
    const id = arg1;
    if (!id) {
      console.error('Usage: node tools/status.mjs demote <id>');
      process.exit(1);
    }
    const from = findStatus(id);
    if (!from) {
      console.error(`No script file for "${id}". Run "node tools/status.mjs new ${id}".`);
      process.exit(1);
    }
    const prev = STATUSES[Math.max(0, STATUSES.indexOf(from) - 1)];
    if (from === prev) {
      console.log(`${id} is already ${prev}.`);
      break;
    }
    move(id, from, prev);
    break;
  }

  case 'init':
    console.log('Script folders ready: scripts/undone, scripts/in-progress, scripts/completed');
    break;

  default:
    printStatus();
    break;
}
