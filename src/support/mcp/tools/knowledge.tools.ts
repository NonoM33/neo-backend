import { eq, ilike, and, or, inArray, sql } from 'drizzle-orm';
import { db } from '../../../config/database';
import {
  kbArticles,
  kbCategories,
  devices,
  rooms,
  products,
} from '../../../db/schema';
import { toolRegistry } from '../mcp.registry';
import type { ClientContext } from '../mcp.types';

// ============ search_knowledge_base ============

toolRegistry.register({
  name: 'search_knowledge_base',
  description:
    "Recherche dans la base de connaissances des articles publies par mot-cle et/ou categorie.",
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Mots-cles de recherche',
      },
      category: {
        type: 'string',
        description: 'Slug de la categorie pour filtrer les resultats',
      },
    },
    required: ['query'],
  },
  handler: async (
    _ctx: ClientContext,
    params: { query: string; category?: string }
  ) => {
    if (!params.query || params.query.trim().length === 0) {
      return { success: false, error: 'Le parametre query est requis.' };
    }

    const searchPattern = `%${params.query}%`;

    const conditions = [
      eq(kbArticles.status, 'publie'),
      or(
        ilike(kbArticles.title, searchPattern),
        ilike(kbArticles.content, searchPattern)
      )!,
    ];

    // If a category slug is provided, resolve its ID and filter
    if (params.category) {
      const [cat] = await db
        .select({ id: kbCategories.id })
        .from(kbCategories)
        .where(
          and(
            eq(kbCategories.slug, params.category),
            eq(kbCategories.isActive, true)
          )
        )
        .limit(1);

      if (cat) {
        conditions.push(eq(kbArticles.categoryId, cat.id));
      }
    }

    const data = await db
      .select({
        id: kbArticles.id,
        title: kbArticles.title,
        slug: kbArticles.slug,
        excerpt: kbArticles.excerpt,
        tags: kbArticles.tags,
      })
      .from(kbArticles)
      .where(and(...conditions))
      .limit(5);

    return { success: true, data };
  },
});

// ============ get_device_troubleshooting ============

toolRegistry.register({
  name: 'get_device_troubleshooting',
  description:
    "Recherche des articles de depannage en rapport avec un appareil ou une categorie de probleme.",
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description:
          "ID de l'appareil pour trouver des articles lies a sa categorie produit",
      },
      category: {
        type: 'string',
        description: 'Categorie de produit pour filtrer',
      },
      problemType: {
        type: 'string',
        description:
          'Type de probleme (ex: connexion, configuration, alimentation)',
      },
    },
    required: [],
  },
  handler: async (
    ctx: ClientContext,
    params: { deviceId?: string; category?: string; problemType?: string }
  ) => {
    let productCategory: string | null = null;

    // If deviceId is provided, look up the device's product category
    if (params.deviceId) {
      // Validate device belongs to client
      if (ctx.projectIds.length === 0) {
        return {
          success: false,
          error: "Acces refuse: aucun projet associe.",
        };
      }

      const [device] = await db
        .select({
          id: devices.id,
          productCategory: products.category,
        })
        .from(devices)
        .innerJoin(rooms, eq(devices.roomId, rooms.id))
        .leftJoin(products, eq(devices.productId, products.id))
        .where(
          and(
            eq(devices.id, params.deviceId),
            inArray(rooms.projectId, ctx.projectIds)
          )
        )
        .limit(1);

      if (!device) {
        return {
          success: false,
          error:
            "Appareil introuvable ou ne vous appartient pas.",
        };
      }

      productCategory = device.productCategory;
    } else if (params.category) {
      productCategory = params.category;
    }

    // Build search tags
    const searchTags: string[] = [];
    if (productCategory) {
      searchTags.push(productCategory);
    }
    searchTags.push(params.problemType || 'depannage');

    // Search KB articles that match any of the tags or contain keywords
    const tagConditions = searchTags.map((tag) =>
      sql`${tag} = ANY(${kbArticles.tags})`
    );

    const keywordConditions = searchTags.map((tag) =>
      or(
        ilike(kbArticles.title, `%${tag}%`),
        ilike(kbArticles.content, `%${tag}%`)
      )!
    );

    const data = await db
      .select({
        id: kbArticles.id,
        title: kbArticles.title,
        slug: kbArticles.slug,
        excerpt: kbArticles.excerpt,
        tags: kbArticles.tags,
      })
      .from(kbArticles)
      .where(
        and(
          eq(kbArticles.status, 'publie'),
          or(...tagConditions, ...keywordConditions)
        )
      )
      .limit(5);

    return { success: true, data };
  },
});
