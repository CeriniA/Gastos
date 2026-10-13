import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MAX_DOCUMENT_FILES, UPLOADABLE_DOCUMENT_KINDS, type UploadableDocumentKind } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { Button, Card, Field, Notice, PageTitle, Select } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAccounts } from '../accounts/api';
import { useDocumentMutations } from './api';
import { compressImage } from './compress';
import { uploadFailure } from './uploadFailure';

/** The "+" screen: read a photo with the AI, or type a transaction by hand. */
export function AddPage() {
  const navigate = useNavigate();
  const accounts = useAccounts();
  const { upload } = useDocumentMutations();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<UploadableDocumentKind>('receipt');
  const [accountId, setAccountId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sameReceipt, setSameReceipt] = useState(false);
  const [busy, setBusy] = useState(false);
  const { failure, setFailure, run } = useAction(uploadFailure);

  const choose = (source: 'camera' | 'gallery') => (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (chosen.length === 0) return;
    setFailure(null);
    setFiles(chosen);
    // A photo taken now is almost always a paper receipt.
    if (source === 'camera') setKind('receipt');
    setSameReceipt(false);
  };

  const submit = async () => {
    setFailure(null);
    // Several images are several documents, unless they are parts of one long receipt.
    const groups = sameReceipt ? [files] : files.map((file) => [file]);
    if (groups.some((group) => group.length > MAX_DOCUMENT_FILES)) {
      setFailure(es.add.tooMany(MAX_DOCUMENT_FILES));
      return;
    }
    setBusy(true);
    let uploaded = 0;
    for (const group of groups) {
      const done = await run(async () => {
        const compressed = await Promise.all(group.map((file) => compressImage(file, kind)));
        await upload.mutateAsync({ kind, accountId, files: compressed });
      });
      if (done) uploaded += 1;
    }
    setBusy(false);

    if (uploaded === groups.length) {
      void navigate('/pendientes');
      return;
    }
    // When none went through, the reason of the last one is already shown.
    if (uploaded > 0) {
      setFiles([]);
      setFailure(es.add.partial(uploaded, groups.length));
    }
  };

  const activeAccounts = (accounts.data ?? []).filter((account) => !account.archived);

  return (
    <>
      <PageTitle>{es.add.title}</PageTitle>

      <Card className="mb-4">
        <h2 className="text-lg font-semibold">{es.add.photoTitle}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{es.add.photoText}</p>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => cameraInput.current?.click()} disabled={busy}>
            {es.add.takePhoto}
          </Button>
          <Button variant="secondary" onClick={() => galleryInput.current?.click()} disabled={busy}>
            {es.add.chooseFiles}
          </Button>
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={choose('camera')}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={choose('gallery')}
        />

        {files.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="font-medium">{es.add.selected(files.length)}</p>

            <fieldset className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-paper p-1">
              <legend className="sr-only">{es.add.kind}</legend>
              {UPLOADABLE_DOCUMENT_KINDS.map((option) => (
                <label
                  key={option}
                  className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm font-semibold ${
                    kind === option ? 'bg-income text-surface' : 'text-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={option}
                    checked={kind === option}
                    onChange={() => setKind(option)}
                    className="sr-only"
                  />
                  {es.add.kinds[option]}
                </label>
              ))}
            </fieldset>

            {files.length > 1 ? (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-muted">{es.add.groupQuestion}</legend>
                {[false, true].map((together) => (
                  <label key={String(together)} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="grouping"
                      className="size-5"
                      checked={sameReceipt === together}
                      onChange={() => setSameReceipt(together)}
                    />
                    {together ? es.add.together[kind] : es.add.separate[kind](files.length)}
                  </label>
                ))}
              </fieldset>
            ) : null}

            <Field label={`${es.add.account} (${es.common.optional})`}>
              <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="">{es.add.accountLater}</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
            </Field>

            <p className="text-sm text-muted">{es.add.keepPhoto}</p>
            <Button className="w-full" onClick={() => void submit()} disabled={busy}>
              {busy ? es.add.uploading : es.add.upload}
            </Button>
          </div>
        ) : null}

        {failure ? (
          <div className="mt-3">
            <Notice tone="error">{failure}</Notice>
          </div>
        ) : null}
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-semibold">{es.add.statementTitle}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{es.add.statementText}</p>
        <Link
          to="/agregar/resumen"
          className="flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 font-semibold"
        >
          {es.add.statement}
        </Link>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{es.add.manualTitle}</h2>
        <Link
          to="/movimientos/nuevo"
          className="flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 font-semibold"
        >
          {es.add.manual}
        </Link>
      </Card>
    </>
  );
}
