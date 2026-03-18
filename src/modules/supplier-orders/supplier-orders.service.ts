import { eq, and, desc, SQL, gte, lte, sql, isNotNull, lt } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  supplierOrders,
  supplierOrderLines,
  suppliers,
  products,
} from '../../db/schema';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import * as stockService from '../stock/stock.service';
import type {
  CreateSupplierOrderInput,
  UpdateSupplierOrderInput,
  ChangeSupplierOrderStatusInput,
  ReceptionInput,
  SupplierOrderFilter,
  SupplierOrderStatus,
} from './supplier-orders.schema';

// Transitions de statut valides
const validTransitions: Record<SupplierOrderStatus, SupplierOrderStatus[]> = {
  brouillon: ['envoyee', 'annulee'],
  envoyee: ['confirmee', 'annulee'],
  confirmee: ['recue', 'annulee'],
  recue: [],
  annulee: [],
};

// Générer un numéro de commande fournisseur
async function generateSupplierOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CF-${year}-`;

  const [latest] = await db
    .select({ number: supplierOrders.number })
    .from(supplierOrders)
    .where(sql`${supplierOrders.number} LIKE ${prefix + '%'}`)
    .orderBy(desc(supplierOrders.createdAt))
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
function calculateTotals(lines: { quantityOrdered: number; unitPriceHT: number }[]) {
  let totalHT = 0;

  for (const line of lines) {
    totalHT += line.quantityOrdered * line.unitPriceHT;
  }

  const totalTVA = totalHT * 0.2; // TVA 20% par défaut
  const totalTTC = totalHT + totalTVA;

  return { totalHT, totalTVA, totalTTC };
}

// Créer une commande fournisseur
export async function createSupplierOrder(
  input: CreateSupplierOrderInput,
  userId?: string
) {
  // Vérifier que le fournisseur existe
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.isActive, true)))
    .limit(1);

  if (!supplier) {
    throw new NotFoundError('Fournisseur');
  }

  const number = await generateSupplierOrderNumber();
  const { totalHT, totalTVA, totalTTC } = calculateTotals(input.lines);

  const [order] = await db
    .insert(supplierOrders)
    .values({
      number,
      supplierId: input.supplierId,
      status: 'brouillon',
      totalHT: totalHT.toFixed(2),
      totalTVA: totalTVA.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      expectedDeliveryDate: input.expectedDeliveryDate,
      supplierReference: input.supplierReference,
      notes: input.notes,
      internalNotes: input.internalNotes,
      createdBy: userId,
    })
    .returning();

  if (!order) {
    throw new Error('Erreur lors de la création de la commande fournisseur');
  }

  // Insérer les lignes
  for (const line of input.lines) {
    await db.insert(supplierOrderLines).values({
      supplierOrderId: order.id,
      productId: line.productId,
      quantityOrdered: line.quantityOrdered,
      quantityReceived: 0,
      unitPriceHT: line.unitPriceHT.toFixed(2),
      totalHT: (line.quantityOrdered * line.unitPriceHT).toFixed(2),
      notes: line.notes,
    });
  }

  return getSupplierOrderById(order.id);
}

// Obtenir une commande fournisseur par ID
export async function getSupplierOrderById(id: string) {
  const [order] = await db
    .select({
      id: supplierOrders.id,
      number: supplierOrders.number,
      status: supplierOrders.status,
      totalHT: supplierOrders.totalHT,
      totalTVA: supplierOrders.totalTVA,
      totalTTC: supplierOrders.totalTTC,
      expectedDeliveryDate: supplierOrders.expectedDeliveryDate,
      supplierReference: supplierOrders.supplierReference,
      notes: supplierOrders.notes,
      internalNotes: supplierOrders.internalNotes,
      sentAt: supplierOrders.sentAt,
      confirmedAt: supplierOrders.confirmedAt,
      receivedAt: supplierOrders.receivedAt,
      cancelledAt: supplierOrders.cancelledAt,
      createdAt: supplierOrders.createdAt,
      updatedAt: supplierOrders.updatedAt,
      supplier: {
        id: suppliers.id,
        name: suppliers.name,
        email: suppliers.email,
        phone: suppliers.phone,
        contactName: suppliers.contactName,
        contactEmail: suppliers.contactEmail,
      },
    })
    .from(supplierOrders)
    .innerJoin(suppliers, eq(supplierOrders.supplierId, suppliers.id))
    .where(eq(supplierOrders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande fournisseur');
  }

  const lines = await db
    .select({
      id: supplierOrderLines.id,
      productId: supplierOrderLines.productId,
      quantityOrdered: supplierOrderLines.quantityOrdered,
      quantityReceived: supplierOrderLines.quantityReceived,
      unitPriceHT: supplierOrderLines.unitPriceHT,
      totalHT: supplierOrderLines.totalHT,
      notes: supplierOrderLines.notes,
      product: {
        id: products.id,
        reference: products.reference,
        name: products.name,
        stock: products.stock,
        stockMin: products.stockMin,
      },
    })
    .from(supplierOrderLines)
    .innerJoin(products, eq(supplierOrderLines.productId, products.id))
    .where(eq(supplierOrderLines.supplierOrderId, id));

  return {
    ...order,
    lines,
  };
}

// Lister les commandes fournisseurs
export async function getSupplierOrders(
  pagination: PaginationParams,
  filters: SupplierOrderFilter
) {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(supplierOrders.status, filters.status));
  }

  if (filters.supplierId) {
    conditions.push(eq(supplierOrders.supplierId, filters.supplierId));
  }

  if (filters.startDate) {
    conditions.push(gte(supplierOrders.createdAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(supplierOrders.createdAt, filters.endDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [ordersList, countResult] = await Promise.all([
    db
      .select({
        id: supplierOrders.id,
        number: supplierOrders.number,
        status: supplierOrders.status,
        totalHT: supplierOrders.totalHT,
        totalTTC: supplierOrders.totalTTC,
        expectedDeliveryDate: supplierOrders.expectedDeliveryDate,
        createdAt: supplierOrders.createdAt,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(supplierOrders)
      .innerJoin(suppliers, eq(supplierOrders.supplierId, suppliers.id))
      .where(where)
      .orderBy(desc(supplierOrders.createdAt))
      .limit(pagination.limit)
      .offset(getOffset(pagination)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierOrders)
      .where(where),
  ]);

  return paginate(ordersList, countResult[0]?.count ?? 0, pagination);
}

// Modifier une commande fournisseur
export async function updateSupplierOrder(
  id: string,
  input: UpdateSupplierOrderInput
) {
  const [order] = await db
    .select({ id: supplierOrders.id, status: supplierOrders.status })
    .from(supplierOrders)
    .where(eq(supplierOrders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande fournisseur');
  }

  if (!['brouillon', 'envoyee'].includes(order.status)) {
    throw new ValidationError('Impossible de modifier une commande confirmée ou reçue');
  }

  await db
    .update(supplierOrders)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(supplierOrders.id, id));

  return getSupplierOrderById(id);
}

// Changer le statut
export async function changeSupplierOrderStatus(
  id: string,
  input: ChangeSupplierOrderStatusInput,
  userId?: string
) {
  const [order] = await db
    .select({ id: supplierOrders.id, status: supplierOrders.status })
    .from(supplierOrders)
    .where(eq(supplierOrders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande fournisseur');
  }

  const allowedNext = validTransitions[order.status as SupplierOrderStatus];
  if (!allowedNext.includes(input.status)) {
    throw new ValidationError(
      `Transition de ${order.status} vers ${input.status} non autorisée`
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
    case 'confirmee':
      updateData.confirmedAt = new Date();
      break;
    case 'annulee':
      updateData.cancelledAt = new Date();
      break;
  }

  await db.update(supplierOrders).set(updateData).where(eq(supplierOrders.id, id));

  return getSupplierOrderById(id);
}

// Enregistrer une réception
export async function receiveSupplierOrder(
  id: string,
  input: ReceptionInput,
  userId?: string
) {
  const order = await getSupplierOrderById(id);

  if (!['envoyee', 'confirmee'].includes(order.status)) {
    throw new ValidationError('La commande doit être envoyée ou confirmée pour être réceptionnée');
  }

  let allReceived = true;

  for (const receptionLine of input.lines) {
    const orderLine = order.lines.find((l) => l.id === receptionLine.lineId);
    if (!orderLine) {
      throw new NotFoundError('Ligne de commande');
    }

    const newQuantityReceived = orderLine.quantityReceived + receptionLine.quantityReceived;

    if (newQuantityReceived > orderLine.quantityOrdered) {
      throw new ValidationError(
        `Quantité reçue (${newQuantityReceived}) supérieure à la quantité commandée (${orderLine.quantityOrdered}) pour ${orderLine.product.name}`
      );
    }

    // Mettre à jour la ligne
    await db
      .update(supplierOrderLines)
      .set({ quantityReceived: newQuantityReceived })
      .where(eq(supplierOrderLines.id, receptionLine.lineId));

    // Créer le mouvement de stock
    if (receptionLine.quantityReceived > 0) {
      await stockService.receiveStock(
        orderLine.productId,
        receptionLine.quantityReceived,
        id,
        userId
      );
    }

    if (newQuantityReceived < orderLine.quantityOrdered) {
      allReceived = false;
    }
  }

  // Vérifier si toutes les lignes sont complètes
  const updatedOrder = await getSupplierOrderById(id);
  const allComplete = updatedOrder.lines.every(
    (line) => line.quantityReceived >= line.quantityOrdered
  );

  if (allComplete) {
    await db
      .update(supplierOrders)
      .set({
        status: 'recue',
        receivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supplierOrders.id, id));
  }

  return getSupplierOrderById(id);
}

// Supprimer une commande fournisseur
export async function deleteSupplierOrder(id: string) {
  const [order] = await db
    .select({ id: supplierOrders.id, status: supplierOrders.status })
    .from(supplierOrders)
    .where(eq(supplierOrders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError('Commande fournisseur');
  }

  if (order.status !== 'brouillon') {
    throw new ValidationError('Seules les commandes en brouillon peuvent être supprimées');
  }

  await db.delete(supplierOrders).where(eq(supplierOrders.id, id));
}

// Créer une commande depuis les suggestions de réapprovisionnement
export async function createFromSuggestions(
  supplierId: string,
  productIds: string[],
  userId?: string
) {
  // Récupérer les produits avec leurs infos de stock
  const productsData = await db
    .select({
      id: products.id,
      reference: products.reference,
      name: products.name,
      stock: products.stock,
      stockMin: products.stockMin,
      purchasePriceHT: products.purchasePriceHT,
    })
    .from(products)
    .where(
      and(
        eq(products.supplierId, supplierId),
        sql`${products.id} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`
      )
    );

  if (productsData.length === 0) {
    throw new ValidationError('Aucun produit trouvé pour ce fournisseur');
  }

  const lines = productsData.map((product) => {
    const currentStock = product.stock ?? 0;
    const minStock = product.stockMin ?? 0;
    const suggestedQty = Math.max(minStock * 2 - currentStock, minStock);

    return {
      productId: product.id,
      quantityOrdered: suggestedQty,
      unitPriceHT: product.purchasePriceHT ? parseFloat(product.purchasePriceHT) : 0,
    };
  });

  return createSupplierOrder(
    {
      supplierId,
      lines,
      notes: 'Commande générée depuis suggestions de réapprovisionnement',
    },
    userId
  );
}

// Statistiques des commandes fournisseurs
export async function getSupplierOrderStats() {
  const [byStatus, pendingDeliveries] = await Promise.all([
    db
      .select({
        status: supplierOrders.status,
        count: sql<number>`count(*)::int`,
        totalHT: sql<string>`COALESCE(SUM(${supplierOrders.totalHT}), 0)`,
      })
      .from(supplierOrders)
      .groupBy(supplierOrders.status),
    db
      .select({
        id: supplierOrders.id,
        number: supplierOrders.number,
        supplierName: suppliers.name,
        expectedDeliveryDate: supplierOrders.expectedDeliveryDate,
        totalHT: supplierOrders.totalHT,
      })
      .from(supplierOrders)
      .innerJoin(suppliers, eq(supplierOrders.supplierId, suppliers.id))
      .where(
        and(
          sql`${supplierOrders.status} IN ('envoyee', 'confirmee')`,
          isNotNull(supplierOrders.expectedDeliveryDate)
        )
      )
      .orderBy(supplierOrders.expectedDeliveryDate)
      .limit(10),
  ]);

  return {
    byStatus,
    pendingDeliveries,
  };
}
