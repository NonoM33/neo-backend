import { eq, ilike, or, count, and, desc, sql, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { kbCategories, kbArticles, kbArticleVersions, faqItems, users } from '../../db/schema';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type {
  CreateKbCategoryInput,
  UpdateKbCategoryInput,
  CreateArticleInput,
  UpdateArticleInput,
  CreateFaqInput,
  UpdateFaqInput,
} from './kb.schema';

// ============ KB Categories ============

export async function getCategories() {
  return db
    .select()
    .from(kbCategories)
    .orderBy(kbCategories.sortOrder, kbCategories.name);
}

export async function getCategoryById(id: string) {
  const [category] = await db
    .select()
    .from(kbCategories)
    .where(eq(kbCategories.id, id))
    .limit(1);

  if (!category) {
    throw new NotFoundError('Catégorie KB');
  }

  return category;
}

export async function createCategory(input: CreateKbCategoryInput) {
  const [existing] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(eq(kbCategories.slug, input.slug))
    .limit(1);

  if (existing) {
    throw new ConflictError('Une catégorie avec ce slug existe déjà');
  }

  const [category] = await db.insert(kbCategories).values(input).returning();
  return category;
}

export async function updateCategory(id: string, input: UpdateKbCategoryInput) {
  const [existing] = await db
    .select()
    .from(kbCategories)
    .where(eq(kbCategories.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Catégorie KB');
  }

  if (input.slug && input.slug !== existing.slug) {
    const [slugConflict] = await db
      .select({ id: kbCategories.id })
      .from(kbCategories)
      .where(eq(kbCategories.slug, input.slug))
      .limit(1);

    if (slugConflict) {
      throw new ConflictError('Une catégorie avec ce slug existe déjà');
    }
  }

  const [category] = await db
    .update(kbCategories)
    .set(input)
    .where(eq(kbCategories.id, id))
    .returning();

  return category;
}

export async function deleteCategory(id: string) {
  const [existing] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(eq(kbCategories.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Catégorie KB');
  }

  await db.delete(kbCategories).where(eq(kbCategories.id, id));
}

// ============ Articles (Staff) ============

export async function getArticles(
  params: PaginationParams,
  filters?: { status?: string; categoryId?: string; search?: string }
) {
  const conditions: SQL[] = [];

  if (filters?.status) {
    conditions.push(eq(kbArticles.status, filters.status as any));
  }

  if (filters?.categoryId) {
    conditions.push(eq(kbArticles.categoryId, filters.categoryId));
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(kbArticles.title, `%${filters.search}%`),
        ilike(kbArticles.content, `%${filters.search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: kbArticles.id,
        title: kbArticles.title,
        slug: kbArticles.slug,
        categoryId: kbArticles.categoryId,
        excerpt: kbArticles.excerpt,
        tags: kbArticles.tags,
        status: kbArticles.status,
        viewCount: kbArticles.viewCount,
        helpfulCount: kbArticles.helpfulCount,
        notHelpfulCount: kbArticles.notHelpfulCount,
        version: kbArticles.version,
        publishedAt: kbArticles.publishedAt,
        createdAt: kbArticles.createdAt,
        updatedAt: kbArticles.updatedAt,
        category: {
          id: kbCategories.id,
          name: kbCategories.name,
          slug: kbCategories.slug,
        },
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(kbArticles)
      .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
      .leftJoin(users, eq(kbArticles.authorId, users.id))
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(kbArticles.createdAt)),
    db.select({ total: count() }).from(kbArticles).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getArticleById(id: string) {
  const [article] = await db
    .select({
      id: kbArticles.id,
      title: kbArticles.title,
      slug: kbArticles.slug,
      categoryId: kbArticles.categoryId,
      content: kbArticles.content,
      excerpt: kbArticles.excerpt,
      tags: kbArticles.tags,
      status: kbArticles.status,
      viewCount: kbArticles.viewCount,
      helpfulCount: kbArticles.helpfulCount,
      notHelpfulCount: kbArticles.notHelpfulCount,
      version: kbArticles.version,
      publishedAt: kbArticles.publishedAt,
      createdAt: kbArticles.createdAt,
      updatedAt: kbArticles.updatedAt,
      category: {
        id: kbCategories.id,
        name: kbCategories.name,
        slug: kbCategories.slug,
      },
      author: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(kbArticles)
    .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
    .leftJoin(users, eq(kbArticles.authorId, users.id))
    .where(eq(kbArticles.id, id))
    .limit(1);

  if (!article) {
    throw new NotFoundError('Article KB');
  }

  return article;
}

export async function createArticle(input: CreateArticleInput, authorId: string) {
  const [existing] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(eq(kbArticles.slug, input.slug))
    .limit(1);

  if (existing) {
    throw new ConflictError('Un article avec ce slug existe déjà');
  }

  const [article] = await db
    .insert(kbArticles)
    .values({
      ...input,
      authorId,
      version: 1,
    })
    .returning();

  return article;
}

export async function updateArticle(id: string, input: UpdateArticleInput, changedById: string) {
  const [existing] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Article KB');
  }

  if (input.slug && input.slug !== existing.slug) {
    const [slugConflict] = await db
      .select({ id: kbArticles.id })
      .from(kbArticles)
      .where(eq(kbArticles.slug, input.slug))
      .limit(1);

    if (slugConflict) {
      throw new ConflictError('Un article avec ce slug existe déjà');
    }
  }

  // If content or title changed, create a version entry with the OLD values
  const contentChanged = input.content && input.content !== existing.content;
  const titleChanged = input.title && input.title !== existing.title;

  if (contentChanged || titleChanged) {
    await db.insert(kbArticleVersions).values({
      articleId: id,
      version: existing.version,
      title: existing.title,
      content: existing.content,
      changedById,
    });
  }

  const updateData: Record<string, any> = {
    ...input,
    updatedAt: new Date(),
  };

  if (contentChanged || titleChanged) {
    updateData.version = existing.version + 1;
  }

  // If status changed to 'publie' and never published before, set publishedAt
  if (input.status === 'publie' && !existing.publishedAt) {
    updateData.publishedAt = new Date();
  }

  const [article] = await db
    .update(kbArticles)
    .set(updateData)
    .where(eq(kbArticles.id, id))
    .returning();

  return article;
}

export async function deleteArticle(id: string) {
  const [existing] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(eq(kbArticles.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Article KB');
  }

  await db.delete(kbArticles).where(eq(kbArticles.id, id));
}

// ============ Articles (Public/Client) ============

export async function searchPublishedArticles(
  params: PaginationParams,
  query?: string,
  categorySlug?: string,
  tag?: string
) {
  const conditions: SQL[] = [eq(kbArticles.status, 'publie')];

  if (query) {
    conditions.push(
      or(
        ilike(kbArticles.title, `%${query}%`),
        ilike(kbArticles.content, `%${query}%`),
        ilike(kbArticles.excerpt, `%${query}%`)
      )!
    );
  }

  if (categorySlug) {
    conditions.push(eq(kbCategories.slug, categorySlug));
  }

  if (tag) {
    conditions.push(sql`${kbArticles.tags} @> ARRAY[${tag}]::text[]`);
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: kbArticles.id,
        title: kbArticles.title,
        slug: kbArticles.slug,
        excerpt: kbArticles.excerpt,
        tags: kbArticles.tags,
        viewCount: kbArticles.viewCount,
        helpfulCount: kbArticles.helpfulCount,
        publishedAt: kbArticles.publishedAt,
        category: {
          id: kbCategories.id,
          name: kbCategories.name,
          slug: kbCategories.slug,
        },
      })
      .from(kbArticles)
      .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(kbArticles.publishedAt)),
    db
      .select({ total: count() })
      .from(kbArticles)
      .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
      .where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getPublishedArticleBySlug(slug: string) {
  const [article] = await db
    .select({
      id: kbArticles.id,
      title: kbArticles.title,
      slug: kbArticles.slug,
      content: kbArticles.content,
      excerpt: kbArticles.excerpt,
      tags: kbArticles.tags,
      viewCount: kbArticles.viewCount,
      helpfulCount: kbArticles.helpfulCount,
      notHelpfulCount: kbArticles.notHelpfulCount,
      publishedAt: kbArticles.publishedAt,
      category: {
        id: kbCategories.id,
        name: kbCategories.name,
        slug: kbCategories.slug,
      },
    })
    .from(kbArticles)
    .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
    .where(and(eq(kbArticles.slug, slug), eq(kbArticles.status, 'publie')))
    .limit(1);

  if (!article) {
    throw new NotFoundError('Article KB');
  }

  // Increment view count
  await db
    .update(kbArticles)
    .set({ viewCount: sql`${kbArticles.viewCount} + 1` })
    .where(eq(kbArticles.slug, slug));

  return article;
}

export async function recordArticleFeedback(articleId: string, helpful: boolean) {
  const [existing] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Article KB');
  }

  if (helpful) {
    await db
      .update(kbArticles)
      .set({ helpfulCount: sql`${kbArticles.helpfulCount} + 1` })
      .where(eq(kbArticles.id, articleId));
  } else {
    await db
      .update(kbArticles)
      .set({ notHelpfulCount: sql`${kbArticles.notHelpfulCount} + 1` })
      .where(eq(kbArticles.id, articleId));
  }
}

// ============ FAQ ============

export async function getFaqItems(onlyPublished?: boolean) {
  const where = onlyPublished ? eq(faqItems.isPublished, true) : undefined;

  return db
    .select()
    .from(faqItems)
    .where(where)
    .orderBy(faqItems.sortOrder);
}

export async function createFaq(input: CreateFaqInput) {
  const [faq] = await db.insert(faqItems).values(input).returning();
  return faq;
}

export async function updateFaq(id: string, input: UpdateFaqInput) {
  const [existing] = await db
    .select({ id: faqItems.id })
    .from(faqItems)
    .where(eq(faqItems.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('FAQ');
  }

  const [faq] = await db
    .update(faqItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(faqItems.id, id))
    .returning();

  return faq;
}

export async function deleteFaq(id: string) {
  const [existing] = await db
    .select({ id: faqItems.id })
    .from(faqItems)
    .where(eq(faqItems.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('FAQ');
  }

  await db.delete(faqItems).where(eq(faqItems.id, id));
}
