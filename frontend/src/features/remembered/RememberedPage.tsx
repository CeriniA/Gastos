import type { ReactNode } from 'react';
import { DEFAULT_TIMEZONE, TRASH_RETENTION_DAYS, formatMoment, pathOf } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Notice, PageTitle } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useCategories } from '../categories/api';
import {
  useCategoryRules,
  useConfirmedDocuments,
  useProductRules,
  useRememberedMutations,
  type DocumentTransactions,
} from './api';

/** A titled list, with what to show when it is empty. */
function Section({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">{text}</p>
      {children}
    </section>
  );
}

const LIST = 'divide-y divide-line rounded-2xl bg-surface shadow-card';
const ROW = 'flex items-center justify-between gap-3 py-2 pl-3 pr-2';

/**
 * What the app learned from the user and keeps: which category each merchant
 * goes to, how each receipt line is called, and the documents already
 * confirmed. Each one can be forgotten from here.
 */
export function RememberedPage() {
  const categoryRules = useCategoryRules();
  const productRules = useProductRules();
  const documents = useConfirmedDocuments();
  const categories = useCategories();
  const { forgetCategoryRule, forgetProductRule, removeDocument } = useRememberedMutations();
  const { failure, run } = useAction();
  const busy = forgetCategoryRule.isPending || forgetProductRule.isPending || removeDocument.isPending;

  const removeDocumentWith = (id: string, transactions: DocumentTransactions) => {
    const question =
      transactions === 'keep' ? es.remembered.keepConfirm : es.remembered.deleteConfirm(TRASH_RETENTION_DAYS);
    if (window.confirm(question)) void run(() => removeDocument.mutateAsync({ id, transactions }));
  };

  return (
    <>
      <PageTitle>{es.remembered.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.remembered.text}</p>
      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <div className="space-y-6">
        <Section title={es.remembered.categoryRulesTitle} text={es.remembered.categoryRulesText}>
          <QueryState query={categoryRules} empty={es.remembered.categoryRulesEmpty}>
            {(rules) => (
              <ul className={LIST}>
                {rules.map((rule) => (
                  <li key={rule.id} className={ROW}>
                    <span className="min-w-0">
                      <span className="block break-words font-medium">{rule.merchant}</span>
                      <span className="block text-sm text-muted">
                        {pathOf(rule.categoryId, categories.data ?? []).join(' > ')}
                      </span>
                    </span>
                    <Button
                      variant="quietDanger"
                      className="shrink-0"
                      disabled={busy}
                      onClick={() => void run(() => forgetCategoryRule.mutateAsync(rule.id))}
                    >
                      {es.remembered.forget}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </Section>

        <Section title={es.remembered.productRulesTitle} text={es.remembered.productRulesText}>
          <QueryState query={productRules} empty={es.remembered.productRulesEmpty}>
            {(rules) => (
              <ul className={LIST}>
                {rules.map((rule) => (
                  <li key={rule.id} className={ROW}>
                    <span className="min-w-0">
                      <span className="block break-words font-medium">{rule.name}</span>
                      <span className="block text-sm text-muted">
                        {[rule.product, rule.group ? es.productGroups[rule.group] : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <Button
                      variant="quietDanger"
                      className="shrink-0"
                      disabled={busy}
                      onClick={() => void run(() => forgetProductRule.mutateAsync(rule.id))}
                    >
                      {es.remembered.forget}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </Section>

        <Section title={es.remembered.documentsTitle} text={es.remembered.documentsText}>
          <QueryState query={documents} empty={es.remembered.documentsEmpty}>
            {(confirmed) => (
              <ul className={LIST}>
                {confirmed.map((document) => (
                  <li key={document.id} className="space-y-2 p-3">
                    <span className="block break-words font-medium">
                      {es.add.kinds[document.kind]}, {document.fileName}
                    </span>
                    <span className="block text-sm text-muted">
                      {es.remembered.uploaded(formatMoment(document.createdAt, DEFAULT_TIMEZONE))}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => removeDocumentWith(document.id, 'keep')}
                      >
                        {es.remembered.keep}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => removeDocumentWith(document.id, 'delete')}
                      >
                        {es.remembered.delete}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </Section>
      </div>
    </>
  );
}
