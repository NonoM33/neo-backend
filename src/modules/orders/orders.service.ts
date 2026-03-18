import { eq, and, desc, SQL, gte, lte, sql, inArray } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  orders,
  orderLines,
  orderStatusHistory,
  quotes,
  quoteLines,
  projects,
  clients,
  products,
} from '../../db/schema';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import * as stockService from '../stock/stock.service';
import type {
  CreateOrderInput,
  UpdateOrderInput,
  ChangeOrderStatusInput,
  OrderFilter,
  OrderLineInput,
  OrderStatus,
} from './orders.schema';

// Transitions de statut valides
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  en_attente: ['confirmee', 'annulee'],
  confirmee: ['payee', 'annulee'],
  payee: ['en_preparation', 'annulee'],
  en_preparation: ['expediee', 'annulee'],
  expediee: ['livree'],
  livree: [],
  annulee: [],
};

// Générer un numéro de commande
async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CMD-${year}-`;

  const [latest] = await db
    .select({ number: orders.number })
    .from(orders)
    .where(sql`${orders.number} LIKE ${prefix + '%'}`)
    .orderBy(desc(orders.createdAt))
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
function calculateTotals(
  lines: OrderLineInput[],
  discount: number = 0
) {
  let totalHT = 0;
  let totalTVA = 0;
  let totalCostHT = 0;

  const calculatedLines = lines.map((line, index) => {
    const lineHT = line.quantity * line.unitPriceHT;
    const lineTVA = lineHT * (line.tvaRate / 100);
    const lineCostHT = line.unitCostHT ? line.quantity * line.unitCostHT : 0;

    totalHT += lineHT;
    totalTVA += lineTVA;
    totalCostHT += lineCostHT;

    return {
      ...line,
      totalHT: lineHT,
      sortOrder: index,
    };
  });

  // Appliquer la remise
  const discountAmount = totalHT * (discount / 100);
  totalHT -= discountAmount;
  totalTVA -= discountAmount * 0.2;
  totalCostHT -= totalCostHT * (discount / 100);

  const totalTTC = totalHT + totalTVA;
  const totalMarginHT = totalHT - totalCostHT;

  return {
    lines: calculatedLines,
    totalHT,
    totalTVA,
    totalTTC,
    totalCostHT,
    totalMarginHT,
  };
}

// Créer une commande
export async function createOrder(input: CreateOrderInput, userId?: string) {
  const number = await generateOrderNumber();

  const { lines, totalHT, totalTVA, totalTTC, totalCostHT, totalMarginHT } =
    calculateTotals(input.lines, input.discount);

  const [order] = await db
    .insert(orders)
    .values({
      number,
      projectId: input.projectId,
      quoteId: input.quoteId,
      status: 'en_attente',
      totalHT: totalHT.toFixed(2),
      totalTVA: totalTVA.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      totalCostHT: totalCostHT.toFixed(2),
      totalMarginHT: totalMarginHT.toFixed(2),
      discount: input.discount?.toString() ?? '0',
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingPostalCode: input.shippingPostalCode,
      shippingNotes: input.shippingNotes,
      notes: input.notes,
      internalNotes: input.internalNotes,
      createdBy: userId,
    })
    .returning();

  if (!order) {
    throw new Error('Erreur lors de la création de la commande');
  }

  // Insérer les lignes
  for (const line of lines) {
    await db.insert(orderLines).values({
      orderId: order.id,
      productId: line.productId,
      reference: line.reference,
      description: line.description,
      quantity: line.quantity,
      unitPriceHT: line.unitPriceHT.toFixed(2),
      unitCostHT: line.unitCostHT?.toFixed(2),
      tvaRate: line.tvaRate.toFixed(2),
      totalHT: line.totalHT.toFixed(2),
      sortOrder: line.sortOrder,
    });
  }

  // Historique
  await db.insert(orderStatusHistory).values({
    orderId: order.id,
    toStatus: 'en_attente',
    changedBy: userId,
    notes: 'Création de la commande',
  });

  return getOrderById(order.id);
}

// Convertir un devis en commande
export async function convertQuoteToOrder(quoteId: string, userId?: string) {
  // Vérifier que le devis existe et est accepté
  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!quote) {
    throw new NotFoundError('Devis');
  }

  if (quote.status !== 'accepte') {
    throw new ValidationError('Le devis doit être accepté pour être converti en commande');
  }

  // Vérifier qu'il n'y a pas déjà une commande pour ce devis
  const [existingOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.quoteId, quoteId))
    .limit(1);

  if (existingOrder) {
    throw new ConflictError('Une commande existe déjà pour ce devis');
  }

  // Récupérer les lignes du devis (sauf clientOwned)
  const quoteLinesList = await db
    .select()
    .from(quoteLines)
    .where(and(eq(quoteLines.quoteId, quoteId), eq(quoteLines.clientOwned, false)))
    .orderBy(quoteLines.sortOrder);

  // Récupérer l'adresse du projet pour la livraison
  const [project] = await db
    .select({
      address: projects.address,
      city: projects.city,
      postalCode: projects.postalCode,
    })
    .from(projects)
    .where(eq(projects.id, quote.projectId))
    .limit(1);

  // Créer la commande
  const orderInput: CreateOrderInput = {
    projectId: quote.projectId,
    quoteId: quote.id,
    discount: parseFloat(quote.discount ?? '0'),
    shippingAddress: project?.address ?? undefined,
    shippingCity: project?.city ?? undefined,
    shippingPostalCode: project?.postalCode ?? undefined,
    notes: quote.notes ?? undefined,
    lines: quoteLinesList.map((line) => ({
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPriceHT: parseFloat(line.unitPriceHT),
      unitCostHT: line.unitCostHT ? parseFloat(line.unitCostHT) : undefined,
      tvaRate: parseFloat(line.tvaRate),
    })),
  };

  return createOrder(orderInput, userId);
}

// Obtenir une commande par ID
export async function getOrderById(id: string) {
  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      quoteId: orders.quoteId,
      projectId: orders.projectId,
      status: orders.status,
      totalHT: orders.totalHT,
      totalTVA: orders.totalTVA,
      totalTTC: orders.totalTTC,
      totalCostHT: orders.totalCostHT,
      totalMarginHT: orders.totalMarginHT,
      discount: orders.discount,
      shippingAddress: orders.shippingAddress,
      shippingCity: orders.shippingCity,
      shippingPostalCode: orders.shippingPostalCode,
      shippingNotes: orders.shippingNotes,
      carrier: orders.carrier,
      trackingNumber: orders.trackingNumber,
      notes: orders.notes,
      internalNotes: orders.internalNotes,
      confirmedAt: orders.confirmedAt,
      paidAt: orders.paidAt,
      shippedAt: orders.shippedAt,
      deliveredAt: orders.deliveredAt,
      cancelledAt: orders.cancelledAt,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      project: {
        id: projects.id,
        name: projects.name,
      },
      client: {
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
      },
    })
    .from(orders)
    .innerJoin(projects, eq(orders.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande');
  }

  const [lines, history] = await Promise.all([
    db
      .select({
        id: orderLines.id,
        productId: orderLines.productId,
        reference: orderLines.reference,
        description: orderLines.description,
        quantity: orderLines.quantity,
        unitPriceHT: orderLines.unitPriceHT,
        unitCostHT: orderLines.unitCostHT,
        tvaRate: orderLines.tvaRate,
        totalHT: orderLines.totalHT,
        sortOrder: orderLines.sortOrder,
        product: {
          id: products.id,
          reference: products.reference,
          name: products.name,
        },
      })
      .from(orderLines)
      .leftJoin(products, eq(orderLines.productId, products.id))
      .where(eq(orderLines.orderId, id))
      .orderBy(orderLines.sortOrder),
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, id))
      .orderBy(desc(orderStatusHistory.changedAt)),
  ]);

  return {
    ...order,
    lines,
    history,
  };
}

// Lister les commandes
export async function getOrders(
  pagination: PaginationParams,
  filters: OrderFilter
) {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(orders.status, filters.status));
  }

  if (filters.projectId) {
    conditions.push(eq(orders.projectId, filters.projectId));
  }

  if (filters.startDate) {
    conditions.push(gte(orders.createdAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(orders.createdAt, filters.endDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [ordersList, countResult] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        totalHT: orders.totalHT,
        totalTTC: orders.totalTTC,
        createdAt: orders.createdAt,
        project: {
          id: projects.id,
          name: projects.name,
        },
        client: {
          firstName: clients.firstName,
          lastName: clients.lastName,
        },
      })
      .from(orders)
      .innerJoin(projects, eq(orders.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(pagination.limit)
      .offset(getOffset(pagination)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where),
  ]);

  return paginate(ordersList, countResult[0]?.count ?? 0, pagination);
}

// Modifier une commande
export async function updateOrder(id: string, input: UpdateOrderInput) {
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande');
  }

  // Ne pas modifier une commande livrée ou annulée
  if (['livree', 'annulee'].includes(order.status)) {
    throw new ValidationError('Impossible de modifier une commande terminée');
  }

  await db
    .update(orders)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  return getOrderById(id);
}

// Changer le statut d'une commande
export async function changeOrderStatus(
  id: string,
  input: ChangeOrderStatusInput,
  userId?: string
) {
  const order = await getOrderById(id);

  // Vérifier la transition
  const allowedNext = validTransitions[order.status as OrderStatus];
  if (!allowedNext.includes(input.status)) {
    throw new ValidationError(
      `Transition de ${order.status} vers ${input.status} non autorisée`
    );
  }

  const updateData: Record<string, any> = {
    status: input.status,
    updatedAt: new Date(),
  };

  // Gérer les actions liées aux changements de statut
  const orderLinesData = order.lines;

  switch (input.status) {
    case 'confirmee':
      updateData.confirmedAt = new Date();
      // Réserver le stock
      for (const line of orderLinesData) {
        if (line.productId) {
          await stockService.reserveStock(
            line.productId,
            line.quantity,
            id,
            userId
          );
        }
      }
      break;

    case 'payee':
      updateData.paidAt = new Date();
      break;

    case 'expediee':
      updateData.shippedAt = new Date();
      // Convertir la réservation en sortie réelle
      // (Déjà géré par la réservation, le stock est bien déduit)
      break;

    case 'livree':
      updateData.deliveredAt = new Date();
      break;

    case 'annulee':
      updateData.cancelledAt = new Date();
      // Libérer le stock si la commande était confirmée ou après
      if (['confirmee', 'payee', 'en_preparation'].includes(order.status)) {
        for (const line of orderLinesData) {
          if (line.productId) {
            await stockService.releaseStock(
              line.productId,
              line.quantity,
              id,
              userId
            );
          }
        }
      }
      break;
  }

  await db.update(orders).set(updateData).where(eq(orders.id, id));

  // Historique
  await db.insert(orderStatusHistory).values({
    orderId: id,
    fromStatus: order.status as any,
    toStatus: input.status,
    changedBy: userId,
    notes: input.notes,
  });

  return getOrderById(id);
}

// Supprimer une commande (uniquement brouillon/en_attente)
export async function deleteOrder(id: string) {
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande');
  }

  if (order.status !== 'en_attente') {
    throw new ValidationError('Seules les commandes en attente peuvent être supprimées');
  }

  await db.delete(orders).where(eq(orders.id, id));
}

// Statistiques des commandes
export async function getOrderStats() {
  const [byStatus, totals, recentOrders] = await Promise.all([
    db
      .select({
        status: orders.status,
        count: sql<number>`count(*)::int`,
        totalTTC: sql<string>`COALESCE(SUM(${orders.totalTTC}), 0)`,
      })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({
        count: sql<number>`count(*)::int`,
        totalTTC: sql<string>`COALESCE(SUM(${orders.totalTTC}), 0)`,
        totalMargin: sql<string>`COALESCE(SUM(${orders.totalMarginHT}), 0)`,
      })
      .from(orders)
      .where(sql`${orders.status} NOT IN ('annulee')`),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        totalTTC: orders.totalTTC,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(5),
  ]);

  return {
    byStatus,
    totals: totals[0],
    recentOrders,
  };
}
