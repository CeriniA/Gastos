// Code audit: what the linter cannot see. Run with `npm run audit:code`.
// 1. Blocks of 8 or more identical lines in two places (copied code).
// 2. Exports nobody uses (dead code).
// 3. Numbers written in the middle of the code instead of a named constant.
// Exits with 1 when it finds something, so it can be part of a check.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FOLDERS = ['shared/src', 'backend/src', 'frontend/src'];
const BLOCK_LINES = 8;
/**
 * Numbers that are not "magic": counters, halves, percentages, date positions. Lengths of time live in
 * shared/src/dates.ts (MS_PER_*) and HTTP statuses in backend/src/core/http/status.ts, so neither is allowed here.
 */
const ALLOWED_NUMBERS = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '7',
  '8',
  '10',
  '12',
  '16',
  '100',
]);
const HTTP_STATUS = /\b(200|201|202|204|400|401|403|404|409|413|429|500|502)\b/;

function walk(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

const files = FOLDERS.flatMap((folder) => walk(join(ROOT, folder)));
const production = files.filter((file) => !file.includes('.test.'));
const text = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
const where = (file) => relative(ROOT, file);
const findings = [];

// 1. Copied blocks.
const blocks = new Map();
for (const file of production) {
  const lines = text
    .get(file)
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line.length > 3 && !/^(\/\/|\*|\/\*|import |[})\]];?$|<\/|\/>)/.test(line));
  for (let start = 0; start + BLOCK_LINES <= lines.length; start += 1) {
    const key = lines
      .slice(start, start + BLOCK_LINES)
      .map(({ line }) => line)
      .join('\n');
    const list = blocks.get(key) ?? [];
    list.push(`${where(file)}:${lines[start].number}`);
    blocks.set(key, list);
  }
}
const reported = new Set();
for (const places of blocks.values()) {
  const filesInvolved = [...new Set(places.map((place) => place.split(':')[0]))].sort().join(' + ');
  if (places.length > 1 && !reported.has(filesInvolved)) {
    reported.add(filesInvolved);
    findings.push(`Copied code: ${places.join(' and ')}`);
  }
}

// 2. Unused exports.
const everything = [...text.values()].join('\n');
const exported = /^export (?:async )?(?:function|const|interface|type|class) (\w+)/gm;
for (const file of production) {
  for (const [, name] of text.get(file).matchAll(exported)) {
    const uses = everything.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0;
    if (uses === 1) findings.push(`Unused export: ${where(file)} ${name}`);
  }
}

// 3. Loose numbers.
for (const file of production) {
  text
    .get(file)
    .split('\n')
    .forEach((line, index) => {
      const trimmed = line.trim();
      if (/^(\/\/|\*|\/\*|import )/.test(trimmed)) return;
      const code = trimmed.replace(/'[^']*'|"[^"]*"|`[^`]*`|\/[^/\n]+\/[gimsuy]*/g, '');
      if (/^(export )?const [A-Z][A-Z0-9_]*\s*[:=]/.test(code)) return; // a named constant
      if (/^[a-z][A-Za-z]*: \d/.test(code)) return; // a field of a named constants object
      if (/className|\.slice\(\d+, \d+\)|\bpad\(/.test(code)) return; // styles and fixed text positions
      if (HTTP_STATUS.test(code) && /status|AppError|super\(|ok\(/.test(code)) return;
      for (const [number] of code.matchAll(/(?<![\w.$])\d[\d_]*(\.\d+)?(?![\w])/g)) {
        if (!ALLOWED_NUMBERS.has(number)) {
          findings.push(`Loose number ${number}: ${where(file)}:${index + 1}`);
          break;
        }
      }
    });
}

for (const finding of findings) console.log(finding);
console.log(findings.length === 0 ? 'Audit clean.' : `${findings.length} finding(s).`);
process.exitCode = findings.length === 0 ? 0 : 1;
