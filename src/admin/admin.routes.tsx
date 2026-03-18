import { Hono } from 'hono';
import { count, eq, desc, and } from 'drizzle-orm';
import { db } from '../config/database';
import { users, projects, products, quotes, clients } from '../db/schema';
import { hashPassword } from '../modules/auth/auth.service';
import * as productsService from '../modules/products/products.service';

import { Dashboard } from './views/dashboard';
import { UsersList } from './views/users-list';
import { UserForm } from './views/user-form';
import { ProductsList } from './views/products-list';
import { ProductForm } from './views/product-form';
import { ProjectsList } from './views/projects-list';
import { ImportProducts } from './views/import-products';

const adminRouter = new Hono();

// Dashboard
adminRouter.get('/', async (c) => {
  const [usersResult, projectsResult, productsResult, quotesResult] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(projects),
    db.select({ count: count() }).from(products),
    db.select({ count: count() }).from(quotes),
  ]);

  return c.html(
    <Dashboard
      stats={{
        usersCount: usersResult[0]?.count ?? 0,
        projectsCount: projectsResult[0]?.count ?? 0,
        productsCount: productsResult[0]?.count ?? 0,
        quotesCount: quotesResult[0]?.count ?? 0,
      }}
    />
  );
});

// ============ Users ============

adminRouter.get('/users', async (c) => {
  const usersList = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return c.html(<UsersList users={usersList} />);
});

adminRouter.get('/users/new', (c) => {
  return c.html(<UserForm />);
});

adminRouter.post('/users', async (c) => {
  const body = await c.req.parseBody();

  try {
    const hashedPassword = await hashPassword(body.password as string);

    await db.insert(users).values({
      email: body.email as string,
      password: hashedPassword,
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      phone: (body.phone as string) || undefined,
      role: body.role as 'admin' | 'integrateur' | 'auditeur',
    });

    return c.redirect('/admin/users');
  } catch (error: any) {
    return c.html(<UserForm error={error.message} />);
  }
});

adminRouter.get('/users/:id/edit', async (c) => {
  const id = c.req.param('id');

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    return c.redirect('/admin/users');
  }

  return c.html(<UserForm user={user} />);
});

adminRouter.post('/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    const updateData: Record<string, any> = {
      email: body.email as string,
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      phone: (body.phone as string) || null,
      role: body.role as 'admin' | 'integrateur' | 'auditeur',
      updatedAt: new Date(),
    };

    if (body.password && (body.password as string).length >= 6) {
      updateData.password = await hashPassword(body.password as string);
    }

    await db.update(users).set(updateData).where(eq(users.id, id));

    return c.redirect('/admin/users');
  } catch (error: any) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return c.html(<UserForm user={user} error={error.message} />);
  }
});

adminRouter.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(users).where(eq(users.id, id));
  return c.text('');
});

// ============ Products ============

adminRouter.get('/products', async (c) => {
  const category = c.req.query('category');

  const where = category ? eq(products.category, category) : undefined;

  const [productsList, categories] = await Promise.all([
    db.select().from(products).where(where).orderBy(products.name),
    productsService.getCategories(),
  ]);

  return c.html(
    <ProductsList
      products={productsList}
      categories={categories}
      currentCategory={category}
    />
  );
});

adminRouter.get('/products/new', async (c) => {
  const categories = await productsService.getCategories();
  return c.html(<ProductForm categories={categories} />);
});

adminRouter.post('/products', async (c) => {
  const body = await c.req.parseBody();

  try {
    await db.insert(products).values({
      reference: body.reference as string,
      name: body.name as string,
      description: (body.description as string) || undefined,
      category: body.category as string,
      brand: (body.brand as string) || undefined,
      priceHT: body.priceHT as string,
      tvaRate: body.tvaRate as string || '20',
      stock: body.stock ? parseInt(body.stock as string, 10) : undefined,
      imageUrl: (body.imageUrl as string) || undefined,
      isActive: body.isActive === 'on',
    });

    return c.redirect('/admin/products');
  } catch (error: any) {
    const categories = await productsService.getCategories();
    return c.html(<ProductForm categories={categories} error={error.message} />);
  }
});

adminRouter.get('/products/:id/edit', async (c) => {
  const id = c.req.param('id');

  const [[product], categories] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).limit(1),
    productsService.getCategories(),
  ]);

  if (!product) {
    return c.redirect('/admin/products');
  }

  return c.html(<ProductForm product={product} categories={categories} />);
});

adminRouter.post('/products/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await db
      .update(products)
      .set({
        reference: body.reference as string,
        name: body.name as string,
        description: (body.description as string) || null,
        category: body.category as string,
        brand: (body.brand as string) || null,
        priceHT: body.priceHT as string,
        tvaRate: body.tvaRate as string || '20',
        stock: body.stock ? parseInt(body.stock as string, 10) : null,
        imageUrl: (body.imageUrl as string) || null,
        isActive: body.isActive === 'on',
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    return c.redirect('/admin/products');
  } catch (error: any) {
    const [[product], categories] = await Promise.all([
      db.select().from(products).where(eq(products.id, id)).limit(1),
      productsService.getCategories(),
    ]);

    return c.html(<ProductForm product={product} categories={categories} error={error.message} />);
  }
});

adminRouter.delete('/products/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(products).where(eq(products.id, id));
  return c.text('');
});

adminRouter.get('/products/import', (c) => {
  return c.html(<ImportProducts />);
});

adminRouter.post('/products/import', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return c.html(<ImportProducts result={{ imported: 0, errors: ['Fichier requis'] }} />);
  }

  const content = await file.text();
  const result = await productsService.importProductsFromCSV(content);

  return c.html(<ImportProducts result={result} />);
});

// ============ Projects ============

adminRouter.get('/projects', async (c) => {
  const status = c.req.query('status');

  const where = status ? eq(projects.status, status as any) : undefined;

  const projectsList = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      createdAt: projects.createdAt,
      client: {
        firstName: clients.firstName,
        lastName: clients.lastName,
      },
      user: {
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .innerJoin(users, eq(projects.userId, users.id))
    .where(where)
    .orderBy(desc(projects.createdAt));

  return c.html(<ProjectsList projects={projectsList} currentStatus={status} />);
});

export default adminRouter;
