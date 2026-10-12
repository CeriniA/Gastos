import { MIN_HIDDEN_WORD_LENGTH, REDACTION_MARK } from './constants';

/**
 * Hiding personal data before a card statement's text leaves the server.
 *
 * Two layers, because neither is enough alone:
 * - redactPersonalData hides what has a recognisable shape (card and account
 *   numbers, tax ids, e-mails) and whatever follows a telling label
 *   ("Domicilio:", "Titular:");
 * - hideWords hides what has no shape (a name, a street), from a list the
 *   user writes once.
 * The user then reads the result and can still edit it before sending.
 */

export interface Redacted {
  text: string;
  /** How many pieces were hidden. */
  hidden: number;
}

/** A card or account number has at least this many digits (a CBU has 22, a card 15 or 16). */
const MIN_LONG_NUMBER_LENGTH = 12;
/** Masked digits ("XXXX XXXX XXXX 1234") still give away the last ones. */
const MIN_DIGITS_IN_NUMBER = 4;

/** Characters a printed card or account number is made of, masks included. */
const NUMBER_CHAR = '[\\dX*•]';
const LONG_NUMBER = new RegExp(
  `(?<![\\p{L}\\p{N}])${NUMBER_CHAR}(?:[ -]?${NUMBER_CHAR}){${MIN_LONG_NUMBER_LENGTH - 1},}(?![\\p{L}\\p{N}])`,
  'gu',
);

/** Labels after which the rest of the line is personal: the label stays, the value goes. */
const LABELLED_LINE =
  /(\b(?:domicilio|direcci[oó]n|titular|nombre y apellido|apellido y nombre|nombre|tel[eé]fono|tel\.|celular|e-?mail|correo)\s*:\s*)[^\n]+/giu;
/**
 * Labels after which a number identifies the person or their account. The
 * number may not run into a comma: "Saldo cuenta 12.345,67" is an amount.
 */
const LABELLED_ID =
  /(\b(?:d\.?\s?n\.?\s?i\.?|cuit|cuil|c\.u\.i\.[tl]\.?|documento|(?:n(?:ro|[°º])\.?\s*(?:de\s+)?)?(?:cuenta|socio|cliente)(?:\s*n(?:ro|[°º])\.?)?)\s*:?\s*)\d[\d./ -]{4,}\d(?![\d,])/giu;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;
/** CUIT and CUIL: 20-12345678-9, with or without the dashes. */
const TAX_ID = /(?<!\d)\d{2}-?\d{8}-?\d(?!\d)/gu;

const digitCount = (value: string) => value.replace(/\D/g, '').length;

export function redactPersonalData(text: string): Redacted {
  let hidden = 0;
  const hide = (keep: string) => {
    hidden += 1;
    return `${keep}${REDACTION_MARK}`;
  };
  const result = text
    .replace(LABELLED_LINE, (_match, label: string) => hide(label))
    .replace(LABELLED_ID, (_match, label: string) => hide(label))
    .replace(EMAIL, () => hide(''))
    .replace(TAX_ID, () => hide(''))
    .replace(LONG_NUMBER, (match) => (digitCount(match) >= MIN_DIGITS_IN_NUMBER ? hide('') : match));
  return { text: result, hidden };
}

/** Banks print names in capitals and without accents: "Pérez" must also hide "PEREZ". */
const ACCENT_VARIANTS: Record<string, string> = {
  a: 'aáàäâã',
  e: 'eéèëê',
  i: 'iíìïî',
  o: 'oóòöôõ',
  u: 'uúùüû',
  n: 'nñ',
  c: 'cç',
};

function wordPattern(word: string): RegExp {
  const plain = word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const source = [...plain]
    .map((char) => {
      if (/\s/.test(char)) return '\\s+';
      const variants = ACCENT_VARIANTS[char];
      return variants ? `[${variants}]` : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(source, 'giu');
}

/** Hides every appearance of the user's words, ignoring case and accents. */
export function hideWords(text: string, words: readonly string[]): Redacted {
  let hidden = 0;
  let result = text;
  for (const word of words) {
    const clean = word.trim();
    if (clean.length < MIN_HIDDEN_WORD_LENGTH) continue;
    result = result.replace(wordPattern(clean), () => {
      hidden += 1;
      return REDACTION_MARK;
    });
  }
  return { text: result, hidden };
}
