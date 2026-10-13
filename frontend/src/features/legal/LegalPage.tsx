import { Link } from 'react-router-dom';
import { formatDate } from '@gastos/shared';
import { CONTACT_EMAIL } from '../../shared/config';
import { es } from '../../shared/i18n/es';
import { legal, type LegalDocument } from '../../shared/i18n/legal';

const DOCUMENTS = [legal.privacy, legal.terms];

/**
 * The privacy policy or the terms of use. A public page: it is read without
 * signing in, by users and by whoever reviews the app (Google links to it from
 * the screen where a user grants access to their Drive).
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  const others = DOCUMENTS.filter((other) => other.path !== document.path);
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-sm font-semibold text-muted">{es.appName}</p>
      <h1 className="text-3xl font-bold tracking-tight">{document.title}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{legal.updatedOn(formatDate(document.updated))}</p>

      <div className="space-y-3">
        {document.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {document.sections.map((section) => (
        <section key={section.title} className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.lead ? <p>{section.lead}</p> : null}
          {section.items ? (
            <ul className="list-disc space-y-2 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{legal.contactTitle}</h2>
        {CONTACT_EMAIL ? (
          <p>
            {legal.contactWith}{' '}
            <a className="font-semibold underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        ) : (
          <p>{legal.contactWithout}</p>
        )}
      </section>

      <footer className="mt-10 space-y-2 border-t border-line pt-4 text-sm">
        <p>
          {legal.seeAlso}{' '}
          {others.map((other) => (
            <Link key={other.path} to={other.path} className="font-semibold underline">
              {other.title}
            </Link>
          ))}
        </p>
        <p>
          <Link to="/" className="font-semibold underline">
            {legal.back}
          </Link>
        </p>
      </footer>
    </main>
  );
}

/** The links to both pages, for the screens that point at them. */
export function LegalLinks() {
  return (
    <p className="text-sm text-muted">
      {DOCUMENTS.map((document, position) => (
        <span key={document.path}>
          {position > 0 ? ' · ' : null}
          <Link to={document.path} className="underline">
            {document.title}
          </Link>
        </span>
      ))}
    </p>
  );
}
