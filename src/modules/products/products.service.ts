import { eq, ilike, or, count, and, desc, gte, lte, SQL, inArray } from 'drizzle-orm';
import { db } from '../../config/database';
import { products, productDependencies } from '../../db/schema';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type { CreateProductInput, UpdateProductInput, ProductFilter, CreateDependencyInput, UpdateDependencyInput } from './products.schema';

export async function getProducts(params: PaginationParams, filters: ProductFilter) {
  const conditions: SQL[] = [];

  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }

  if (filters.brand) {
    conditions.push(eq(products.brand, filters.brand));
  }

  if (filters.isActive !== undefined) {
    conditions.push(eq(products.isActive, filters.isActive));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(products.name, `%${filters.search}%`),
        ilike(products.reference, `%${filters.search}%`),
        ilike(products.description, `%${filters.search}%`)
      )!
    );
  }

  if (filters.minPrice !== undefined) {
    conditions.push(gte(products.priceHT, filters.minPrice.toString()));
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(lte(products.priceHT, filters.maxPrice.toString()));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(products.name),
    db.select({ total: count() }).from(products).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getProductById(id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    throw new NotFoundError('Produit');
  }

  return product;
}

export async function getCategories() {
  const result = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.category);

  return result.map((r) => r.category);
}

export async function getBrands() {
  const result = await db
    .selectDistinct({ brand: products.brand })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.brand);

  return result.filter((r) => r.brand).map((r) => r.brand);
}

export async function createProduct(input: CreateProductInput) {
  // Check if reference already exists
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.reference, input.reference))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Un produit avec cette référence existe déjà');
  }

  const [product] = await db
    .insert(products)
    .values({
      ...input,
      priceHT: input.priceHT.toString(),
      tvaRate: input.tvaRate.toString(),
      purchasePriceHT: input.purchasePriceHT !== undefined ? input.purchasePriceHT.toString() : undefined,
    })
    .returning();

  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Produit');
  }

  // Check reference uniqueness if updating reference
  if (input.reference) {
    const refExists = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.reference, input.reference))
      .limit(1);

    if (refExists.length > 0 && refExists[0]?.id !== id) {
      throw new ConflictError('Un produit avec cette référence existe déjà');
    }
  }

  const updateData: Record<string, any> = { ...input, updatedAt: new Date() };

  if (input.priceHT !== undefined) {
    updateData.priceHT = input.priceHT.toString();
  }

  if (input.tvaRate !== undefined) {
    updateData.tvaRate = input.tvaRate.toString();
  }

  if (input.purchasePriceHT !== undefined) {
    updateData.purchasePriceHT = input.purchasePriceHT.toString();
  }

  const [product] = await db
    .update(products)
    .set(updateData)
    .where(eq(products.id, id))
    .returning();

  return product;
}

export async function deleteProduct(id: string) {
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Produit');
  }

  await db.delete(products).where(eq(products.id, id));
}

export async function importProductsFromCSV(csvContent: string) {
  const lines = csvContent.trim().split('\n');
  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error('Fichier CSV vide');
  }
  const header = headerLine.split(';');

  const requiredFields = ['reference', 'name', 'category', 'priceht'];
  const headerLower = header.map((h) => h.trim().toLowerCase());

  for (const field of requiredFields) {
    if (!headerLower.includes(field)) {
      throw new Error(`Champ requis manquant: ${field}`);
    }
  }

  const fieldMap: Record<string, number> = {};
  header.forEach((h, i) => {
    fieldMap[h.trim().toLowerCase()] = i;
  });

  const productsToInsert: CreateProductInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = line.split(';').map((v) => v.trim());

    if (values.length < header.length) continue;

    const refIdx = fieldMap['reference'];
    const nameIdx = fieldMap['name'];
    const catIdx = fieldMap['category'];
    const priceIdx = fieldMap['priceht'];
    const descIdx = fieldMap['description'];
    const brandIdx = fieldMap['brand'];
    const tvaIdx = fieldMap['tvarate'];
    const purchasePriceIdx = fieldMap['purchasepriceht'];
    const supplierUrlIdx = fieldMap['supplierproducturl'];

    if (refIdx === undefined || nameIdx === undefined || catIdx === undefined || priceIdx === undefined) {
      continue;
    }

    productsToInsert.push({
      reference: values[refIdx] ?? '',
      name: values[nameIdx] ?? '',
      description: descIdx !== undefined ? values[descIdx] : undefined,
      category: values[catIdx] ?? '',
      brand: brandIdx !== undefined ? values[brandIdx] : undefined,
      priceHT: parseFloat(values[priceIdx] ?? '0'),
      tvaRate: parseFloat(tvaIdx !== undefined ? (values[tvaIdx] ?? '20') : '20'),
      purchasePriceHT: purchasePriceIdx !== undefined && values[purchasePriceIdx] ? parseFloat(values[purchasePriceIdx]) : undefined,
      supplierProductUrl: supplierUrlIdx !== undefined ? values[supplierUrlIdx] : undefined,
      isActive: true,
    });
  }

  let imported = 0;
  const errors: string[] = [];

  for (const product of productsToInsert) {
    try {
      await createProduct(product);
      imported++;
    } catch (error: any) {
      errors.push(`${product.reference}: ${error.message}`);
    }
  }

  return { imported, errors };
}

// ========================================
// DÉPENDANCES PRODUITS
// ========================================

export async function getProductDependencies(productId: string) {
  await getProductById(productId);

  const deps = await db
    .select({
      id: productDependencies.id,
      type: productDependencies.type,
      description: productDependencies.description,
      requiredProduct: {
        id: products.id,
        reference: products.reference,
        name: products.name,
        category: products.category,
        brand: products.brand,
        priceHT: products.priceHT,
        tvaRate: products.tvaRate,
        imageUrl: products.imageUrl,
      },
    })
    .from(productDependencies)
    .innerJoin(products, eq(productDependencies.requiredProductId, products.id))
    .where(eq(productDependencies.productId, productId));

  return deps;
}

export async function addProductDependency(productId: string, input: CreateDependencyInput) {
  await getProductById(productId);
  await getProductById(input.requiredProductId);

  if (productId === input.requiredProductId) {
    throw new ConflictError('Un produit ne peut pas dépendre de lui-même');
  }

  // Vérifier doublon
  const existing = await db
    .select({ id: productDependencies.id })
    .from(productDependencies)
    .where(
      and(
        eq(productDependencies.productId, productId),
        eq(productDependencies.requiredProductId, input.requiredProductId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Cette dépendance existe déjà');
  }

  const [dep] = await db
    .insert(productDependencies)
    .values({
      productId,
      requiredProductId: input.requiredProductId,
      type: input.type,
      description: input.description,
    })
    .returning();

  return dep;
}

export async function updateProductDependency(dependencyId: string, input: UpdateDependencyInput) {
  const [existing] = await db
    .select()
    .from(productDependencies)
    .where(eq(productDependencies.id, dependencyId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Dépendance');
  }

  const updateData: Record<string, any> = {};
  if (input.type !== undefined) updateData.type = input.type;
  if (input.description !== undefined) updateData.description = input.description;

  const [dep] = await db
    .update(productDependencies)
    .set(updateData)
    .where(eq(productDependencies.id, dependencyId))
    .returning();

  return dep;
}

export async function removeProductDependency(dependencyId: string) {
  const [existing] = await db
    .select({ id: productDependencies.id })
    .from(productDependencies)
    .where(eq(productDependencies.id, dependencyId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Dépendance');
  }

  await db.delete(productDependencies).where(eq(productDependencies.id, dependencyId));
}

export async function getProductWithDependencies(id: string) {
  const product = await getProductById(id);
  const dependencies = await getProductDependencies(id);

  // Aussi récupérer les produits qui dépendent de celui-ci (reverse deps)
  const dependents = await db
    .select({
      id: productDependencies.id,
      type: productDependencies.type,
      product: {
        id: products.id,
        reference: products.reference,
        name: products.name,
        category: products.category,
        brand: products.brand,
      },
    })
    .from(productDependencies)
    .innerJoin(products, eq(productDependencies.productId, products.id))
    .where(eq(productDependencies.requiredProductId, id));

  return {
    ...product,
    dependencies,  // Ce produit a besoin de...
    dependents,    // Ces produits ont besoin de celui-ci
  };
}

// Vérifier les dépendances manquantes pour une liste de produits
export async function checkMissingDependencies(productIds: string[]) {
  if (productIds.length === 0) return [];

  // Récupérer toutes les dépendances des produits dans la liste
  const deps = await db
    .select({
      id: productDependencies.id,
      productId: productDependencies.productId,
      requiredProductId: productDependencies.requiredProductId,
      type: productDependencies.type,
      description: productDependencies.description,
    })
    .from(productDependencies)
    .where(inArray(productDependencies.productId, productIds));

  // Filtrer les dépendances required dont le produit requis n'est pas déjà dans la liste
  const missingDeps = deps.filter(
    dep => dep.type === 'required' && !productIds.includes(dep.requiredProductId)
  );

  if (missingDeps.length === 0) return [];

  // Dédupliquer par requiredProductId
  const uniqueRequiredIds = [...new Set(missingDeps.map(d => d.requiredProductId))];

  // Récupérer les infos des produits manquants + les produits source
  const [requiredProducts, sourceProducts] = await Promise.all([
    db.select().from(products).where(inArray(products.id, uniqueRequiredIds)),
    db.select({ id: products.id, name: products.name, reference: products.reference })
      .from(products)
      .where(inArray(products.id, missingDeps.map(d => d.productId))),
  ]);

  const requiredMap = new Map(requiredProducts.map(p => [p.id, p]));
  const sourceMap = new Map(sourceProducts.map(p => [p.id, p]));

  return missingDeps.map(dep => ({
    ...dep,
    productName: sourceMap.get(dep.productId)?.name ?? '',
    requiredProduct: requiredMap.get(dep.requiredProductId),
  }));
}
