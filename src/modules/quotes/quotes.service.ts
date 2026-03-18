import { eq, and, desc, SQL, inArray } from 'drizzle-orm';
import { db } from '../../config/database';
import { quotes, quoteLines, projects, clients, products } from '../../db/schema';
import { NotFoundError } from '../../lib/errors';
import type { CreateQuoteInput, UpdateQuoteInput, QuoteLineInput } from './quotes.schema';

async function verifyProjectAccess(projectId: string, userId: string, userRole: string) {
  const conditions: SQL[] = [eq(projects.id, projectId)];

  if (userRole !== 'admin') {
    conditions.push(eq(projects.userId, userId));
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(...conditions))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Projet');
  }

  return project;
}

async function verifyQuoteAccess(quoteId: string, userId: string, userRole: string) {
  const [quote] = await db
    .select({
      id: quotes.id,
      projectId: quotes.projectId,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!quote) {
    throw new NotFoundError('Devis');
  }

  await verifyProjectAccess(quote.projectId, userId, userRole);

  return quote;
}

function calculateTotals(lines: QuoteLineInput[], discount: number = 0, costMap?: Map<string, number>) {
  let totalHT = 0;
  let totalTVA = 0;
  let totalCostHT = 0;

  const calculatedLines = lines.map((line, index) => {
    const lineHT = line.quantity * line.unitPriceHT;
    const lineTVA = lineHT * (line.tvaRate / 100);

    // Snapshot du prix d'achat
    const unitCostHT = line.productId && costMap ? costMap.get(line.productId) ?? null : null;
    const lineCostHT = unitCostHT !== null ? line.quantity * unitCostHT : 0;

    // Les lignes clientOwned ne sont pas facturées ni comptées en coût
    if (!line.clientOwned) {
      totalHT += lineHT;
      totalTVA += lineTVA;
      totalCostHT += lineCostHT;
    }

    return {
      ...line,
      totalHT: lineHT,
      sortOrder: index,
      unitCostHT,
    };
  });

  // Apply discount
  const discountAmount = totalHT * (discount / 100);
  totalHT -= discountAmount;
  totalTVA -= discountAmount * 0.2; // Assuming 20% average TVA for discount
  totalCostHT -= totalCostHT * (discount / 100);

  const totalTTC = totalHT + totalTVA;
  const totalMarginHT = totalHT - totalCostHT;
  const marginPercent = totalHT > 0 ? (totalMarginHT / totalHT) * 100 : 0;

  return {
    lines: calculatedLines,
    totalHT,
    totalTVA,
    totalTTC,
    totalCostHT,
    totalMarginHT,
    marginPercent,
  };
}

async function buildCostMap(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const productsData = await db
    .select({ id: products.id, purchasePriceHT: products.purchasePriceHT })
    .from(products)
    .where(inArray(products.id, productIds));
  return new Map(
    productsData
      .filter(p => p.purchasePriceHT !== null)
      .map(p => [p.id, parseFloat(p.purchasePriceHT!)])
  );
}

async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;

  // Get the latest quote number for this year
  const [latest] = await db
    .select({ number: quotes.number })
    .from(quotes)
    .where(eq(quotes.number, `${prefix}%`))
    .orderBy(desc(quotes.createdAt))
    .limit(1);

  let sequence = 1;

  if (latest && latest.number.startsWith(prefix)) {
    const currentSeq = parseInt(latest.number.substring(prefix.length), 10);
    if (!isNaN(currentSeq)) {
      sequence = currentSeq + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
}

export async function getQuotesByProject(projectId: string, userId: string, userRole: string) {
  await verifyProjectAccess(projectId, userId, userRole);

  const quotesList = await db
    .select()
    .from(quotes)
    .where(eq(quotes.projectId, projectId))
    .orderBy(desc(quotes.createdAt));

  return quotesList;
}

export async function getQuoteById(id: string, userId: string, userRole: string) {
  await verifyQuoteAccess(id, userId, userRole);

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);

  const lines = await db
    .select({
      id: quoteLines.id,
      description: quoteLines.description,
      quantity: quoteLines.quantity,
      unitPriceHT: quoteLines.unitPriceHT,
      tvaRate: quoteLines.tvaRate,
      totalHT: quoteLines.totalHT,
      sortOrder: quoteLines.sortOrder,
      clientOwned: quoteLines.clientOwned,
      clientOwnedPhotoUrl: quoteLines.clientOwnedPhotoUrl,
      product: {
        id: products.id,
        reference: products.reference,
        name: products.name,
      },
    })
    .from(quoteLines)
    .leftJoin(products, eq(quoteLines.productId, products.id))
    .where(eq(quoteLines.quoteId, id))
    .orderBy(quoteLines.sortOrder);

  return {
    ...quote,
    lines,
  };
}

export async function createQuote(
  projectId: string,
  input: CreateQuoteInput,
  userId: string,
  userRole: string
) {
  await verifyProjectAccess(projectId, userId, userRole);

  const number = await generateQuoteNumber();

  // Build cost map from product purchase prices
  const productIds = input.lines
    .filter(l => l.productId)
    .map(l => l.productId!);
  const costMap = await buildCostMap(productIds);

  const { lines, totalHT, totalTVA, totalTTC, totalCostHT, totalMarginHT, marginPercent } = calculateTotals(input.lines, input.discount, costMap);

  const [quote] = await db
    .insert(quotes)
    .values({
      projectId,
      number,
      status: 'brouillon',
      validUntil: input.validUntil,
      discount: input.discount?.toString(),
      notes: input.notes,
      totalHT: totalHT.toFixed(2),
      totalTVA: totalTVA.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      totalCostHT: totalCostHT.toFixed(2),
      totalMarginHT: totalMarginHT.toFixed(2),
      marginPercent: marginPercent.toFixed(2),
    })
    .returning();

  if (!quote) {
    throw new NotFoundError('Devis');
  }

  // Insert lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const inputLine = input.lines[i];
    await db.insert(quoteLines).values({
      quoteId: quote.id,
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPriceHT: line.unitPriceHT.toFixed(2),
      tvaRate: line.tvaRate.toFixed(2),
      totalHT: line.totalHT.toFixed(2),
      sortOrder: line.sortOrder,
      unitCostHT: line.unitCostHT !== null ? line.unitCostHT.toFixed(2) : null,
      clientOwned: inputLine?.clientOwned ?? false,
      clientOwnedPhotoUrl: inputLine?.clientOwnedPhotoUrl,
    });
  }

  return getQuoteById(quote.id, userId, userRole);
}

export async function updateQuote(
  id: string,
  input: UpdateQuoteInput,
  userId: string,
  userRole: string
) {
  await verifyQuoteAccess(id, userId, userRole);

  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (input.status) updateData.status = input.status;
  if (input.validUntil) updateData.validUntil = input.validUntil;
  if (input.notes !== undefined) updateData.notes = input.notes;

  if (input.lines) {
    // Delete existing lines
    await db.delete(quoteLines).where(eq(quoteLines.quoteId, id));

    // Build cost map from product purchase prices
    const productIds = input.lines
      .filter(l => l.productId)
      .map(l => l.productId!);
    const costMap = await buildCostMap(productIds);

    // Recalculate totals
    const { lines, totalHT, totalTVA, totalTTC, totalCostHT, totalMarginHT, marginPercent } = calculateTotals(
      input.lines,
      input.discount ?? 0,
      costMap
    );

    updateData.totalHT = totalHT.toFixed(2);
    updateData.totalTVA = totalTVA.toFixed(2);
    updateData.totalTTC = totalTTC.toFixed(2);
    updateData.totalCostHT = totalCostHT.toFixed(2);
    updateData.totalMarginHT = totalMarginHT.toFixed(2);
    updateData.marginPercent = marginPercent.toFixed(2);

    if (input.discount !== undefined) {
      updateData.discount = input.discount.toFixed(2);
    }

    // Insert new lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const inputLine = input.lines![i];
      await db.insert(quoteLines).values({
        quoteId: id,
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPriceHT: line.unitPriceHT.toFixed(2),
        tvaRate: line.tvaRate.toFixed(2),
        totalHT: line.totalHT.toFixed(2),
        sortOrder: line.sortOrder,
        unitCostHT: line.unitCostHT !== null ? line.unitCostHT.toFixed(2) : null,
        clientOwned: inputLine?.clientOwned ?? false,
        clientOwnedPhotoUrl: inputLine?.clientOwnedPhotoUrl,
      });
    }
  }

  await db.update(quotes).set(updateData).where(eq(quotes.id, id));

  return getQuoteById(id, userId, userRole);
}

export async function deleteQuote(id: string, userId: string, userRole: string) {
  await verifyQuoteAccess(id, userId, userRole);
  await db.delete(quotes).where(eq(quotes.id, id));
}

export async function sendQuote(id: string, userId: string, userRole: string) {
  const quote = await verifyQuoteAccess(id, userId, userRole);

  // Get project and client info
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      client: {
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
      },
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, quote.projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Projet');
  }

  if (!project.client?.email) {
    throw new Error('Le client n\'a pas d\'adresse email');
  }

  // Update quote status
  await db
    .update(quotes)
    .set({
      status: 'envoye',
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, id));

  // TODO: Actually send email with PDF
  // For now, just return success
  return {
    message: `Devis envoyé à ${project.client.email}`,
    sentTo: project.client.email,
  };
}

export async function getQuoteWithProjectDetails(id: string, userId: string, userRole: string) {
  await verifyQuoteAccess(id, userId, userRole);

  const [quote] = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      status: quotes.status,
      validUntil: quotes.validUntil,
      totalHT: quotes.totalHT,
      totalTVA: quotes.totalTVA,
      totalTTC: quotes.totalTTC,
      discount: quotes.discount,
      notes: quotes.notes,
      createdAt: quotes.createdAt,
      project: {
        id: projects.id,
        name: projects.name,
        address: projects.address,
        city: projects.city,
        postalCode: projects.postalCode,
      },
      client: clients,
    })
    .from(quotes)
    .innerJoin(projects, eq(quotes.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(quotes.id, id))
    .limit(1);

  const lines = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, id))
    .orderBy(quoteLines.sortOrder);

  return {
    ...quote,
    lines,
  };
}
