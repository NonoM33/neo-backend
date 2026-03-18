import { eq, and, desc, SQL, gte, lte, isNotNull, sql, lt } from 'drizzle-orm';
import { db } from '../../config/database';
import { stockMovements, products, suppliers } from '../../db/schema';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type { CreateStockMovementInput, StockFilter, StockAlertFilter } from './stock.schema';

// Créer un mouvement de stock
export async function createStockMovement(
  input: CreateStockMovementInput,
  userId?: string
) {
  // Vérifier que le produit existe
  const [product] = await db
    .select({ id: products.id, stock: products.stock })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);

  if (!product) {
    throw new NotFoundError('Produit');
  }

  const currentStock = product.stock ?? 0;
  let quantityChange = input.quantity;

  // Pour les sorties et réservations, la quantité doit être négative
  if (['sortie', 'reservation'].includes(input.type) && quantityChange > 0) {
    quantityChange = -quantityChange;
  }

  // Pour les entrées et libérations, la quantité doit être positive
  if (['entree', 'liberation', 'retour'].includes(input.type) && quantityChange < 0) {
    quantityChange = Math.abs(quantityChange);
  }

  // Pour les corrections, on garde le signe tel quel

  const newStock = currentStock + quantityChange;

  if (newStock < 0) {
    throw new ValidationError(`Stock insuffisant. Stock actuel: ${currentStock}, demandé: ${Math.abs(quantityChange)}`);
  }

  // Créer le mouvement
  const [movement] = await db
    .insert(stockMovements)
    .values({
      productId: input.productId,
      type: input.type,
      quantity: quantityChange,
      stockBefore: currentStock,
      stockAfter: newStock,
      reason: input.reason,
      orderId: input.orderId,
      supplierOrderId: input.supplierOrderId,
      createdBy: userId,
    })
    .returning();

  // Mettre à jour le stock du produit
  await db
    .update(products)
    .set({
      stock: newStock,
      updatedAt: new Date(),
    })
    .where(eq(products.id, input.productId));

  return movement;
}

// Obtenir les mouvements de stock
export async function getStockMovements(
  pagination: PaginationParams,
  filters: StockFilter
) {
  const conditions: SQL[] = [];

  if (filters.productId) {
    conditions.push(eq(stockMovements.productId, filters.productId));
  }

  if (filters.type) {
    conditions.push(eq(stockMovements.type, filters.type));
  }

  if (filters.startDate) {
    conditions.push(gte(stockMovements.createdAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(stockMovements.createdAt, filters.endDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [movements, countResult] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        stockBefore: stockMovements.stockBefore,
        stockAfter: stockMovements.stockAfter,
        orderId: stockMovements.orderId,
        supplierOrderId: stockMovements.supplierOrderId,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
        product: {
          id: products.id,
          reference: products.reference,
          name: products.name,
        },
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(pagination.limit)
      .offset(getOffset(pagination)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockMovements)
      .where(where),
  ]);

  return paginate(movements, countResult[0]?.count ?? 0, pagination);
}

// Obtenir les alertes de stock bas
export async function getStockAlerts(filters: StockAlertFilter = {}) {
  const conditions: SQL[] = [
    isNotNull(products.stockMin),
    isNotNull(products.stock),
    sql`${products.stock} <= ${products.stockMin}`,
    eq(products.isActive, true),
  ];

  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }

  if (filters.supplierId) {
    conditions.push(eq(products.supplierId, filters.supplierId));
  }

  const alerts = await db
    .select({
      id: products.id,
      reference: products.reference,
      name: products.name,
      category: products.category,
      stock: products.stock,
      stockMin: products.stockMin,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
    })
    .from(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(and(...conditions))
    .orderBy(sql`${products.stock} - ${products.stockMin}`); // Tri par urgence

  return alerts;
}

// Dashboard stock
export async function getStockDashboard() {
  const [
    totalProductsResult,
    lowStockResult,
    outOfStockResult,
    recentMovementsResult,
    movementsByTypeResult,
  ] = await Promise.all([
    // Total produits avec stock géré
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(isNotNull(products.stock), eq(products.isActive, true))),

    // Produits en stock bas
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(
        and(
          isNotNull(products.stockMin),
          isNotNull(products.stock),
          sql`${products.stock} <= ${products.stockMin}`,
          sql`${products.stock} > 0`,
          eq(products.isActive, true)
        )
      ),

    // Produits en rupture
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(
        and(
          isNotNull(products.stock),
          eq(products.stock, 0),
          eq(products.isActive, true)
        )
      ),

    // 5 derniers mouvements
    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        createdAt: stockMovements.createdAt,
        productName: products.name,
        productReference: products.reference,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .orderBy(desc(stockMovements.createdAt))
      .limit(5),

    // Mouvements par type (7 derniers jours)
    db
      .select({
        type: stockMovements.type,
        count: sql<number>`count(*)::int`,
        totalQuantity: sql<number>`sum(abs(${stockMovements.quantity}))::int`,
      })
      .from(stockMovements)
      .where(gte(stockMovements.createdAt, sql`NOW() - INTERVAL '7 days'`))
      .groupBy(stockMovements.type),
  ]);

  return {
    totalProducts: totalProductsResult[0]?.count ?? 0,
    lowStockCount: lowStockResult[0]?.count ?? 0,
    outOfStockCount: outOfStockResult[0]?.count ?? 0,
    recentMovements: recentMovementsResult,
    movementsByType: movementsByTypeResult,
  };
}

// Obtenir le stock d'un produit
export async function getProductStock(productId: string) {
  const [product] = await db
    .select({
      id: products.id,
      reference: products.reference,
      name: products.name,
      stock: products.stock,
      stockMin: products.stockMin,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new NotFoundError('Produit');
  }

  // Récupérer les derniers mouvements
  const movements = await db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(20);

  return {
    ...product,
    movements,
  };
}

// Réserver du stock pour une commande
export async function reserveStock(
  productId: string,
  quantity: number,
  orderId: string,
  userId?: string
) {
  return createStockMovement(
    {
      productId,
      type: 'reservation',
      quantity: -Math.abs(quantity),
      reason: `Réservation pour commande`,
      orderId,
    },
    userId
  );
}

// Libérer du stock réservé
export async function releaseStock(
  productId: string,
  quantity: number,
  orderId: string,
  userId?: string
) {
  return createStockMovement(
    {
      productId,
      type: 'liberation',
      quantity: Math.abs(quantity),
      reason: `Libération stock réservé`,
      orderId,
    },
    userId
  );
}

// Sortie de stock (expédition)
export async function consumeStock(
  productId: string,
  quantity: number,
  orderId: string,
  userId?: string
) {
  return createStockMovement(
    {
      productId,
      type: 'sortie',
      quantity: -Math.abs(quantity),
      reason: `Expédition commande`,
      orderId,
    },
    userId
  );
}

// Entrée de stock (réception fournisseur)
export async function receiveStock(
  productId: string,
  quantity: number,
  supplierOrderId: string,
  userId?: string
) {
  return createStockMovement(
    {
      productId,
      type: 'entree',
      quantity: Math.abs(quantity),
      reason: `Réception fournisseur`,
      supplierOrderId,
    },
    userId
  );
}

// Suggestions de réapprovisionnement
export async function getReplenishmentSuggestions() {
  const suggestions = await db
    .select({
      productId: products.id,
      productReference: products.reference,
      productName: products.name,
      category: products.category,
      currentStock: products.stock,
      stockMin: products.stockMin,
      purchasePriceHT: products.purchasePriceHT,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
      suggestedQuantity: sql<number>`GREATEST(${products.stockMin} * 2 - COALESCE(${products.stock}, 0), ${products.stockMin})::int`,
    })
    .from(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(
      and(
        isNotNull(products.stockMin),
        isNotNull(products.stock),
        sql`${products.stock} <= ${products.stockMin}`,
        eq(products.isActive, true)
      )
    )
    .orderBy(suppliers.name, products.name);

  // Grouper par fournisseur
  const bySupplier = new Map<string | null, typeof suggestions>();

  for (const item of suggestions) {
    const key = item.supplierId;
    if (!bySupplier.has(key)) {
      bySupplier.set(key, []);
    }
    bySupplier.get(key)!.push(item);
  }

  return Array.from(bySupplier.entries()).map(([supplierId, items]) => ({
    supplierId,
    supplierName: items[0]?.supplierName ?? 'Sans fournisseur',
    items,
    totalEstimatedCost: items.reduce((sum, item) => {
      const price = item.purchasePriceHT ? parseFloat(item.purchasePriceHT) : 0;
      return sum + price * (item.suggestedQuantity ?? 0);
    }, 0),
  }));
}
