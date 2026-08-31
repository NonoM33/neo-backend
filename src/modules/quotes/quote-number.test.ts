import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  nextQuoteNumber,
  quoteNumberPrefix,
  isDuplicateQuoteNumberError,
} from './quote-number';

describe('nextQuoteNumber', () => {
  it('demarre a 0001 pour le premier devis de l annee', () => {
    expect(nextQuoteNumber(2026, null)).toBe('DEV-2026-0001');
    expect(nextQuoteNumber(2026, undefined)).toBe('DEV-2026-0001');
  });

  it('incremente le dernier numero emis', () => {
    expect(nextQuoteNumber(2026, 'DEV-2026-0001')).toBe('DEV-2026-0002');
    expect(nextQuoteNumber(2026, 'DEV-2026-0099')).toBe('DEV-2026-0100');
  });

  it('repart a 0001 quand le dernier numero est d une autre annee', () => {
    expect(nextQuoteNumber(2027, 'DEV-2026-0042')).toBe('DEV-2027-0001');
  });

  it('ignore un numero illisible plutot que de produire NaN', () => {
    expect(nextQuoteNumber(2026, 'DEV-2026-XXXX')).toBe('DEV-2026-0001');
  });

  it('expose le prefixe annuel', () => {
    expect(quoteNumberPrefix(2026)).toBe('DEV-2026-');
  });
});

// Bug de production : la requete cherchait le dernier numero avec
// `eq(quotes.number, 'DEV-2026-%')`. Une egalite ne matche jamais un motif :
// la sequence restait a 1 et le DEUXIEME devis de l'annee explosait sur la
// contrainte d'unicite — plus aucun devis creable. Aucun test unitaire ne
// peut voir ca (c'est du SQL), donc on verrouille la source, comme pour les
// commandes / factures qui utilisent deja LIKE.
describe('generateQuoteNumber (source)', () => {
  const source = readFileSync(new URL('./quotes.service.ts', import.meta.url), 'utf8');
  const body = source.slice(
    source.indexOf('async function generateQuoteNumber'),
    source.indexOf('export async function getQuotesByProject')
  );

  it('cherche les numeros de l annee avec LIKE', () => {
    expect(body).toContain('LIKE');
  });

  it("n'utilise pas d'egalite sur un motif a joker", () => {
    expect(body).not.toMatch(/eq\([^)]*%/);
  });
});

// Forme REELLE de l'erreur, relevee sur la pile du projet (drizzle 0.45 +
// postgres.js 3.4) le 2026-08-31 : le SQLSTATE vit sur `cause`, jamais sur
// `code`. Un test ecrit d'apres l'intuition (`error.code === '23505'`) aurait
// valide un re-essai qui ne part jamais.
describe('isDuplicateQuoteNumberError', () => {
  const realError = Object.assign(new Error('Failed query: insert into "quotes" ...'), {
    cause: { code: '23505', constraint_name: 'quotes_number_unique' },
  });

  it('reconnait la collision de numero telle que drizzle la remonte', () => {
    expect(isDuplicateQuoteNumberError(realError)).toBe(true);
  });

  it('ne se laisse pas prendre par un SQLSTATE pose a la racine', () => {
    const naive = Object.assign(new Error('x'), { code: '23505' });
    expect(isDuplicateQuoteNumberError(naive)).toBe(false);
  });

  it('ignore une violation d unicite sur une AUTRE contrainte', () => {
    const other = Object.assign(new Error('x'), {
      cause: { code: '23505', constraint_name: 'clients_email_unique' },
    });
    expect(isDuplicateQuoteNumberError(other)).toBe(false);
  });

  it('ignore les autres erreurs', () => {
    expect(isDuplicateQuoteNumberError(new Error('boom'))).toBe(false);
    expect(isDuplicateQuoteNumberError(null)).toBe(false);
    expect(isDuplicateQuoteNumberError(Object.assign(new Error('x'), { cause: { code: '23503' } }))).toBe(false);
  });
});

// Le re-essai ne sert a rien s'il n'est pas branche : on verrouille la source.
describe('createQuote (source)', () => {
  const source = readFileSync(new URL('./quotes.service.ts', import.meta.url), 'utf8');
  const body = source.slice(
    source.indexOf('export async function createQuote'),
    source.indexOf('export async function updateQuote')
  );

  it('re-essaie sur collision de numero', () => {
    expect(body).toContain('isDuplicateQuoteNumberError');
    expect(body).toContain('QUOTE_NUMBER_MAX_ATTEMPTS');
  });
});
