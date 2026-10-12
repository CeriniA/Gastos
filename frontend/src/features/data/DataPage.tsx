import { useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import {
  CATEGORY_PATH_SEPARATOR,
  IMPORT_COLUMNS,
  categoryPathKey,
  nameKey,
  pathOf,
  type ImportPreview,
  type ImportRow,
} from '@gastos/shared';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { Button, Card, Field, Notice, PageTitle, Select } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { optionLabel, orderedTree } from '../categories/tree';
import { dataApi } from './api';

type Message = { tone: 'success' | 'error' | 'attention'; text: string };

const HEADER_OF = Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.key, column.header]));

/** What the user said about names the file uses and the app does not know. */
interface Mapping {
  /** Unknown account name (normalised) → name of the existing account it stands for. */
  accounts: Record<string, string>;
  /** Unknown category (see categoryPathKey) → id of the existing category to use instead. */
  categories: Record<string, string>;
}

const NO_MAPPING: Mapping = { accounts: {}, categories: {} };

function Section({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-3 mt-1 text-sm text-muted">{text}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </Card>
  );
}

function FilePicker({
  accept,
  label,
  onFile,
}: {
  accept: string;
  label: string;
  onFile: (file: File) => void;
}) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFile(file);
  };
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-surface px-4 text-base font-semibold">
      {label}
      <input type="file" accept={accept} className="sr-only" onChange={change} />
    </label>
  );
}

export function DataPage() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const accounts = useAccounts();
  const categories = useCategories();
  /** The file as it was read, kept so the user's choices can be applied again from scratch. */
  const [original, setOriginal] = useState<ImportPreview | null>(null);
  /** What is shown: the file after applying the user's choices. */
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Mapping>(NO_MAPPING);
  const [createMissing, setCreateMissing] = useState(true);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);

  /** Runs one action at a time and reports how it went. */
  const run = async (work: () => Promise<Message | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      if (result) setMessage(result);
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const restore = (file: File) =>
    run(async () => {
      let backup: unknown;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        return { tone: 'error', text: es.errors.INVALID_BACKUP };
      }
      const result = await dataApi.restoreBackup(backup);
      setRestoreConfirmed(false);
      await client.invalidateQueries();
      const total = Object.values(result.restored).reduce((sum, count) => sum + count, 0);
      return { tone: 'success', text: es.data.restoreDone(total) };
    });

  const checkIntegrity = () =>
    run(async () => {
      const report = await dataApi.checkIntegrity();
      return report.ok
        ? { tone: 'success', text: es.data.integrityOk }
        : { tone: 'attention', text: es.data.integrityBroken(report.broken.length) };
    });

  const loadPreview = (file: File) =>
    run(async () => {
      const read = await dataApi.previewImport(file);
      setOriginal(read);
      setPreview(read);
      setMapping(NO_MAPPING);
    });

  const closePreview = () => {
    setOriginal(null);
    setPreview(null);
    setMapping(NO_MAPPING);
  };

  /**
   * Rewrites the rows with the user's choices and asks the server to check
   * them again, so what is shown is always what would be imported.
   */
  const applyMapping = (next: Mapping) =>
    run(async () => {
      if (!original) return;
      setMapping(next);
      const accountFor = (name: string) => next.accounts[nameKey(name)] ?? name;
      const rows = original.rows.flatMap((entry) => {
        if (!entry.row) return [];
        const row = entry.row;
        const categoryId =
          row.type === 'transfer' ? undefined : next.categories[categoryPathKey(row.type, row.categoryPath)];
        return [
          {
            line: entry.line,
            row: {
              ...row,
              account: accountFor(row.account),
              toAccount: row.toAccount ? accountFor(row.toAccount) : null,
              categoryPath: categoryId ? pathOf(categoryId, categories.data ?? []) : row.categoryPath,
            },
          },
        ];
      });
      if (rows.length === 0) return;
      const reviewed = await dataApi.reviewImport({ rows });
      const unreadable = original.rows.filter((entry) => !entry.row);
      setPreview({
        ...reviewed,
        fileName: original.fileName,
        missingHeaders: original.missingHeaders,
        unknownHeaders: original.unknownHeaders,
        totalRows: original.totalRows,
        invalidRows: original.totalRows - reviewed.validRows,
        rows: [...reviewed.rows, ...unreadable].sort((a, b) => a.line - b.line),
      });
    });

  const importable: ImportRow[] = (preview?.rows ?? []).flatMap((entry) =>
    entry.row && entry.issues.length === 0 && (includeDuplicates || !entry.duplicate) ? [entry.row] : [],
  );
  const needsCreation = Boolean(preview && (preview.newCategories.length > 0 || preview.newTags.length > 0));

  const commit = () =>
    run(async () => {
      const result = await dataApi.commitImport({ rows: importable, createMissing });
      closePreview();
      await client.invalidateQueries();
      return { tone: 'success', text: es.data.importDone(result.imported) };
    });

  return (
    <>
      <PageTitle>{es.data.title}</PageTitle>
      <div className="space-y-4">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Section title={es.data.backupTitle} text={es.data.backupText}>
          <Button disabled={busy} onClick={() => void run(dataApi.downloadBackup)}>
            {es.data.backupDownload}
          </Button>
        </Section>

        <Section title={es.data.restoreTitle} text={es.data.restoreText}>
          <label className="flex w-full items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={restoreConfirmed}
              onChange={(event) => setRestoreConfirmed(event.target.checked)}
            />
            {es.data.restoreConfirm}
          </label>
          {restoreConfirmed && !busy ? (
            <FilePicker
              accept="application/json,.json"
              label={es.data.restoreAction}
              onFile={(file) => void restore(file)}
            />
          ) : null}
        </Section>

        <Section title={es.data.integrityTitle} text={es.data.integrityText}>
          <Button variant="secondary" disabled={busy} onClick={() => void checkIntegrity()}>
            {es.data.integrityAction}
          </Button>
        </Section>

        <Section title={es.data.exportTitle} text={es.data.exportText}>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => dataApi.exportTransactions('xlsx'))}
          >
            {es.data.exportXlsx}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => dataApi.exportTransactions('csv'))}
          >
            {es.data.exportCsv}
          </Button>
        </Section>

        <Section title={es.data.importTitle} text={es.data.importText}>
          <Button variant="quiet" disabled={busy} onClick={() => void run(dataApi.downloadTemplate)}>
            {es.data.template}
          </Button>
          {busy ? null : (
            <FilePicker
              accept=".xlsx,.csv"
              label={es.data.chooseFile}
              onFile={(file) => void loadPreview(file)}
            />
          )}
        </Section>

        {preview ? (
          <Card>
            <h2 className="text-lg font-semibold">{preview.fileName}</h2>
            <p className="mt-1">{es.data.preview.summary(preview.validRows, preview.totalRows)}</p>

            <div className="mt-3 space-y-2">
              {preview.missingHeaders.length > 0 ? (
                <Notice tone="error">
                  {es.data.preview.missingHeaders(preview.missingHeaders.join(', '))}
                </Notice>
              ) : null}
              {preview.unknownHeaders.length > 0 ? (
                <Notice>{es.data.preview.unknownHeaders(preview.unknownHeaders.join(', '))}</Notice>
              ) : null}
              {preview.newCategories.length > 0 ? (
                <Notice tone="attention">
                  {es.data.preview.newCategories(
                    preview.newCategories.map((ref) => ref.path.join(CATEGORY_PATH_SEPARATOR)).join(', '),
                  )}
                </Notice>
              ) : null}
              {preview.newTags.length > 0 ? (
                <Notice tone="attention">{es.data.preview.newTags(preview.newTags.join(', '))}</Notice>
              ) : null}
              {preview.duplicateRows > 0 ? (
                <Notice tone="attention">{es.data.preview.duplicates(preview.duplicateRows)}</Notice>
              ) : null}
            </div>

            {original && original.unknownAccounts.length > 0 ? (
              <fieldset className="mt-4 space-y-3 rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-semibold">{es.data.preview.accountsTitle}</legend>
                <p className="text-sm text-muted">{es.data.preview.accountsText}</p>
                {original.unknownAccounts.map((name) => (
                  <Field key={name} label={es.data.preview.accountIs(name)}>
                    <Select
                      value={mapping.accounts[nameKey(name)] ?? ''}
                      disabled={busy}
                      onChange={(event) => {
                        const { [nameKey(name)]: _previous, ...others } = mapping.accounts;
                        const chosen = event.target.value;
                        void applyMapping({
                          ...mapping,
                          accounts: chosen ? { ...others, [nameKey(name)]: chosen } : others,
                        });
                      }}
                    >
                      <option value="">{es.data.preview.accountSkip}</option>
                      {(accounts.data ?? [])
                        .filter((account) => !account.archived)
                        .map((account) => (
                          <option key={account.id} value={account.name}>
                            {account.name} ({account.currency})
                          </option>
                        ))}
                    </Select>
                  </Field>
                ))}
              </fieldset>
            ) : null}

            {original && original.newCategories.length > 0 ? (
              <fieldset className="mt-4 space-y-3 rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-semibold">{es.data.preview.categoriesTitle}</legend>
                <p className="text-sm text-muted">{es.data.preview.categoriesText}</p>
                {original.newCategories.map((ref) => {
                  const key = categoryPathKey(ref.kind, ref.path);
                  return (
                    <Field
                      key={key}
                      label={es.data.preview.categoryIs(
                        ref.path.join(CATEGORY_PATH_SEPARATOR),
                        es.kinds[ref.kind],
                      )}
                    >
                      <Select
                        value={mapping.categories[key] ?? ''}
                        disabled={busy}
                        onChange={(event) => {
                          const { [key]: _previous, ...others } = mapping.categories;
                          const chosen = event.target.value;
                          void applyMapping({
                            ...mapping,
                            categories: chosen ? { ...others, [key]: chosen } : others,
                          });
                        }}
                      >
                        <option value="">{es.data.preview.categoryCreate}</option>
                        {orderedTree(categories.data ?? [], ref.kind)
                          .filter((category) => !category.archived)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {optionLabel(category)}
                            </option>
                          ))}
                      </Select>
                    </Field>
                  );
                })}
              </fieldset>
            ) : null}

            {preview.rows.some((entry) => entry.issues.length > 0) ? (
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                {preview.rows
                  .filter((entry) => entry.issues.length > 0)
                  .map((entry) => (
                    <li key={entry.line} className="text-expense">
                      <strong>{es.data.preview.line(entry.line)}:</strong>{' '}
                      {entry.issues
                        .map(
                          (issue) =>
                            `${HEADER_OF[issue.column] ?? issue.column}, ${es.importIssues[issue.code]}`,
                        )
                        .join('; ')}
                    </li>
                  ))}
              </ul>
            ) : null}

            <div className="mt-4 space-y-2 text-sm">
              {needsCreation ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={createMissing}
                    onChange={(event) => setCreateMissing(event.target.checked)}
                  />
                  {es.data.preview.createMissing}
                </label>
              ) : null}
              {preview.duplicateRows > 0 ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={includeDuplicates}
                    onChange={(event) => setIncludeDuplicates(event.target.checked)}
                  />
                  {es.data.preview.includeDuplicates}
                </label>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              {importable.length > 0 ? (
                <Button disabled={busy || (needsCreation && !createMissing)} onClick={() => void commit()}>
                  {es.data.preview.confirm(importable.length)}
                </Button>
              ) : (
                <p className="text-muted">{es.data.preview.nothing}</p>
              )}
              <Button variant="secondary" disabled={busy} onClick={closePreview}>
                {es.common.cancel}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
