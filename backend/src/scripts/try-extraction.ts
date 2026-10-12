import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_TIMEZONE,
  UPLOADABLE_DOCUMENT_KINDS,
  formatDate,
  formatMoney,
  todayIso,
  type CategoryKind,
  type UploadableDocumentKind,
} from '@gastos/shared';
import { detectImageType } from '../modules/documents/fileType';
import { failureReason, type ExtractionCategory } from '../providers/ai/aiExtractor';
import { createGeminiExtractor } from '../providers/ai/gemini';
import { SEED_CATEGORIES } from './seedData';

/**
 * Sends real receipts and screenshots to the AI and prints what it reads,
 * without touching the database. Use it to judge reading quality, compare
 * models and adjust the prompt before trusting the feature.
 *
 * Usage (each image is read as a separate document):
 *   npm run try-extraction -w backend -- "C:\ruta\a\carpeta-o-imagen" [--kind receipt|screenshot] [--model nombre]
 *
 * Needs GEMINI_API_KEY in backend/.env. Uses the starting categories, not the
 * ones in your database. Every image is one request against the daily quota.
 */

try {
  process.loadEnvFile();
} catch {
  // No .env file: the key must come from the environment.
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const target = process.argv
  .slice(2)
  .find((argument, index, all) => !argument.startsWith('--') && !all[index - 1]?.startsWith('--'));
const kind = (option('kind') ?? 'receipt') as UploadableDocumentKind;
const model = option('model') ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
const apiKey = process.env.GEMINI_API_KEY?.trim();

if (!target || !UPLOADABLE_DOCUMENT_KINDS.includes(kind)) {
  console.error(
    'Uso: npm run try-extraction -w backend -- "<carpeta o imagen>" [--kind receipt|screenshot] [--model nombre]',
  );
  process.exit(1);
}
if (!apiKey) {
  console.error(
    'Falta GEMINI_API_KEY en backend/.env. Se obtiene en https://aistudio.google.com (Get API key).',
  );
  process.exit(1);
}

const absolute = path.resolve(process.env.INIT_CWD ?? process.cwd(), target);
const isFolder = await stat(absolute).then(
  (info) => info.isDirectory(),
  () => {
    console.error(`No existe la carpeta o imagen: ${absolute}`);
    console.error(
      'Reemplazá la ruta del ejemplo por la de una carpeta tuya con fotos, por ejemplo "C:\\Users\\Adrian\\Desktop\\tickets".',
    );
    process.exit(1);
  },
);
const paths = isFolder
  ? (await readdir(absolute))
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .sort()
      .map((name) => path.join(absolute, name))
  : [absolute];
if (paths.length === 0) {
  console.error('No hay imágenes JPG, PNG o WEBP en esa carpeta.');
  process.exit(1);
}

const categories: ExtractionCategory[] = (Object.keys(SEED_CATEGORIES) as CategoryKind[]).flatMap(
  (categoryKind) => SEED_CATEGORIES[categoryKind].map((name) => ({ id: '', kind: categoryKind, path: name })),
);
categories.forEach((category, index) => {
  category.id = (index + 1).toString(16).padStart(24, '0');
});
const categoryName = new Map(categories.map((category) => [category.id, category.path]));

const extractor = createGeminiExtractor({ apiKey, model });
const today = todayIso(process.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE);
console.log(`Modelo: ${model} | Tipo: ${kind} | Imágenes: ${paths.length}\n`);

let failures = 0;
for (const file of paths) {
  console.log(`=== ${path.basename(file)}`);
  const content = await readFile(file);
  const mimeType = detectImageType(content);
  if (!mimeType) {
    console.log('  No es una imagen JPG, PNG o WEBP válida.\n');
    failures += 1;
    continue;
  }
  const started = Date.now();
  try {
    const result = await extractor.extract({ kind, files: [{ content, mimeType }], categories, today });
    console.log(
      `  ${((Date.now() - started) / 1000).toFixed(1)} s, ${result.transactions.length} movimiento(s)`,
    );
    for (const transaction of result.transactions) {
      const amount =
        transaction.amountCents !== null && transaction.currency
          ? formatMoney(transaction.amountCents, transaction.currency)
          : `${transaction.amountCents ?? '?'} centavos, moneda ${transaction.currency ?? '?'}`;
      console.log(
        `  - ${transaction.type} | ${transaction.date ? formatDate(transaction.date) : 'sin fecha'} | ${amount}`,
      );
      console.log(
        `    comercio: ${transaction.merchant || '(vacío)'} | descripción: ${transaction.description || '(vacía)'}`,
      );
      console.log(
        `    categoría sugerida: ${categoryName.get(transaction.suggestedCategoryId ?? '') ?? '(ninguna)'}`,
      );
      if (transaction.installment) {
        console.log(`    cuota ${transaction.installment.number} de ${transaction.installment.total}`);
      }
      if (transaction.items.length > 0) {
        const lines = transaction.items.map((item) => `${item.name} ${(item.amountCents / 100).toFixed(2)}`);
        console.log(
          `    ítems (${lines.length}): ${lines.slice(0, 8).join('; ')}${lines.length > 8 ? '; …' : ''}`,
        );
      }
      if (transaction.uncertainFields.length > 0) {
        console.log(`    DUDOSO: ${transaction.uncertainFields.join(', ')}`);
      }
    }
    for (const warning of result.warnings) console.log(`  aviso: ${warning}`);
  } catch (error) {
    failures += 1;
    console.log(
      `  FALLÓ (${failureReason(error) ?? 'error'}): ${error instanceof Error ? error.message : String(error)}`,
    );
    const details = (error as { details?: unknown }).details;
    if (details) console.log(`  detalle: ${JSON.stringify(details).slice(0, 600)}`);
  }
  console.log('');
}

console.log(
  failures === 0 ? 'Listo: todas las imágenes se leyeron.' : `Listo, con ${failures} imagen(es) sin leer.`,
);
