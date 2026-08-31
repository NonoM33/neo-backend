/**
 * Numerotation des devis. Module pur : testable sans base.
 *
 * Regle : un compteur par annee civile, remis a 1 le 1er janvier,
 * sur 4 chiffres — `DEV-2026-0001`, `DEV-2026-0002`, ...
 */

export function quoteNumberPrefix(year: number): string {
  return `DEV-${year}-`;
}

/**
 * Numero suivant, a partir du plus grand numero deja emis pour cette annee
 * (`null` quand c'est le premier devis de l'annee).
 */
export function nextQuoteNumber(year: number, latestNumber?: string | null): string {
  const prefix = quoteNumberPrefix(year);
  let sequence = 1;

  if (latestNumber && latestNumber.startsWith(prefix)) {
    const current = parseInt(latestNumber.substring(prefix.length), 10);
    if (Number.isFinite(current) && current > 0) {
      sequence = current + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
}

/**
 * Nombre de numeros tentes avant d'abandonner. Deux devis crees au meme
 * instant lisent le meme "dernier numero" et visent donc le meme suivant :
 * le perdant re-tente avec le numero d'apres.
 *
 * Il en faut autant que de devis simultanes dans le pire des cas. Mesure sur
 * la vraie base : a 10 creations en parallele, 5 tentatives laissaient encore
 * un echec, 10 passent toutes. Au-dela il faudrait une sequence Postgres —
 * inutile ici, personne ne cree dix devis dans la meme milliseconde.
 */
export const QUOTE_NUMBER_MAX_ATTEMPTS = 10;

/**
 * Violation d'unicite Postgres (SQLSTATE 23505) sur le numero de devis ?
 *
 * ATTENTION, verifie sur la vraie pile (drizzle + postgres.js, 2026-08-31) :
 * le SQLSTATE n'est PAS sur `error.code` — drizzle enveloppe l'erreur du
 * driver et ne laisse le code que sur `error.cause`. Tester `error.code`
 * (le reflexe naturel) ne matche JAMAIS, et le re-essai ne partirait donc
 * jamais, en silence.
 */
export function isDuplicateQuoteNumberError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; constraint_name?: string } } | null)?.cause;
  if (!cause || cause.code !== '23505') return false;
  return cause.constraint_name === 'quotes_number_unique';
}
