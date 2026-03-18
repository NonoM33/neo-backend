import { eq, and, desc, SQL, gte, lte, sql, lt } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  invoices,
  invoiceLines,
  orders,
  orderLines,
  projects,
  clients,
} from '../../db/schema';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type {
  CreateInvoiceInput,
  CreateInvoiceFromOrderInput,
  UpdateInvoiceInput,
  ChangeInvoiceStatusInput,
  InvoiceFilter,
  InvoiceLineInput,
  InvoiceStatus,
} from './invoices.schema';

// Transitions de statut valides
const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  brouillon: ['envoyee', 'annulee'],
  envoyee: ['payee', 'annulee'],
  payee: [],
  annulee: [],
};

// Mentions légales par défaut
const DEFAULT_LEGAL_MENTIONS = `En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement.
TVA non applicable, art. 293 B du CGI (si applicable).
Paiement par virement bancaire.`;

// Générer un numéro de facture
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;

  const [latest] = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(sql`${invoices.number} LIKE ${prefix + '%'}`)
    .orderBy(desc(invoices.createdAt))
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

// Calculer les totaux
function calculateTotals(lines: InvoiceLineInput[]) {
  let totalHT = 0;
  let totalTVA = 0;

  const calculatedLines = lines.map((line, index) => {
    const lineHT = line.quantity * line.unitPriceHT;
    const lineTVA = lineHT * (line.tvaRate / 100);

    totalHT += lineHT;
    totalTVA += lineTVA;

    return {
      ...line,
      totalHT: lineHT,
      sortOrder: index,
    };
  });

  const totalTTC = totalHT + totalTVA;

  return {
    lines: calculatedLines,
    totalHT,
    totalTVA,
    totalTTC,
  };
}

// Créer une facture
export async function createInvoice(input: CreateInvoiceInput, userId?: string) {
  const number = await generateInvoiceNumber();
  const { lines, totalHT, totalTVA, totalTTC } = calculateTotals(input.lines);

  // Échéance par défaut: 30 jours
  const dueDate = input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [invoice] = await db
    .insert(invoices)
    .values({
      number,
      orderId: input.orderId,
      projectId: input.projectId,
      status: 'brouillon',
      totalHT: totalHT.toFixed(2),
      totalTVA: totalTVA.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      dueDate,
      paymentTerms: input.paymentTerms ?? '30 jours',
      legalMentions: input.legalMentions ?? DEFAULT_LEGAL_MENTIONS,
      notes: input.notes,
      createdBy: userId,
    })
    .returning();

  if (!invoice) {
    throw new Error('Erreur lors de la création de la facture');
  }

  // Insérer les lignes
  for (const line of lines) {
    await db.insert(invoiceLines).values({
      invoiceId: invoice.id,
      reference: line.reference,
      description: line.description,
      quantity: line.quantity,
      unitPriceHT: line.unitPriceHT.toFixed(2),
      tvaRate: line.tvaRate.toFixed(2),
      totalHT: line.totalHT.toFixed(2),
      sortOrder: line.sortOrder,
    });
  }

  return getInvoiceById(invoice.id);
}

// Créer une facture depuis une commande
export async function createInvoiceFromOrder(
  input: CreateInvoiceFromOrderInput,
  userId?: string
) {
  // Vérifier que la commande existe et est payée
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande');
  }

  if (!['payee', 'en_preparation', 'expediee', 'livree'].includes(order.status)) {
    throw new ValidationError('La commande doit être payée pour générer une facture');
  }

  // Vérifier qu'il n'y a pas déjà une facture pour cette commande
  const [existingInvoice] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.orderId, input.orderId))
    .limit(1);

  if (existingInvoice) {
    throw new ConflictError('Une facture existe déjà pour cette commande');
  }

  // Récupérer les lignes de la commande
  const orderLinesList = await db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, input.orderId))
    .orderBy(orderLines.sortOrder);

  // Créer la facture
  const invoiceInput: CreateInvoiceInput = {
    orderId: input.orderId,
    projectId: order.projectId,
    dueDate: input.dueDate,
    paymentTerms: input.paymentTerms,
    legalMentions: input.legalMentions,
    lines: orderLinesList.map((line) => ({
      reference: line.reference ?? undefined,
      description: line.description,
      quantity: line.quantity,
      unitPriceHT: parseFloat(line.unitPriceHT),
      tvaRate: parseFloat(line.tvaRate),
    })),
  };

  return createInvoice(invoiceInput, userId);
}

// Obtenir une facture par ID
export async function getInvoiceById(id: string) {
  const [invoice] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      orderId: invoices.orderId,
      projectId: invoices.projectId,
      status: invoices.status,
      totalHT: invoices.totalHT,
      totalTVA: invoices.totalTVA,
      totalTTC: invoices.totalTTC,
      dueDate: invoices.dueDate,
      paymentTerms: invoices.paymentTerms,
      paymentMethod: invoices.paymentMethod,
      legalMentions: invoices.legalMentions,
      pdfUrl: invoices.pdfUrl,
      notes: invoices.notes,
      sentAt: invoices.sentAt,
      paidAt: invoices.paidAt,
      cancelledAt: invoices.cancelledAt,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      project: {
        id: projects.id,
        name: projects.name,
        address: projects.address,
        city: projects.city,
        postalCode: projects.postalCode,
      },
      client: {
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        address: clients.address,
        city: clients.city,
        postalCode: clients.postalCode,
      },
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    throw new NotFoundError('Facture');
  }

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))
    .orderBy(invoiceLines.sortOrder);

  // Calculer si en retard
  const isOverdue =
    invoice.status === 'envoyee' &&
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();

  return {
    ...invoice,
    lines,
    isOverdue,
  };
}

// Lister les factures
export async function getInvoices(
  pagination: PaginationParams,
  filters: InvoiceFilter
) {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(invoices.status, filters.status));
  }

  if (filters.projectId) {
    conditions.push(eq(invoices.projectId, filters.projectId));
  }

  if (filters.orderId) {
    conditions.push(eq(invoices.orderId, filters.orderId));
  }

  if (filters.startDate) {
    conditions.push(gte(invoices.createdAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(invoices.createdAt, filters.endDate));
  }

  if (filters.overdue) {
    conditions.push(eq(invoices.status, 'envoyee'));
    conditions.push(lt(invoices.dueDate, new Date()));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [invoicesList, countResult] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        totalHT: invoices.totalHT,
        totalTTC: invoices.totalTTC,
        dueDate: invoices.dueDate,
        createdAt: invoices.createdAt,
        project: {
          id: projects.id,
          name: projects.name,
        },
        client: {
          firstName: clients.firstName,
          lastName: clients.lastName,
        },
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(where)
      .orderBy(desc(invoices.createdAt))
      .limit(pagination.limit)
      .offset(getOffset(pagination)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(where),
  ]);

  // Calculer le statut de retard pour chaque facture
  const invoicesWithOverdue = invoicesList.map((inv) => ({
    ...inv,
    isOverdue:
      inv.status === 'envoyee' &&
      inv.dueDate &&
      new Date(inv.dueDate) < new Date(),
  }));

  return paginate(invoicesWithOverdue, countResult[0]?.count ?? 0, pagination);
}

// Modifier une facture
export async function updateInvoice(id: string, input: UpdateInvoiceInput) {
  const [invoice] = await db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    throw new NotFoundError('Facture');
  }

  if (!['brouillon', 'envoyee'].includes(invoice.status)) {
    throw new ValidationError('Impossible de modifier une facture payée ou annulée');
  }

  await db
    .update(invoices)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id));

  return getInvoiceById(id);
}

// Changer le statut
export async function changeInvoiceStatus(
  id: string,
  input: ChangeInvoiceStatusInput,
  userId?: string
) {
  const [invoice] = await db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    throw new NotFoundError('Facture');
  }

  const allowedNext = validTransitions[invoice.status as InvoiceStatus];
  if (!allowedNext.includes(input.status)) {
    throw new ValidationError(
      `Transition de ${invoice.status} vers ${input.status} non autorisée`
    );
  }

  const updateData: Record<string, any> = {
    status: input.status,
    updatedAt: new Date(),
  };

  switch (input.status) {
    case 'envoyee':
      updateData.sentAt = new Date();
      break;
    case 'payee':
      updateData.paidAt = new Date();
      break;
    case 'annulee':
      updateData.cancelledAt = new Date();
      break;
  }

  await db.update(invoices).set(updateData).where(eq(invoices.id, id));

  return getInvoiceById(id);
}

// Supprimer une facture
export async function deleteInvoice(id: string) {
  const [invoice] = await db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    throw new NotFoundError('Facture');
  }

  if (invoice.status !== 'brouillon') {
    throw new ValidationError('Seules les factures en brouillon peuvent être supprimées');
  }

  await db.delete(invoices).where(eq(invoices.id, id));
}

// Statistiques des factures
export async function getInvoiceStats() {
  const now = new Date();

  const [byStatus, totals, overdueResult] = await Promise.all([
    db
      .select({
        status: invoices.status,
        count: sql<number>`count(*)::int`,
        totalTTC: sql<string>`COALESCE(SUM(${invoices.totalTTC}), 0)`,
      })
      .from(invoices)
      .groupBy(invoices.status),
    db
      .select({
        totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'payee' THEN ${invoices.totalTTC} ELSE 0 END), 0)`,
        totalPending: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'envoyee' THEN ${invoices.totalTTC} ELSE 0 END), 0)`,
      })
      .from(invoices),
    db
      .select({
        count: sql<number>`count(*)::int`,
        totalTTC: sql<string>`COALESCE(SUM(${invoices.totalTTC}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, 'envoyee'),
          lt(invoices.dueDate, now)
        )
      ),
  ]);

  return {
    byStatus,
    totals: totals[0],
    overdue: overdueResult[0],
  };
}
