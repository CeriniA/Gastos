import { useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { IMPORT_COLUMNS, type ImportPreview, type ImportRow } from '@gastos/shared';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { Button, Card, Notice, PageTitle } from '../../shared/ui/ui';
import { dataApi } from './api';

type Message = { tone: 'success' | 'error' | 'attention'; text: string };

const HEADER_OF = Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.key, column.header]));

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
  const [preview, setPreview] = useState<ImportPreview | null>(null);
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
      setPreview(await dataApi.previewImport(file));
    });

  const importable: ImportRow[] = (preview?.rows ?? []).flatMap((entry) =>
    entry.row && entry.issues.length === 0 && (includeDuplicates || !entry.duplicate) ? [entry.row] : [],
  );
  const needsCreation = Boolean(preview && (preview.newCategories.length > 0 || preview.newTags.length > 0));

  const commit = () =>
    run(async () => {
      const result = await dataApi.commitImport({ rows: importable, createMissing });
      setPreview(null);
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
                  {es.data.preview.newCategories(preview.newCategories.join(', '))}
                </Notice>
              ) : null}
              {preview.newTags.length > 0 ? (
                <Notice tone="attention">{es.data.preview.newTags(preview.newTags.join(', '))}</Notice>
              ) : null}
              {preview.duplicateRows > 0 ? (
                <Notice tone="attention">{es.data.preview.duplicates(preview.duplicateRows)}</Notice>
              ) : null}
            </div>

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
              <Button variant="secondary" disabled={busy} onClick={() => setPreview(null)}>
                {es.common.cancel}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
