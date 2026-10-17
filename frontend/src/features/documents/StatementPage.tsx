import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MAX_HIDDEN_WORDS,
  MAX_PDF_PASSWORD_LENGTH,
  MIN_HIDDEN_WORD_LENGTH,
  STATEMENT_KINDS,
  hideWords,
  statementUploadSchema,
  type StatementKind,
  type StatementPreview,
} from '@gastos/shared';
import { fieldMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import {
  Button,
  Card,
  Field,
  Notice,
  PageTitle,
  Select,
  Tabs,
  TextArea,
  TextInput,
} from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAccounts } from '../accounts/api';
import { useDocumentMutations } from './api';
import { uploadFailure } from './uploadFailure';

/** Where this phone remembers the words to hide. They never leave it. */
const HIDDEN_WORDS_KEY = 'gastos.statement.hiddenWords';
/** Enough lines to read a good part of a statement without scrolling the page. */
const TEXT_ROWS = 16;
/** What the file picker offers: what banks and apps let their movements be downloaded as. */
const ACCEPTED_FILES =
  '.pdf,.xlsx,.csv,.txt,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Only a PDF can carry a password. */
const isPdf = (file: File | null) => !file || /\.pdf$/i.test(file.name) || file.type === 'application/pdf';

function loadWords(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HIDDEN_WORDS_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((word): word is string => typeof word === 'string') : [];
  } catch {
    return [];
  }
}

function saveWords(words: readonly string[]) {
  try {
    localStorage.setItem(HIDDEN_WORDS_KEY, JSON.stringify(words));
  } catch {
    // Private mode or storage blocked: the words just are not remembered.
  }
}

/**
 * Reading a statement in two steps, a card's or any other account's: the
 * server extracts the text of the PDF, Excel or CSV file and hides what it
 * recognises; the user reads it, hides anything else and only then sends it
 * to the AI. The file itself is never stored.
 */
export function StatementPage() {
  const navigate = useNavigate();
  const accounts = useAccounts();
  const { previewStatement, uploadStatement } = useDocumentMutations();
  const { failure, setFailure, run } = useAction(uploadFailure);
  const fileInput = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<StatementKind>('card_statement');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState('');
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [text, setText] = useState('');
  const [words, setWords] = useState<string[]>(loadWords);
  const [newWord, setNewWord] = useState('');

  // A card's statement goes to a card; any other statement, to any other account.
  const choices = (accounts.data ?? []).filter(
    (account) => !account.archived && (account.type === 'credit_card') === (kind === 'card_statement'),
  );

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = '';
    setFile(chosen);
    setPreview(null);
    setFailure(null);
  };

  const read = () =>
    run(async () => {
      if (!file) return;
      const result = await previewStatement.mutateAsync({ file, password: isPdf(file) ? password : '' });
      setPreview(result);
      setText(hideWords(result.text, words).text);
    });

  const addWord = () => {
    const word = newWord.trim();
    if (word.length < MIN_HIDDEN_WORD_LENGTH || words.length >= MAX_HIDDEN_WORDS) return;
    const next = [...new Set([...words, word])];
    setWords(next);
    saveWords(next);
    setText((current) => hideWords(current, [word]).text);
    setNewWord('');
  };

  const removeWord = (word: string) => {
    const next = words.filter((candidate) => candidate !== word);
    setWords(next);
    saveWords(next);
  };

  const send = () => {
    const parsed = statementUploadSchema.safeParse({ kind, text, fileName: file?.name ?? '', accountId });
    if (!parsed.success) {
      setFailure(fieldMessage(parsed.error.issues[0]?.message ?? 'invalid'));
      return;
    }
    void run(async () => {
      await uploadStatement.mutateAsync(parsed.data);
      void navigate('/pendientes');
    });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setText('');
    setFailure(null);
  };

  return (
    <>
      <PageTitle>{es.statement.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.statement.intro}</p>

      {preview ? (
        <div className="space-y-4">
          <Notice>{es.statement.found(preview.fileType, preview.pages, preview.hidden)}</Notice>
          <Notice tone="attention">{es.statement.check}</Notice>

          <Card>
            <Field label={es.statement.words} hint={es.statement.wordsHint}>
              <div className="flex gap-2">
                <TextInput
                  value={newWord}
                  placeholder={es.statement.wordPlaceholder}
                  onChange={(event) => setNewWord(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addWord();
                    }
                  }}
                />
                <Button variant="secondary" onClick={addWord}>
                  {es.statement.addWord}
                </Button>
              </div>
            </Field>
            {words.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {words.map((word) => (
                  <li key={word}>
                    <button
                      type="button"
                      className="min-h-9 rounded-full border border-line bg-paper px-3 text-sm"
                      aria-label={es.statement.removeWord(word)}
                      onClick={() => removeWord(word)}
                    >
                      {word} ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Field label={es.statement.text}>
            <TextArea rows={TEXT_ROWS} value={text} onChange={(event) => setText(event.target.value)} />
          </Field>

          {failure ? <Notice tone="error">{failure}</Notice> : null}
          <p className="text-sm text-muted">{es.statement.keepText}</p>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={uploadStatement.isPending} onClick={send}>
              {uploadStatement.isPending ? es.statement.sending : es.statement.send}
            </Button>
            <Button variant="secondary" onClick={reset}>
              {es.statement.another}
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium text-muted">{es.statement.kind}</p>
              <Tabs
                options={STATEMENT_KINDS}
                value={kind}
                label={(option) => es.statement.kinds[option]}
                onChange={(option) => {
                  setKind(option);
                  setAccountId('');
                }}
              />
              <p className="-mt-2 text-sm text-muted">{es.statement.kindHints[kind]}</p>
            </div>
            <Field
              label={es.statement.file}
              hint={file ? es.statement.chosen(file.name) : es.statement.fileHint}
            >
              <Button variant="secondary" className="w-full" onClick={() => fileInput.current?.click()}>
                {es.statement.choose}
              </Button>
            </Field>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_FILES}
              className="sr-only"
              tabIndex={-1}
              onChange={choose}
            />
            {isPdf(file) ? (
              <Field
                label={`${es.statement.password} (${es.common.optional})`}
                hint={es.statement.passwordHint}
              >
                <TextInput
                  type="password"
                  autoComplete="off"
                  maxLength={MAX_PDF_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
            ) : null}
            <Field label={`${es.statement.accounts[kind]} (${es.common.optional})`}>
              <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="">{es.add.accountLater}</option>
                {choices.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
            </Field>
            {failure ? <Notice tone="error">{failure}</Notice> : null}
            <Button
              className="w-full"
              disabled={!file || previewStatement.isPending}
              onClick={() => void read()}
            >
              {previewStatement.isPending ? es.statement.reading : es.statement.read}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
