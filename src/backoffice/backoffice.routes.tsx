import { Hono } from 'hono';
import { count, eq, desc, and, ilike, or, sql, SQL, gte, lte } from 'drizzle-orm';
import { db } from '../config/database';
import { users, clients, projects, suppliers, products, productDependencies, quotes, quoteLines, rooms, photos, devices, checklistItems, leads, activities, salesObjectives, leadStageHistory, userRoles, roles, tickets, ticketComments, ticketHistory, ticketCategories, slaDefinitions, cannedResponses, kbArticles, kbCategories, faqItems, chatMessages, chatSessions, orders, orderLines, orderStatusHistory, stockMovements, supplierOrders, supplierOrderLines, invoices, invoiceLines } from '../db/schema';
import { hashPassword, verifyPasswordHash } from '../modules/auth/auth.service';
import * as productsService from '../modules/products/products.service';
import * as ordersService from '../modules/orders/orders.service';
import * as stockService from '../modules/stock/stock.service';
import * as supplierOrdersService from '../modules/supplier-orders/supplier-orders.service';
import * as invoicesService from '../modules/invoices/invoices.service';
import * as leadsService from '../modules/leads/leads.service';
import * as activitiesService from '../modules/activities/activities.service';
import * as kpisService from '../modules/kpis/kpis.service';
import * as ticketsService from '../support/tickets/tickets.service';
import * as kbService from '../support/kb/kb.service';

import {
  requireAdmin,
  createSession,
  destroySession,
  getSessionUser,
  type AdminUser,
} from './middleware/admin-auth';

import { LoginPage } from './pages/login';
import { DashboardPage } from './pages/dashboard';
import { UsersListPage, UserFormPage } from './pages/users';
import { ClientsListPage, ClientFormPage, ClientDetailPage } from './pages/clients';
import { ProductsListPage, ProductFormPage, ImportProductsPage } from './pages/products';
import { SuppliersListPage, SupplierFormPage } from './pages/suppliers';
import { ProjectsListPage, ProjectDetailPage } from './pages/projects';
import { PipelinePage, LeadFormPage, LeadDetailPage, KPIsDashboardPage } from './pages/crm';
import { ActivitiesListPage, ActivityFormPage } from './pages/activities';
import { ObjectivesListPage, ObjectiveFormPage } from './pages/objectives';
import {
  SupportDashboardPage,
  TicketsListPage,
  TicketDetailPage,
  KBListPage,
  KBFormPage,
  FAQListPage,
  FAQFormPage,
  SupportSettingsPage,
} from '../support/backoffice';
import { OrdersListPage, OrderDetailPage, OrderFormPage } from './pages/orders';
import { StockDashboardPage, StockMovementsPage } from './pages/stock';
import { SupplierOrdersListPage, SupplierOrderDetailPage, SupplierOrderFormPage } from './pages/supplier-orders';
import { InvoicesListPage, InvoiceDetailPage } from './pages/invoices';

type Env = {
  Variables: {
    adminUser: AdminUser;
  };
};

const backofficeRouter = new Hono<Env>();

const PAGE_SIZE = 20;

// ============ Auth ============

backofficeRouter.get('/login', async (c) => {
  const existingUser = await getSessionUser(c);
  if (existingUser && existingUser.role === 'admin') {
    return c.redirect('/backoffice');
  }
  const error = c.req.query('error');
  return c.html(<LoginPage error={error} />);
});

backofficeRouter.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email = body.email as string;
  const password = body.password as string;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.redirect('/backoffice/login?error=invalid_credentials');
    }

    const validPassword = await verifyPasswordHash(password, user.password);
    if (!validPassword) {
      return c.redirect('/backoffice/login?error=invalid_credentials');
    }

    if (user.role !== 'admin') {
      return c.redirect('/backoffice/login?error=access_denied');
    }

    await createSession(c, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });

    return c.redirect('/backoffice');
  } catch {
    return c.redirect('/backoffice/login?error=invalid_credentials');
  }
});

backofficeRouter.get('/logout', (c) => {
  destroySession(c);
  return c.redirect('/backoffice/login');
});

// ============ Protected routes ============

backofficeRouter.use('/*', requireAdmin);

// ============ Dashboard ============

backofficeRouter.get('/', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;

  const [
    usersResult,
    clientsResult,
    projectsResult,
    productsResult,
    quotesResult,
    pendingQuotesResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(clients),
    db.select({ count: count() }).from(projects),
    db.select({ count: count() }).from(products),
    db.select({ count: count() }).from(quotes),
    db.select({ count: count() }).from(quotes).where(eq(quotes.status, 'brouillon')),
  ]);

  const recentProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      createdAt: projects.createdAt,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .orderBy(desc(projects.createdAt))
    .limit(5);

  const recentQuotes = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      status: quotes.status,
      totalTTC: quotes.totalTTC,
      createdAt: quotes.createdAt,
      projectName: projects.name,
    })
    .from(quotes)
    .innerJoin(projects, eq(quotes.projectId, projects.id))
    .orderBy(desc(quotes.createdAt))
    .limit(5);

  return c.html(
    <DashboardPage
      stats={{
        usersCount: usersResult[0]?.count ?? 0,
        clientsCount: clientsResult[0]?.count ?? 0,
        projectsCount: projectsResult[0]?.count ?? 0,
        productsCount: productsResult[0]?.count ?? 0,
        quotesCount: quotesResult[0]?.count ?? 0,
        pendingQuotesCount: pendingQuotesResult[0]?.count ?? 0,
      }}
      recentProjects={recentProjects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        createdAt: p.createdAt,
        clientName: `${p.clientFirstName} ${p.clientLastName}`,
      }))}
      recentQuotes={recentQuotes.map((q) => ({
        id: q.id,
        number: q.number,
        status: q.status,
        totalTTC: q.totalTTC,
        projectName: q.projectName,
        createdAt: q.createdAt,
      }))}
      user={adminUser}
    />
  );
});

// ============ Users ============

backofficeRouter.get('/users', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const search = c.req.query('search');
  const role = c.req.query('role');

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        ilike(users.email, `%${search}%`),
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName, `%${search}%`)
      )!
    );
  }

  if (role) {
    conditions.push(eq(users.role, role as any));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [usersList, countResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(users).where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return c.html(
    <UsersListPage
      users={usersList}
      currentPage={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      search={search}
      role={role}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/users/new', (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  return c.html(<UserFormPage user={adminUser} />);
});

backofficeRouter.post('/users', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
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

    return c.redirect('/backoffice/users');
  } catch (error: any) {
    return c.html(<UserFormPage error={error.message} user={adminUser} />);
  }
});

backofficeRouter.get('/users/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [userData] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!userData) {
    return c.redirect('/backoffice/users');
  }

  return c.html(<UserFormPage userData={userData} user={adminUser} />);
});

backofficeRouter.post('/users/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
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

    return c.redirect('/backoffice/users');
  } catch (error: any) {
    const [userData] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return c.html(<UserFormPage userData={userData} error={error.message} user={adminUser} />);
  }
});

backofficeRouter.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(users).where(eq(users.id, id));
  return c.text('');
});

// ============ Clients ============

backofficeRouter.get('/clients', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const search = c.req.query('search');

  let where: SQL | undefined;

  if (search) {
    where = or(
      ilike(clients.firstName, `%${search}%`),
      ilike(clients.lastName, `%${search}%`),
      ilike(clients.email, `%${search}%`),
      ilike(clients.phone, `%${search}%`)
    );
  }

  const [clientsList, countResult] = await Promise.all([
    db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        city: clients.city,
        createdAt: clients.createdAt,
        projectsCount: sql<number>`(SELECT COUNT(*) FROM projects WHERE projects.client_id = clients.id)`,
      })
      .from(clients)
      .where(where)
      .orderBy(desc(clients.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(clients).where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return c.html(
    <ClientsListPage
      clients={clientsList}
      currentPage={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      search={search}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/clients/new', (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  return c.html(<ClientFormPage user={adminUser} />);
});

backofficeRouter.post('/clients', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    await db.insert(clients).values({
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      email: (body.email as string) || undefined,
      phone: (body.phone as string) || undefined,
      address: (body.address as string) || undefined,
      city: (body.city as string) || undefined,
      postalCode: (body.postalCode as string) || undefined,
      notes: (body.notes as string) || undefined,
    });

    return c.redirect('/backoffice/clients');
  } catch (error: any) {
    return c.html(<ClientFormPage error={error.message} user={adminUser} />);
  }
});

backofficeRouter.get('/clients/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [clientData] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);

  if (!clientData) {
    return c.redirect('/backoffice/clients');
  }

  // Fetch all related data
  const [clientProjects, clientActivities, clientTickets, clientLeads] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        createdAt: projects.createdAt,
        quotesCount: sql<number>`(SELECT COUNT(*) FROM quotes WHERE quotes.project_id = projects.id)`,
        totalTTC: sql<string>`(SELECT COALESCE(SUM(total_ttc), 0) FROM quotes WHERE quotes.project_id = projects.id)`,
      })
      .from(projects)
      .where(eq(projects.clientId, id))
      .orderBy(desc(projects.createdAt)),
    db
      .select({
        id: activities.id,
        type: activities.type,
        subject: activities.subject,
        status: activities.status,
        scheduledAt: activities.scheduledAt,
        completedAt: activities.completedAt,
      })
      .from(activities)
      .where(eq(activities.clientId, id))
      .orderBy(desc(activities.scheduledAt))
      .limit(20),
    db
      .select({
        id: tickets.id,
        number: tickets.number,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .where(eq(tickets.clientId, id))
      .orderBy(desc(tickets.createdAt))
      .limit(20),
    db
      .select({
        id: leads.id,
        title: leads.title,
        status: leads.status,
        estimatedValue: leads.estimatedValue,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.clientId, id))
      .orderBy(desc(leads.createdAt)),
  ]);

  // Get all quotes for all projects of this client
  const projectIds = clientProjects.map((p) => p.id);
  const clientQuotes = projectIds.length > 0
    ? await db
        .select({
          id: quotes.id,
          number: quotes.number,
          status: quotes.status,
          totalHT: quotes.totalHT,
          totalTTC: quotes.totalTTC,
          projectId: quotes.projectId,
          projectName: projects.name,
          createdAt: quotes.createdAt,
        })
        .from(quotes)
        .innerJoin(projects, eq(quotes.projectId, projects.id))
        .where(sql`${quotes.projectId} IN (${sql.join(projectIds.map(pid => sql`${pid}`), sql`, `)})`)
        .orderBy(desc(quotes.createdAt))
    : [];

  return c.html(
    <ClientDetailPage
      client={clientData}
      projects={clientProjects}
      quotes={clientQuotes}
      activities={clientActivities}
      tickets={clientTickets}
      leads={clientLeads}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/clients/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [[clientData], clientProjects] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, id)).limit(1),
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.clientId, id))
      .orderBy(desc(projects.createdAt)),
  ]);

  if (!clientData) {
    return c.redirect('/backoffice/clients');
  }

  return c.html(<ClientFormPage clientData={clientData} projects={clientProjects} user={adminUser} />);
});

backofficeRouter.post('/clients/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await db
      .update(clients)
      .set({
        firstName: body.firstName as string,
        lastName: body.lastName as string,
        email: (body.email as string) || null,
        phone: (body.phone as string) || null,
        address: (body.address as string) || null,
        city: (body.city as string) || null,
        postalCode: (body.postalCode as string) || null,
        notes: (body.notes as string) || null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id));

    return c.redirect('/backoffice/clients');
  } catch (error: any) {
    const [clientData] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return c.html(<ClientFormPage clientData={clientData} error={error.message} user={adminUser} />);
  }
});

backofficeRouter.delete('/clients/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(clients).where(eq(clients.id, id));
  return c.text('');
});

// ============ Products ============

backofficeRouter.get('/products', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const search = c.req.query('search');
  const category = c.req.query('category');
  const brand = c.req.query('brand');
  const active = c.req.query('active');

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.reference, `%${search}%`)
      )!
    );
  }

  if (category) {
    conditions.push(eq(products.category, category));
  }

  if (brand) {
    conditions.push(eq(products.brand, brand));
  }

  if (active === 'true') {
    conditions.push(eq(products.isActive, true));
  } else if (active === 'false') {
    conditions.push(eq(products.isActive, false));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [productsList, countResult, categories, brands] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(products.name)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(products).where(where),
    productsService.getCategories(),
    productsService.getBrands(),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return c.html(
    <ProductsListPage
      products={productsList}
      currentPage={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      categories={categories}
      brands={brands.filter((b): b is string => b !== null)}
      search={search}
      category={category}
      brand={brand}
      active={active}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/products/new', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const [categories, suppliersList] = await Promise.all([
    productsService.getCategories(),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
  ]);
  return c.html(<ProductFormPage categories={categories} suppliers={suppliersList} user={adminUser} />);
});

backofficeRouter.post('/products', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    await db.insert(products).values({
      reference: body.reference as string,
      name: body.name as string,
      description: (body.description as string) || undefined,
      category: body.category as string,
      brand: (body.brand as string) || undefined,
      priceHT: body.priceHT as string,
      tvaRate: (body.tvaRate as string) || '20',
      stock: body.stock ? parseInt(body.stock as string, 10) : undefined,
      imageUrl: (body.imageUrl as string) || undefined,
      isActive: body.isActive === 'on',
      purchasePriceHT: (body.purchasePriceHT as string) || null,
      supplierId: (body.supplierId as string) || null,
      supplierProductUrl: (body.supplierProductUrl as string) || null,
    });

    return c.redirect('/backoffice/products');
  } catch (error: any) {
    const [categories, suppliersList] = await Promise.all([
      productsService.getCategories(),
      db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    ]);
    return c.html(<ProductFormPage categories={categories} suppliers={suppliersList} error={error.message} user={adminUser} />);
  }
});

backofficeRouter.get('/products/import', (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  return c.html(<ImportProductsPage user={adminUser} />);
});

backofficeRouter.post('/products/import', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return c.html(<ImportProductsPage result={{ imported: 0, errors: ['Fichier requis'] }} user={adminUser} />);
  }

  const content = await file.text();
  const result = await productsService.importProductsFromCSV(content);

  return c.html(<ImportProductsPage result={result} user={adminUser} />);
});

backofficeRouter.get('/products/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const success = c.req.query('success');

  const [[productData], categories, productWithDeps, allProducts, suppliersList] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).limit(1),
    productsService.getCategories(),
    productsService.getProductWithDependencies(id),
    db.select({ id: products.id, reference: products.reference, name: products.name, brand: products.brand, category: products.category })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
  ]);

  if (!productData) {
    return c.redirect('/backoffice/products');
  }

  const dependencies = productWithDeps.dependencies;
  const dependents = productWithDeps.dependents;

  // Exclure le produit lui-meme et les produits deja en dependance
  const depProductIds = new Set(dependencies.map(d => d.requiredProduct.id));
  const availableProducts = allProducts.filter(p => p.id !== id && !depProductIds.has(p.id));

  return c.html(
    <ProductFormPage
      productData={productData}
      categories={categories}
      suppliers={suppliersList}
      dependencies={dependencies}
      dependents={dependents}
      availableProducts={availableProducts}
      success={success || undefined}
      user={adminUser}
    />
  );
});

backofficeRouter.post('/products/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
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
        tvaRate: (body.tvaRate as string) || '20',
        stock: body.stock ? parseInt(body.stock as string, 10) : null,
        imageUrl: (body.imageUrl as string) || null,
        isActive: body.isActive === 'on',
        purchasePriceHT: (body.purchasePriceHT as string) || null,
        supplierId: (body.supplierId as string) || null,
        supplierProductUrl: (body.supplierProductUrl as string) || null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    return c.redirect('/backoffice/products');
  } catch (error: any) {
    const [[productData], categories, productWithDeps2, allProducts, suppliersList] = await Promise.all([
      db.select().from(products).where(eq(products.id, id)).limit(1),
      productsService.getCategories(),
      productsService.getProductWithDependencies(id),
      db.select({ id: products.id, reference: products.reference, name: products.name, brand: products.brand, category: products.category })
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(products.name),
      db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    ]);

    const dependencies = productWithDeps2.dependencies;
    const dependents = productWithDeps2.dependents;
    const depProductIds = new Set(dependencies.map(d => d.requiredProduct.id));
    const availableProducts = allProducts.filter(p => p.id !== id && !depProductIds.has(p.id));

    return c.html(
      <ProductFormPage
        productData={productData}
        categories={categories}
        suppliers={suppliersList}
        dependencies={dependencies}
        dependents={dependents}
        availableProducts={availableProducts}
        error={error.message}
        user={adminUser}
      />
    );
  }
});

backofficeRouter.delete('/products/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(products).where(eq(products.id, id));
  return c.text('');
});

// ============ Product Dependencies ============

backofficeRouter.post('/products/:id/dependances', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await productsService.addProductDependency(id, {
      requiredProductId: body.requiredProductId as string,
      type: (body.type as 'required' | 'recommended') || 'required',
      description: (body.description as string) || undefined,
    });

    return c.redirect(`/backoffice/products/${id}/edit?success=Dependance ajoutee`);
  } catch (error: any) {
    return c.redirect(`/backoffice/products/${id}/edit`);
  }
});

backofficeRouter.delete('/products/:productId/dependances/:depId', async (c) => {
  const depId = c.req.param('depId');
  await productsService.removeProductDependency(depId);
  return c.text('');
});

// ============ Suppliers ============

backofficeRouter.get('/suppliers', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const search = c.req.query('search');
  const success = c.req.query('success');

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        ilike(suppliers.name, `%${search}%`),
        ilike(suppliers.email, `%${search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [suppliersList, countResult] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        email: suppliers.email,
        phone: suppliers.phone,
        website: suppliers.website,
        isActive: suppliers.isActive,
        createdAt: suppliers.createdAt,
        productCount: sql<number>`(SELECT COUNT(*) FROM products WHERE products.supplier_id = suppliers.id)`,
      })
      .from(suppliers)
      .where(where)
      .orderBy(suppliers.name)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(suppliers).where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return c.html(
    <SuppliersListPage
      suppliers={suppliersList}
      currentPage={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      search={search}
      success={success || undefined}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/suppliers/new', (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  return c.html(<SupplierFormPage user={adminUser} />);
});

backofficeRouter.post('/suppliers', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    await db.insert(suppliers).values({
      name: body.name as string,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      website: (body.website as string) || null,
      notes: (body.notes as string) || null,
      isActive: body.isActive === 'on',
    });

    return c.redirect('/backoffice/suppliers?success=Fournisseur cree');
  } catch (error: any) {
    return c.html(<SupplierFormPage error={error.message} user={adminUser} />);
  }
});

backofficeRouter.get('/suppliers/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const success = c.req.query('success');

  const [[supplierData], supplierProducts] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1),
    db
      .select({
        id: products.id,
        reference: products.reference,
        name: products.name,
        category: products.category,
        priceHT: products.priceHT,
        purchasePriceHT: products.purchasePriceHT,
      })
      .from(products)
      .where(eq(products.supplierId, id))
      .orderBy(products.name),
  ]);

  if (!supplierData) {
    return c.redirect('/backoffice/suppliers');
  }

  return c.html(
    <SupplierFormPage
      supplierData={supplierData}
      products={supplierProducts}
      success={success || undefined}
      user={adminUser}
    />
  );
});

backofficeRouter.post('/suppliers/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await db
      .update(suppliers)
      .set({
        name: body.name as string,
        email: (body.email as string) || null,
        phone: (body.phone as string) || null,
        website: (body.website as string) || null,
        notes: (body.notes as string) || null,
        isActive: body.isActive === 'on',
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, id));

    return c.redirect('/backoffice/suppliers?success=Fournisseur mis a jour');
  } catch (error: any) {
    const [[supplierData], supplierProducts] = await Promise.all([
      db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1),
      db
        .select({
          id: products.id,
          reference: products.reference,
          name: products.name,
          category: products.category,
          priceHT: products.priceHT,
          purchasePriceHT: products.purchasePriceHT,
        })
        .from(products)
        .where(eq(products.supplierId, id))
        .orderBy(products.name),
    ]);

    return c.html(
      <SupplierFormPage
        supplierData={supplierData}
        products={supplierProducts}
        error={error.message}
        user={adminUser}
      />
    );
  }
});

backofficeRouter.delete('/suppliers/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(suppliers).where(eq(suppliers.id, id));
  return c.text('');
});

// ============ Projects ============

backofficeRouter.get('/projects', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const search = c.req.query('search');
  const status = c.req.query('status');
  const integrateur = c.req.query('integrateur');

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(ilike(projects.name, `%${search}%`));
  }

  if (status) {
    conditions.push(eq(projects.status, status as any));
  }

  if (integrateur) {
    conditions.push(eq(projects.userId, integrateur));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [projectsList, countResult, integrateursList] = await Promise.all([
    db
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
        quotesCount: sql<number>`(SELECT COUNT(*) FROM quotes WHERE quotes.project_id = projects.id)`,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .innerJoin(users, eq(projects.userId, users.id))
      .where(where)
      .orderBy(desc(projects.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(projects).where(where),
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.role, 'integrateur')),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return c.html(
    <ProjectsListPage
      projects={projectsList}
      currentPage={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      search={search}
      status={status}
      integrateur={integrateur}
      integrateursList={integrateursList.map((i) => ({
        id: i.id,
        name: `${i.firstName} ${i.lastName}`,
      }))}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/projects/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [projectData] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!projectData) {
    return c.redirect('/backoffice/projects');
  }

  // Fetch all room IDs for this project first
  const roomsList = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      type: rooms.type,
      floor: rooms.floor,
      notes: rooms.notes,
    })
    .from(rooms)
    .where(eq(rooms.projectId, id))
    .orderBy(rooms.name);

  const roomIds = roomsList.map(r => r.id);

  const [clientData, integrateurData, quotesList, photosList, devicesList, checklistList] = await Promise.all([
    db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        address: clients.address,
        city: clients.city,
      })
      .from(clients)
      .where(eq(clients.id, projectData.clientId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, projectData.userId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        id: quotes.id,
        number: quotes.number,
        status: quotes.status,
        totalHT: quotes.totalHT,
        totalTTC: quotes.totalTTC,
        totalCostHT: quotes.totalCostHT,
        totalMarginHT: quotes.totalMarginHT,
        marginPercent: quotes.marginPercent,
        validUntil: quotes.validUntil,
        notes: quotes.notes,
        pdfUrl: quotes.pdfUrl,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .where(eq(quotes.projectId, id))
      .orderBy(desc(quotes.createdAt)),
    // Photos for all rooms in this project
    roomIds.length > 0
      ? db
          .select({
            id: photos.id,
            url: photos.url,
            caption: photos.caption,
            roomId: photos.roomId,
          })
          .from(photos)
          .where(sql`${photos.roomId} IN (${sql.join(roomIds.map(rid => sql`${rid}`), sql`, `)})`)
          .orderBy(photos.createdAt)
      : Promise.resolve([]),
    // Devices for all rooms with product info
    roomIds.length > 0
      ? db
          .select({
            id: devices.id,
            name: devices.name,
            status: devices.status,
            isOnline: devices.isOnline,
            location: devices.location,
            notes: devices.notes,
            productName: products.name,
            productCategory: products.category,
            roomId: devices.roomId,
          })
          .from(devices)
          .leftJoin(products, eq(devices.productId, products.id))
          .where(sql`${devices.roomId} IN (${sql.join(roomIds.map(rid => sql`${rid}`), sql`, `)})`)
          .orderBy(devices.name)
      : Promise.resolve([]),
    // Checklist items for all rooms
    roomIds.length > 0
      ? db
          .select({
            id: checklistItems.id,
            category: checklistItems.category,
            label: checklistItems.label,
            checked: checklistItems.checked,
            notes: checklistItems.notes,
            roomId: checklistItems.roomId,
          })
          .from(checklistItems)
          .where(sql`${checklistItems.roomId} IN (${sql.join(roomIds.map(rid => sql`${rid}`), sql`, `)})`)
          .orderBy(checklistItems.category, checklistItems.label)
      : Promise.resolve([]),
  ]);

  if (!clientData || !integrateurData) {
    return c.redirect('/backoffice/projects');
  }

  return c.html(
    <ProjectDetailPage
      project={projectData}
      client={clientData}
      integrateur={integrateurData}
      rooms={roomsList}
      photos={photosList}
      devices={devicesList}
      checklist={checklistList}
      quotes={await Promise.all(quotesList.map(async (q) => {
        const lines = await db
          .select({
            id: quoteLines.id,
            description: quoteLines.description,
            quantity: quoteLines.quantity,
            unitPriceHT: quoteLines.unitPriceHT,
            tvaRate: quoteLines.tvaRate,
            totalHT: quoteLines.totalHT,
            unitCostHT: quoteLines.unitCostHT,
            clientOwned: quoteLines.clientOwned,
            productName: products.name,
          })
          .from(quoteLines)
          .leftJoin(products, eq(quoteLines.productId, products.id))
          .where(eq(quoteLines.quoteId, q.id))
          .orderBy(quoteLines.sortOrder);
        return { ...q, lines };
      }))}
      user={adminUser}
    />
  );
});

// ============ CRM Pipeline ============

// Helper to get commercials (users with commercial or admin role)
async function getCommercials() {
  // Get users who have commercial or admin roles
  const commercialUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(or(eq(users.role, 'admin'), eq(users.role, 'integrateur')))
    .orderBy(users.firstName);

  return commercialUsers;
}

// Create a mock JWT payload for backoffice admin
function createAdminPayload(adminUser: AdminUser) {
  return {
    userId: adminUser.id,
    email: adminUser.email,
    role: adminUser.role as 'admin',
    roles: ['admin'] as ('admin' | 'integrateur' | 'auditeur' | 'commercial')[],
  };
}

backofficeRouter.get('/crm/pipeline', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const search = c.req.query('search');
  const source = c.req.query('source');

  // Lead conditions
  const leadConditions: SQL[] = [];
  leadConditions.push(sql`${leads.status} NOT IN ('gagne', 'perdu')`);

  if (search) {
    leadConditions.push(
      or(
        ilike(leads.firstName, `%${search}%`),
        ilike(leads.lastName, `%${search}%`),
        ilike(leads.email, `%${search}%`),
        ilike(leads.company, `%${search}%`),
        ilike(leads.title, `%${search}%`)
      )!
    );
  }

  if (source) {
    leadConditions.push(eq(leads.source, source as any));
  }

  const leadWhere = and(...leadConditions);

  // Project conditions (search also applies to projects)
  const projectConditions: SQL[] = [];
  projectConditions.push(sql`${projects.status} NOT IN ('archive')`);
  if (search) {
    projectConditions.push(
      or(
        ilike(projects.name, `%${search}%`),
        ilike(clients.firstName, `%${search}%`),
        ilike(clients.lastName, `%${search}%`)
      )!
    );
  }
  const projectWhere = and(...projectConditions);

  // Fetch leads, stats, and projects in parallel
  const [leadsList, leadStats, projectsList, projectCounts] = await Promise.all([
    db.select().from(leads).where(leadWhere).orderBy(desc(leads.updatedAt)).limit(100),
    db
      .select({
        status: leads.status,
        count: count(),
        totalValue: sql<string>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
        weightedValue: sql<string>`COALESCE(SUM(${leads.estimatedValue} * ${leads.probability} / 100), 0)`,
      })
      .from(leads)
      .groupBy(leads.status),
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        totalTTC: sql<string>`COALESCE((SELECT SUM(total_ttc) FROM quotes WHERE quotes.project_id = ${projects.id} AND quotes.status = 'accepte'), '0')`,
        convertedProjectId: sql<string>`(SELECT converted_project_id FROM leads WHERE leads.converted_project_id = ${projects.id} LIMIT 1)`,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(projectWhere)
      .orderBy(desc(projects.updatedAt))
      .limit(100),
    db
      .select({
        status: projects.status,
        count: count(),
      })
      .from(projects)
      .where(sql`${projects.status} NOT IN ('archive')`)
      .groupBy(projects.status),
  ]);

  // Format projects for the page
  const projectCards = projectsList.map((p: any) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    clientName: `${p.clientFirstName} ${p.clientLastName}`,
    totalTTC: p.totalTTC !== '0' ? p.totalTTC : null,
    createdAt: p.createdAt,
    fromLead: !!p.convertedProjectId,
  }));

  const projectStats = { brouillon: 0, en_cours: 0, termine: 0 };
  for (const pc of projectCounts) {
    if (pc.status in projectStats) {
      (projectStats as any)[pc.status] = pc.count;
    }
  }

  return c.html(
    <PipelinePage
      leads={leadsList}
      projects={projectCards}
      stats={leadStats}
      projectStats={projectStats}
      search={search}
      source={source}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/crm/leads/new', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const commercials = await getCommercials();

  return c.html(
    <LeadFormPage
      commercials={commercials}
      isEdit={false}
      user={adminUser}
    />
  );
});

backofficeRouter.post('/crm/leads', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    await db.insert(leads).values({
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      company: (body.company as string) || null,
      title: body.title as string,
      description: (body.description as string) || null,
      status: (body.status as any) || 'prospect',
      source: (body.source as any) || 'autre',
      estimatedValue: (body.estimatedValue as string) || null,
      probability: body.probability ? parseInt(body.probability as string, 10) : 0,
      ownerId: body.ownerId as string,
      address: (body.address as string) || null,
      city: (body.city as string) || null,
      postalCode: (body.postalCode as string) || null,
      surface: (body.surface as string) || null,
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate as string) : null,
    });

    return c.redirect('/backoffice/crm/pipeline');
  } catch (error: any) {
    const commercials = await getCommercials();
    return c.html(
      <LeadFormPage commercials={commercials} isEdit={false} error={error.message} user={adminUser} />
    );
  }
});

backofficeRouter.get('/crm/leads/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    return c.redirect('/backoffice/crm/pipeline');
  }

  const [leadActivities, history] = await Promise.all([
    db.select().from(activities).where(eq(activities.leadId, id)).orderBy(desc(activities.createdAt)).limit(20),
    db.select().from(leadStageHistory).where(eq(leadStageHistory.leadId, id)).orderBy(desc(leadStageHistory.changedAt)),
  ]);

  return c.html(
    <LeadDetailPage
      lead={{ ...lead, activities: leadActivities, stageHistory: history }}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/crm/leads/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [[lead], commercials] = await Promise.all([
    db.select().from(leads).where(eq(leads.id, id)).limit(1),
    getCommercials(),
  ]);

  if (!lead) {
    return c.redirect('/backoffice/crm/pipeline');
  }

  return c.html(
    <LeadFormPage lead={lead} commercials={commercials} isEdit={true} user={adminUser} />
  );
});

backofficeRouter.post('/crm/leads/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await db
      .update(leads)
      .set({
        firstName: body.firstName as string,
        lastName: body.lastName as string,
        email: (body.email as string) || null,
        phone: (body.phone as string) || null,
        company: (body.company as string) || null,
        title: body.title as string,
        description: (body.description as string) || null,
        status: (body.status as any) || 'prospect',
        source: (body.source as any) || 'autre',
        estimatedValue: (body.estimatedValue as string) || null,
        probability: body.probability ? parseInt(body.probability as string, 10) : 0,
        ownerId: body.ownerId as string,
        address: (body.address as string) || null,
        city: (body.city as string) || null,
        postalCode: (body.postalCode as string) || null,
        surface: (body.surface as string) || null,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate as string) : null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));

    return c.redirect(`/backoffice/crm/leads/${id}`);
  } catch (error: any) {
    const [[lead], commercials] = await Promise.all([
      db.select().from(leads).where(eq(leads.id, id)).limit(1),
      getCommercials(),
    ]);
    return c.html(
      <LeadFormPage lead={lead} commercials={commercials} isEdit={true} error={error.message} user={adminUser} />
    );
  }
});

backofficeRouter.post('/crm/leads/:id/status', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    return c.redirect('/backoffice/crm/pipeline');
  }

  const newStatus = body.status as string;
  const notes = body.notes as string;
  const lostReason = body.lostReason as string;

  await db
    .update(leads)
    .set({
      status: newStatus as any,
      lostReason: newStatus === 'perdu' ? lostReason : lead.lostReason,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));

  await db.insert(leadStageHistory).values({
    leadId: id,
    fromStatus: lead.status,
    toStatus: newStatus as any,
    changedBy: adminUser.id,
    notes: notes || null,
  });

  return c.redirect(`/backoffice/crm/leads/${id}`);
});

backofficeRouter.post('/crm/leads/:id/convert', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    const payload = createAdminPayload(adminUser);
    await leadsService.convertLead(id, {
      projectName: (body.projectName as string) || undefined,
      createClient: body.createClient === 'on',
    }, payload);

    return c.redirect(`/backoffice/crm/leads/${id}`);
  } catch (error: any) {
    return c.redirect(`/backoffice/crm/leads/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.delete('/crm/leads/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(leads).where(eq(leads.id, id));
  return c.text('');
});

// ============ CRM KPIs ============

backofficeRouter.get('/crm/kpis', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const payload = createAdminPayload(adminUser);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [dashboard, pipeline, conversions, activityMetrics, objectives] = await Promise.all([
    kpisService.getDashboardData(payload, {}),
    kpisService.getPipelineAnalysis(payload, {}),
    kpisService.getConversionStats(payload, {}),
    kpisService.getActivityMetrics(payload, {}),
    kpisService.getObjectives(payload, { year: currentYear, month: currentMonth }),
  ]);

  let currentObjective: Awaited<ReturnType<typeof kpisService.getObjectiveWithProgress>> | undefined = undefined;
  if (objectives.length > 0 && objectives[0]) {
    currentObjective = await kpisService.getObjectiveWithProgress(objectives[0].id, payload);
  }

  return c.html(
    <KPIsDashboardPage
      dashboard={dashboard}
      pipeline={pipeline}
      conversions={conversions}
      activityMetrics={activityMetrics}
      currentObjective={currentObjective}
      user={adminUser}
    />
  );
});

// ============ Activities ============

backofficeRouter.get('/activities', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const type = c.req.query('type');
  const status = c.req.query('status');
  const search = c.req.query('search');

  const conditions: SQL[] = [];

  if (type) {
    conditions.push(eq(activities.type, type as any));
  }

  if (status) {
    conditions.push(eq(activities.status, status as any));
  }

  if (search) {
    conditions.push(
      or(ilike(activities.subject, `%${search}%`), ilike(activities.description, `%${search}%`))!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [activitiesList, countResult] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(where)
      .orderBy(desc(activities.scheduledAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(activities).where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return c.html(
    <ActivitiesListPage
      activities={activitiesList}
      currentPage={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      type={type}
      status={status}
      search={search}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/activities/new', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const preselectedLeadId = c.req.query('leadId');
  const preselectedClientId = c.req.query('clientId');
  const preselectedProjectId = c.req.query('projectId');

  const [leadsList, clientsList, projectsList, usersList] = await Promise.all([
    db.select({ id: leads.id, title: leads.title, firstName: leads.firstName, lastName: leads.lastName }).from(leads).where(sql`${leads.status} NOT IN ('gagne', 'perdu')`).orderBy(desc(leads.createdAt)).limit(50),
    db.select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName }).from(clients).orderBy(clients.lastName).limit(100),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(desc(projects.createdAt)).limit(50),
    getCommercials(),
  ]);

  return c.html(
    <ActivityFormPage
      leads={leadsList}
      clients={clientsList}
      projects={projectsList}
      users={usersList}
      isEdit={false}
      preselectedLeadId={preselectedLeadId}
      preselectedClientId={preselectedClientId}
      preselectedProjectId={preselectedProjectId}
      user={adminUser}
    />
  );
});

backofficeRouter.post('/activities', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    await db.insert(activities).values({
      leadId: (body.leadId as string) || null,
      clientId: (body.clientId as string) || null,
      projectId: (body.projectId as string) || null,
      type: body.type as any,
      subject: body.subject as string,
      description: (body.description as string) || null,
      status: (body.status as any) || 'planifie',
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as string) : null,
      duration: body.duration ? parseInt(body.duration as string, 10) : null,
      reminderAt: body.reminderAt ? new Date(body.reminderAt as string) : null,
      ownerId: body.ownerId as string,
    });

    return c.redirect('/backoffice/activities');
  } catch (error: any) {
    const [leadsList, clientsList, projectsList, usersList] = await Promise.all([
      db.select({ id: leads.id, title: leads.title, firstName: leads.firstName, lastName: leads.lastName }).from(leads).limit(50),
      db.select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName }).from(clients).limit(100),
      db.select({ id: projects.id, name: projects.name }).from(projects).limit(50),
      getCommercials(),
    ]);
    return c.html(
      <ActivityFormPage leads={leadsList} clients={clientsList} projects={projectsList} users={usersList} isEdit={false} error={error.message} user={adminUser} />
    );
  }
});

backofficeRouter.get('/activities/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [[activity], leadsList, clientsList, projectsList, usersList] = await Promise.all([
    db.select().from(activities).where(eq(activities.id, id)).limit(1),
    db.select({ id: leads.id, title: leads.title, firstName: leads.firstName, lastName: leads.lastName }).from(leads).limit(50),
    db.select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName }).from(clients).limit(100),
    db.select({ id: projects.id, name: projects.name }).from(projects).limit(50),
    getCommercials(),
  ]);

  if (!activity) {
    return c.redirect('/backoffice/activities');
  }

  return c.html(
    <ActivityFormPage activity={activity} leads={leadsList} clients={clientsList} projects={projectsList} users={usersList} isEdit={true} user={adminUser} />
  );
});

backofficeRouter.post('/activities/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await db
      .update(activities)
      .set({
        leadId: (body.leadId as string) || null,
        clientId: (body.clientId as string) || null,
        projectId: (body.projectId as string) || null,
        type: body.type as any,
        subject: body.subject as string,
        description: (body.description as string) || null,
        status: (body.status as any) || 'planifie',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as string) : null,
        duration: body.duration ? parseInt(body.duration as string, 10) : null,
        reminderAt: body.reminderAt ? new Date(body.reminderAt as string) : null,
        ownerId: body.ownerId as string,
        updatedAt: new Date(),
      })
      .where(eq(activities.id, id));

    return c.redirect('/backoffice/activities');
  } catch (error: any) {
    const [[activity], leadsList, clientsList, projectsList, usersList] = await Promise.all([
      db.select().from(activities).where(eq(activities.id, id)).limit(1),
      db.select({ id: leads.id, title: leads.title, firstName: leads.firstName, lastName: leads.lastName }).from(leads).limit(50),
      db.select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName }).from(clients).limit(100),
      db.select({ id: projects.id, name: projects.name }).from(projects).limit(50),
      getCommercials(),
    ]);
    return c.html(
      <ActivityFormPage activity={activity} leads={leadsList} clients={clientsList} projects={projectsList} users={usersList} isEdit={true} error={error.message} user={adminUser} />
    );
  }
});

backofficeRouter.post('/activities/:id/complete', async (c) => {
  const id = c.req.param('id');

  await db
    .update(activities)
    .set({
      status: 'termine',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activities.id, id));

  return c.redirect('/backoffice/activities');
});

backofficeRouter.delete('/activities/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(activities).where(eq(activities.id, id));
  return c.text('');
});

// ============ Objectives ============

backofficeRouter.get('/objectives', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : new Date().getFullYear();

  const objectivesList = await db
    .select({
      id: salesObjectives.id,
      userId: salesObjectives.userId,
      year: salesObjectives.year,
      month: salesObjectives.month,
      quarter: salesObjectives.quarter,
      revenueTarget: salesObjectives.revenueTarget,
      leadsTarget: salesObjectives.leadsTarget,
      conversionsTarget: salesObjectives.conversionsTarget,
      activitiesTarget: salesObjectives.activitiesTarget,
      createdAt: salesObjectives.createdAt,
      userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
    })
    .from(salesObjectives)
    .innerJoin(users, eq(salesObjectives.userId, users.id))
    .where(eq(salesObjectives.year, year))
    .orderBy(salesObjectives.month, users.lastName);

  return c.html(
    <ObjectivesListPage
      objectives={objectivesList}
      year={year}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/objectives/new', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const commercials = await getCommercials();

  return c.html(
    <ObjectiveFormPage commercials={commercials} isEdit={false} user={adminUser} />
  );
});

backofficeRouter.post('/objectives', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    await db.insert(salesObjectives).values({
      userId: body.userId as string,
      year: parseInt(body.year as string, 10),
      month: body.month ? parseInt(body.month as string, 10) : null,
      quarter: body.quarter ? parseInt(body.quarter as string, 10) : null,
      revenueTarget: (body.revenueTarget as string) || null,
      leadsTarget: body.leadsTarget ? parseInt(body.leadsTarget as string, 10) : null,
      conversionsTarget: body.conversionsTarget ? parseInt(body.conversionsTarget as string, 10) : null,
      activitiesTarget: body.activitiesTarget ? parseInt(body.activitiesTarget as string, 10) : null,
    });

    return c.redirect('/backoffice/objectives');
  } catch (error: any) {
    const commercials = await getCommercials();
    return c.html(
      <ObjectiveFormPage commercials={commercials} isEdit={false} error={error.message} user={adminUser} />
    );
  }
});

backofficeRouter.get('/objectives/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');

  const [[objective], commercials] = await Promise.all([
    db.select().from(salesObjectives).where(eq(salesObjectives.id, id)).limit(1),
    getCommercials(),
  ]);

  if (!objective) {
    return c.redirect('/backoffice/objectives');
  }

  return c.html(
    <ObjectiveFormPage objective={objective} commercials={commercials} isEdit={true} user={adminUser} />
  );
});

backofficeRouter.post('/objectives/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await db
      .update(salesObjectives)
      .set({
        userId: body.userId as string,
        year: parseInt(body.year as string, 10),
        month: body.month ? parseInt(body.month as string, 10) : null,
        quarter: body.quarter ? parseInt(body.quarter as string, 10) : null,
        revenueTarget: (body.revenueTarget as string) || null,
        leadsTarget: body.leadsTarget ? parseInt(body.leadsTarget as string, 10) : null,
        conversionsTarget: body.conversionsTarget ? parseInt(body.conversionsTarget as string, 10) : null,
        activitiesTarget: body.activitiesTarget ? parseInt(body.activitiesTarget as string, 10) : null,
        updatedAt: new Date(),
      })
      .where(eq(salesObjectives.id, id));

    return c.redirect('/backoffice/objectives');
  } catch (error: any) {
    const [[objective], commercials] = await Promise.all([
      db.select().from(salesObjectives).where(eq(salesObjectives.id, id)).limit(1),
      getCommercials(),
    ]);
    return c.html(
      <ObjectiveFormPage objective={objective} commercials={commercials} isEdit={true} error={error.message} user={adminUser} />
    );
  }
});

backofficeRouter.delete('/objectives/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(salesObjectives).where(eq(salesObjectives.id, id));
  return c.text('');
});

// ============ Support Dashboard ============

backofficeRouter.get('/support', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const stats = await ticketsService.getTicketStats();

  // Get recent tickets
  const recentResult = await ticketsService.getTickets({ page: 1, limit: 10 }, {});
  const recentTickets = recentResult.data.map((t: any) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    clientName: t.client ? `${t.client.firstName} ${t.client.lastName}` : '-',
    createdAt: t.createdAt,
  }));

  // Transform stats to match page props
  const ticketsByStatus: Record<string, number> = {};
  for (const s of stats.byStatus) ticketsByStatus[s.status] = s.total;
  const ticketsByPriority: Record<string, number> = {};
  for (const p of stats.byPriority) ticketsByPriority[p.priority] = p.total;

  const dashboardStats = {
    openTickets: stats.totalOpen,
    unassignedTickets: 0,
    slaBreached: stats.slaBreached,
    avgResponseMinutes: 0,
    avgResolutionMinutes: stats.avgResolutionHours ? Math.round(stats.avgResolutionHours * 60) : 0,
    satisfactionAvg: 0,
    ticketsByStatus,
    ticketsByPriority,
  };

  return c.html(
    <SupportDashboardPage stats={dashboardStats} recentTickets={recentTickets} user={adminUser} />
  );
});

// ============ Support Tickets ============

backofficeRouter.get('/support/tickets', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1');
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const assignedToId = c.req.query('assignedToId');
  const slaBreached = c.req.query('slaBreached');
  const search = c.req.query('search');

  const filters: any = {};
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (assignedToId) filters.assignedToId = assignedToId;
  if (slaBreached) filters.slaBreached = slaBreached === 'true';
  if (search) filters.search = search;

  const result = await ticketsService.getTickets({ page, limit: PAGE_SIZE }, filters);

  // Get assignees for filter dropdown
  const assignees = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.isActive, true));

  const ticketsList = result.data.map((t: any) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    source: t.source,
    slaBreached: t.slaBreached,
    clientName: t.client ? `${t.client.firstName} ${t.client.lastName}` : '-',
    assigneeName: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : null,
    categoryName: t.category?.name || null,
    createdAt: t.createdAt,
  }));

  const success = c.req.query('success');
  const error = c.req.query('error');

  return c.html(
    <TicketsListPage
      tickets={ticketsList}
      currentPage={page}
      totalPages={result.meta.totalPages}
      totalItems={result.meta.total}
      pageSize={PAGE_SIZE}
      filters={{ status, priority, assignedToId, slaBreached, search }}
      assignees={assignees.map(a => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }))}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/support/tickets/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const success = c.req.query('success');
  const error = c.req.query('error');

  const ticketData = await ticketsService.getTicketById(id);
  // ticketData has: ticket fields + comments + history
  // We need to format them for the page props

  // Get assignees for action dropdown
  const assignees = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.isActive, true));

  // Get canned responses
  const cannedResponsesList = await ticketsService.getCannedResponses();

  // Get chat transcript if ticket has chatSessionId
  let chatTranscript = null;
  if (ticketData.chatSessionId) {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, ticketData.chatSessionId))
      .orderBy(chatMessages.createdAt);
    chatTranscript = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      createdAt: m.createdAt,
    }));
  }

  // Format ticket for page
  const ticket = {
    id: ticketData.id,
    number: ticketData.number,
    title: ticketData.title,
    description: ticketData.description,
    status: ticketData.status,
    priority: ticketData.priority,
    source: ticketData.source,
    slaBreached: ticketData.slaBreached,
    escalationLevel: ticketData.escalationLevel,
    tags: ticketData.tags,
    aiDiagnosis: ticketData.aiDiagnosis,
    troubleshootingSteps: ticketData.troubleshootingSteps,
    satisfactionRating: ticketData.satisfactionRating,
    satisfactionComment: ticketData.satisfactionComment,
    firstResponseDueAt: ticketData.firstResponseDueAt,
    resolutionDueAt: ticketData.resolutionDueAt,
    resolvedAt: ticketData.resolvedAt,
    closedAt: ticketData.closedAt,
    createdAt: ticketData.createdAt,
    clientName: ticketData.client ? `${ticketData.client.firstName} ${ticketData.client.lastName}` : '-',
    clientEmail: ticketData.client?.email || '-',
    projectName: null,
    deviceName: null,
    roomName: null,
    assigneeName: ticketData.assignedTo ? `${ticketData.assignedTo.firstName} ${ticketData.assignedTo.lastName}` : null,
    assigneeId: (ticketData.assignedTo as any)?.id || null,
    categoryName: ticketData.category?.name || null,
    chatSessionId: ticketData.chatSessionId,
  };

  // Format comments
  const comments = (ticketData.comments || []).map((c: any) => ({
    id: c.id,
    authorType: c.authorType,
    authorId: c.authorId,
    type: c.type,
    content: c.content,
    authorName: c.authorType === 'ai' ? 'Assistant IA' : (c.authorType === 'client' ? 'Client' : 'Staff'),
    createdAt: c.createdAt,
  }));

  // Format history
  const history = (ticketData.history || []).map((h: any) => ({
    id: h.id,
    changeType: h.changeType,
    field: h.field,
    oldValue: h.oldValue,
    newValue: h.newValue,
    changedByName: h.changedByType === 'ai' ? 'IA' : 'Staff',
    createdAt: h.createdAt,
  }));

  return c.html(
    <TicketDetailPage
      ticket={ticket}
      comments={comments}
      history={history}
      assignees={assignees.map(a => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }))}
      cannedResponses={cannedResponsesList.map((cr: any) => ({ id: cr.id, title: cr.title, content: cr.content }))}
      chatTranscript={chatTranscript}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

// Ticket actions (POST forms from detail page)
backofficeRouter.post('/support/tickets/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const adminUser = c.get('adminUser') as AdminUser;
  try {
    await ticketsService.changeStatus(id, body.status as string, adminUser.id, body.notes as string);
    return c.redirect(`/backoffice/support/tickets/${id}?success=Statut mis à jour`);
  } catch (error: any) {
    return c.redirect(`/backoffice/support/tickets/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.post('/support/tickets/:id/assign', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const adminUser = c.get('adminUser') as AdminUser;
  try {
    await ticketsService.assignTicket(id, (body.assignedToId as string) || null, adminUser.id);
    return c.redirect(`/backoffice/support/tickets/${id}?success=Ticket assigné`);
  } catch (error: any) {
    return c.redirect(`/backoffice/support/tickets/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.post('/support/tickets/:id/escalate', async (c) => {
  const id = c.req.param('id');
  const adminUser = c.get('adminUser') as AdminUser;
  try {
    await ticketsService.escalateTicket(id, adminUser.id);
    return c.redirect(`/backoffice/support/tickets/${id}?success=Ticket escaladé`);
  } catch (error: any) {
    return c.redirect(`/backoffice/support/tickets/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.post('/support/tickets/:id/comments', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const adminUser = c.get('adminUser') as AdminUser;
  try {
    await ticketsService.addComment(
      id,
      { content: body.content as string, type: (body.type as any) || 'public' },
      adminUser.id,
      'staff'
    );
    return c.redirect(`/backoffice/support/tickets/${id}?success=Commentaire ajouté`);
  } catch (error: any) {
    return c.redirect(`/backoffice/support/tickets/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

// ============ Knowledge Base ============

backofficeRouter.get('/support/kb', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1');
  const status = c.req.query('status');
  const search = c.req.query('search');
  const success = c.req.query('success');
  const error = c.req.query('error');

  const filters: any = {};
  if (status) filters.status = status;
  if (search) filters.search = search;

  const result = await kbService.getArticles({ page, limit: PAGE_SIZE }, filters);

  const articles = result.data.map((a: any) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    status: a.status,
    categoryName: a.category?.name || null,
    viewCount: a.viewCount,
    version: a.version,
    updatedAt: a.updatedAt,
  }));

  return c.html(
    <KBListPage
      articles={articles}
      currentPage={page}
      totalPages={result.meta.totalPages}
      totalItems={result.meta.total}
      pageSize={PAGE_SIZE}
      filters={{ status, search }}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/support/kb/articles/new', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const categories = await kbService.getCategories();
  return c.html(
    <KBFormPage categories={categories.map((cat: any) => ({ id: cat.id, name: cat.name }))} user={adminUser} />
  );
});

backofficeRouter.post('/support/kb/articles', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();
  try {
    const tags = (body.tags as string) ? (body.tags as string).split(',').map(t => t.trim()).filter(Boolean) : undefined;
    await kbService.createArticle({
      title: body.title as string,
      slug: body.slug as string,
      categoryId: (body.categoryId as string) || undefined,
      content: body.content as string,
      excerpt: (body.excerpt as string) || undefined,
      tags,
      status: (body.status as any) || 'brouillon',
    }, adminUser.id);
    return c.redirect('/backoffice/support/kb?success=Article créé');
  } catch (error: any) {
    const categories = await kbService.getCategories();
    return c.html(
      <KBFormPage
        categories={categories.map((cat: any) => ({ id: cat.id, name: cat.name }))}
        error={error.message}
        user={adminUser}
      />
    );
  }
});

backofficeRouter.get('/support/kb/articles/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const [article, categories] = await Promise.all([
    kbService.getArticleById(id),
    kbService.getCategories(),
  ]);
  return c.html(
    <KBFormPage
      article={{
        id: article.id,
        title: article.title,
        slug: article.slug,
        categoryId: article.categoryId,
        content: article.content,
        excerpt: article.excerpt,
        tags: article.tags,
        status: article.status,
      }}
      categories={categories.map((cat: any) => ({ id: cat.id, name: cat.name }))}
      user={adminUser}
    />
  );
});

backofficeRouter.post('/support/kb/articles/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  try {
    const tags = (body.tags as string) ? (body.tags as string).split(',').map(t => t.trim()).filter(Boolean) : undefined;
    await kbService.updateArticle(id, {
      title: body.title as string,
      slug: body.slug as string,
      categoryId: (body.categoryId as string) || undefined,
      content: body.content as string,
      excerpt: (body.excerpt as string) || undefined,
      tags,
      status: (body.status as any) || undefined,
    }, adminUser.id);
    return c.redirect('/backoffice/support/kb?success=Article mis à jour');
  } catch (error: any) {
    const [article, categories] = await Promise.all([
      kbService.getArticleById(id),
      kbService.getCategories(),
    ]);
    return c.html(
      <KBFormPage
        article={article as any}
        categories={categories.map((cat: any) => ({ id: cat.id, name: cat.name }))}
        error={error.message}
        user={adminUser}
      />
    );
  }
});

backofficeRouter.delete('/support/kb/articles/:id', async (c) => {
  const id = c.req.param('id');
  await kbService.deleteArticle(id);
  return c.text('');
});

// ============ FAQ ============

backofficeRouter.get('/support/faq', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const success = c.req.query('success');
  const error = c.req.query('error');

  const items = await kbService.getFaqItems();
  const categories = await kbService.getCategories();

  const faqList = items.map((f: any) => ({
    id: f.id,
    question: f.question,
    answer: f.answer,
    isPublished: f.isPublished,
    sortOrder: f.sortOrder,
    categoryName: null, // Would need join - keeping simple
  }));

  return c.html(
    <FAQListPage items={faqList} success={success} error={error} user={adminUser} />
  );
});

backofficeRouter.get('/support/faq/new', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const categories = await kbService.getCategories();
  return c.html(
    <FAQFormPage categories={categories.map((cat: any) => ({ id: cat.id, name: cat.name }))} user={adminUser} />
  );
});

backofficeRouter.post('/support/faq', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();
  try {
    await kbService.createFaq({
      question: body.question as string,
      answer: body.answer as string,
      categoryId: (body.categoryId as string) || undefined,
      sortOrder: parseInt(body.sortOrder as string) || 0,
      isPublished: body.isPublished === 'on',
    });
    return c.redirect('/backoffice/support/faq?success=FAQ créée');
  } catch (error: any) {
    const categories = await kbService.getCategories();
    return c.html(
      <FAQFormPage categories={categories.map((cat: any) => ({ id: cat.id, name: cat.name }))} error={error.message} user={adminUser} />
    );
  }
});

backofficeRouter.get('/support/faq/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const [faqResult, categories] = await Promise.all([
    db.select().from(faqItems).where(eq(faqItems.id, id)).limit(1),
    kbService.getCategories(),
  ]);
  const faq = faqResult[0];
  if (!faq) return c.redirect('/backoffice/support/faq?error=FAQ non trouvée');
  return c.html(
    <FAQFormPage
      faq={{
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        categoryId: faq.categoryId,
        sortOrder: faq.sortOrder ?? 0,
        isPublished: faq.isPublished,
      }}
      categories={categories.map((cat: any) => ({ id: cat.id, name: cat.name }))}
      user={adminUser}
    />
  );
});

backofficeRouter.post('/support/faq/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  try {
    await kbService.updateFaq(id, {
      question: body.question as string,
      answer: body.answer as string,
      categoryId: (body.categoryId as string) || undefined,
      sortOrder: parseInt(body.sortOrder as string) || 0,
      isPublished: body.isPublished === 'on',
    });
    return c.redirect('/backoffice/support/faq?success=FAQ mise à jour');
  } catch (error: any) {
    return c.redirect(`/backoffice/support/faq/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.delete('/support/faq/:id', async (c) => {
  const id = c.req.param('id');
  await kbService.deleteFaq(id);
  return c.text('');
});

// ============ Support Settings ============

backofficeRouter.get('/support/settings', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const success = c.req.query('success');
  const error = c.req.query('error');

  const [slaList, categoriesList, cannedList] = await Promise.all([
    ticketsService.getSlaDefinitions(),
    ticketsService.getTicketCategories(),
    ticketsService.getCannedResponses(),
  ]);

  return c.html(
    <SupportSettingsPage
      slaDefinitions={slaList.map((s: any) => ({
        id: s.id,
        name: s.name,
        priority: s.priority,
        categoryName: null,
        firstResponseMinutes: s.firstResponseMinutes,
        resolutionMinutes: s.resolutionMinutes,
        isDefault: s.isDefault,
        isActive: s.isActive,
      }))}
      ticketCategories={categoriesList.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        isActive: c.isActive,
        sortOrder: c.sortOrder ?? 0,
      }))}
      cannedResponses={cannedList.map((r: any) => ({
        id: r.id,
        title: r.title,
        shortcut: r.shortcut,
        isActive: r.isActive,
      }))}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

// SLA CRUD
backofficeRouter.post('/support/settings/sla', async (c) => {
  const body = await c.req.parseBody();
  try {
    await ticketsService.createSla({
      name: body.name as string,
      priority: (body.priority as any) || undefined,
      categoryId: (body.categoryId as string) || undefined,
      firstResponseMinutes: parseInt(body.firstResponseMinutes as string),
      resolutionMinutes: parseInt(body.resolutionMinutes as string),
      isDefault: body.isDefault === 'on',
    });
    return c.redirect('/backoffice/support/settings?success=SLA créée');
  } catch (error: any) {
    return c.redirect(`/backoffice/support/settings?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.delete('/support/settings/sla/:id', async (c) => {
  const id = c.req.param('id');
  await ticketsService.deleteSla(id);
  return c.text('');
});

// Ticket Categories CRUD
backofficeRouter.post('/support/settings/categories', async (c) => {
  const body = await c.req.parseBody();
  try {
    await ticketsService.createTicketCategory({
      name: body.name as string,
      slug: body.slug as string,
      description: (body.description as string) || undefined,
      sortOrder: parseInt(body.sortOrder as string) || 0,
    });
    return c.redirect('/backoffice/support/settings?success=Catégorie créée');
  } catch (error: any) {
    return c.redirect(`/backoffice/support/settings?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.delete('/support/settings/categories/:id', async (c) => {
  const id = c.req.param('id');
  await ticketsService.deleteTicketCategory(id);
  return c.text('');
});

// Canned Responses CRUD
backofficeRouter.post('/support/settings/canned-responses', async (c) => {
  const body = await c.req.parseBody();
  try {
    await ticketsService.createCannedResponse({
      title: body.title as string,
      content: body.content as string,
      shortcut: (body.shortcut as string) || undefined,
    });
    return c.redirect('/backoffice/support/settings?success=Réponse type créée');
  } catch (error: any) {
    return c.redirect(`/backoffice/support/settings?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.delete('/support/settings/canned-responses/:id', async (c) => {
  const id = c.req.param('id');
  await ticketsService.deleteCannedResponse(id);
  return c.text('');
});

// ============ Orders ============

backofficeRouter.get('/orders', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const search = c.req.query('search');
  const status = c.req.query('status');
  const success = c.req.query('success');
  const error = c.req.query('error');

  const conditions: SQL[] = [];

  if (status) {
    conditions.push(eq(orders.status, status as any));
  }

  if (search) {
    conditions.push(
      or(
        ilike(orders.number, `%${search}%`),
        ilike(clients.firstName, `%${search}%`),
        ilike(clients.lastName, `%${search}%`)
      )!
    );
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
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(orders).where(where ? and(where) : undefined),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return c.html(
    <OrdersListPage
      orders={ordersList}
      currentPage={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={PAGE_SIZE}
      search={search}
      status={status}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/orders/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const success = c.req.query('success');
  const error = c.req.query('error');

  try {
    const order = await ordersService.getOrderById(id);
    return c.html(
      <OrderDetailPage order={order as any} success={success} error={error} user={adminUser} />
    );
  } catch {
    return c.redirect('/backoffice/orders');
  }
});

backofficeRouter.get('/orders/:id/edit', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const success = c.req.query('success');
  const error = c.req.query('error');

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

  if (!order) {
    return c.redirect('/backoffice/orders');
  }

  return c.html(
    <OrderFormPage order={order as any} success={success} error={error} user={adminUser} />
  );
});

backofficeRouter.post('/orders/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await ordersService.updateOrder(id, {
      shippingAddress: (body.shippingAddress as string) || undefined,
      shippingCity: (body.shippingCity as string) || undefined,
      shippingPostalCode: (body.shippingPostalCode as string) || undefined,
      shippingNotes: (body.shippingNotes as string) || undefined,
      carrier: (body.carrier as string) || undefined,
      trackingNumber: (body.trackingNumber as string) || undefined,
      notes: (body.notes as string) || undefined,
      internalNotes: (body.internalNotes as string) || undefined,
    });
    return c.redirect(`/backoffice/orders/${id}?success=Commande mise à jour`);
  } catch (error: any) {
    return c.redirect(`/backoffice/orders/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.post('/orders/:id/status', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await ordersService.changeOrderStatus(
      id,
      { status: body.status as any, notes: (body.notes as string) || undefined },
      adminUser.id
    );
    return c.redirect(`/backoffice/orders/${id}?success=Statut mis à jour`);
  } catch (error: any) {
    return c.redirect(`/backoffice/orders/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

// ============ Stock ============

backofficeRouter.get('/stock', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const success = c.req.query('success');
  const error = c.req.query('error');

  const [dashboard, alerts] = await Promise.all([
    stockService.getStockDashboard(),
    stockService.getStockAlerts(),
  ]);

  return c.html(
    <StockDashboardPage
      totalProducts={dashboard.totalProducts}
      lowStockCount={dashboard.lowStockCount}
      outOfStockCount={dashboard.outOfStockCount}
      alerts={alerts as any}
      recentMovements={dashboard.recentMovements as any}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/stock/movements', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const type = c.req.query('type');
  const productId = c.req.query('productId');
  const success = c.req.query('success');
  const error = c.req.query('error');

  const result = await stockService.getStockMovements(
    { page, limit: PAGE_SIZE },
    { type: type as any, productId }
  );

  return c.html(
    <StockMovementsPage
      movements={result.data as any}
      currentPage={page}
      totalPages={result.meta.totalPages}
      totalItems={result.meta.total}
      pageSize={PAGE_SIZE}
      type={type}
      productId={productId}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

// ============ Supplier Orders ============

backofficeRouter.get('/supplier-orders', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const status = c.req.query('status');
  const supplierId = c.req.query('supplierId');
  const success = c.req.query('success');
  const error = c.req.query('error');

  const [result, suppliersList] = await Promise.all([
    supplierOrdersService.getSupplierOrders(
      { page, limit: PAGE_SIZE },
      { status: status as any, supplierId }
    ),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
  ]);

  return c.html(
    <SupplierOrdersListPage
      orders={result.data as any}
      suppliers={suppliersList}
      currentPage={page}
      totalPages={result.meta.totalPages}
      totalItems={result.meta.total}
      pageSize={PAGE_SIZE}
      status={status}
      supplierId={supplierId}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/supplier-orders/new', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const preselectedSupplierId = c.req.query('supplierId');

  const [suppliersList, productsList] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    preselectedSupplierId
      ? db
          .select({
            id: products.id,
            reference: products.reference,
            name: products.name,
            stock: products.stock,
            stockMin: products.stockMin,
            purchasePriceHT: products.purchasePriceHT,
            supplierId: products.supplierId,
          })
          .from(products)
          .where(and(eq(products.supplierId, preselectedSupplierId), eq(products.isActive, true)))
          .orderBy(products.name)
      : [],
  ]);

  return c.html(
    <SupplierOrderFormPage
      suppliers={suppliersList}
      products={productsList as any}
      preselectedSupplierId={preselectedSupplierId}
      user={adminUser}
    />
  );
});

backofficeRouter.post('/supplier-orders', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    // Parse lines from form data
    const lines: any[] = [];
    const lineKeys = Object.keys(body).filter(k => k.startsWith('lines['));
    const lineIndices = new Set(lineKeys.map(k => k.match(/lines\[(\d+)\]/)?.[1]).filter(Boolean));

    for (const idx of lineIndices) {
      const selected = body[`lines[${idx}][selected]`];
      if (selected === 'true') {
        lines.push({
          productId: body[`lines[${idx}][productId]`] as string,
          quantityOrdered: parseInt(body[`lines[${idx}][quantityOrdered]`] as string, 10),
          unitPriceHT: parseFloat(body[`lines[${idx}][unitPriceHT]`] as string),
        });
      }
    }

    if (lines.length === 0) {
      return c.redirect('/backoffice/supplier-orders/new?error=Selectionnez au moins un produit');
    }

    const order = await supplierOrdersService.createSupplierOrder(
      {
        supplierId: body.supplierId as string,
        supplierReference: (body.supplierReference as string) || undefined,
        expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate as string) : undefined,
        notes: (body.notes as string) || undefined,
        internalNotes: (body.internalNotes as string) || undefined,
        lines,
      },
      adminUser.id
    );

    return c.redirect(`/backoffice/supplier-orders/${order.id}?success=Commande créée`);
  } catch (error: any) {
    return c.redirect(`/backoffice/supplier-orders/new?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.get('/supplier-orders/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const success = c.req.query('success');
  const error = c.req.query('error');

  try {
    const order = await supplierOrdersService.getSupplierOrderById(id);
    return c.html(
      <SupplierOrderDetailPage order={order as any} success={success} error={error} user={adminUser} />
    );
  } catch {
    return c.redirect('/backoffice/supplier-orders');
  }
});

backofficeRouter.post('/supplier-orders/:id/status', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await supplierOrdersService.changeSupplierOrderStatus(
      id,
      { status: body.status as any, notes: (body.notes as string) || undefined },
      adminUser.id
    );
    return c.redirect(`/backoffice/supplier-orders/${id}?success=Statut mis à jour`);
  } catch (error: any) {
    return c.redirect(`/backoffice/supplier-orders/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.post('/supplier-orders/:id/reception', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    // Parse reception lines from form data
    const lines: any[] = [];
    const lineKeys = Object.keys(body).filter(k => k.startsWith('lines['));
    const lineIds = new Set(lineKeys.map(k => k.match(/lines\[([^\]]+)\]/)?.[1]).filter(Boolean));

    for (const lineId of lineIds) {
      const qtyReceived = parseInt(body[`lines[${lineId}][quantityReceived]`] as string, 10);
      if (qtyReceived > 0) {
        lines.push({
          lineId: body[`lines[${lineId}][lineId]`] as string,
          quantityReceived: qtyReceived,
        });
      }
    }

    if (lines.length === 0) {
      return c.redirect(`/backoffice/supplier-orders/${id}?error=Aucune quantité à réceptionner`);
    }

    await supplierOrdersService.receiveSupplierOrder(id, { lines }, adminUser.id);
    return c.redirect(`/backoffice/supplier-orders/${id}?success=Réception enregistrée`);
  } catch (error: any) {
    return c.redirect(`/backoffice/supplier-orders/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

// ============ Invoices ============

backofficeRouter.get('/invoices', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const page = parseInt(c.req.query('page') || '1', 10);
  const status = c.req.query('status');
  const overdue = c.req.query('overdue');
  const success = c.req.query('success');
  const error = c.req.query('error');

  const result = await invoicesService.getInvoices(
    { page, limit: PAGE_SIZE },
    { status: status as any, overdue: overdue === 'true' }
  );

  return c.html(
    <InvoicesListPage
      invoices={result.data as any}
      currentPage={page}
      totalPages={result.meta.totalPages}
      totalItems={result.meta.total}
      pageSize={PAGE_SIZE}
      status={status}
      overdue={overdue}
      success={success}
      error={error}
      user={adminUser}
    />
  );
});

backofficeRouter.get('/invoices/:id', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const success = c.req.query('success');
  const error = c.req.query('error');

  try {
    const invoice = await invoicesService.getInvoiceById(id);
    return c.html(
      <InvoiceDetailPage invoice={invoice as any} success={success} error={error} user={adminUser} />
    );
  } catch {
    return c.redirect('/backoffice/invoices');
  }
});

backofficeRouter.post('/invoices/depuis-commande', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const body = await c.req.parseBody();

  try {
    const invoice = await invoicesService.createInvoiceFromOrder(
      { orderId: body.orderId as string },
      adminUser.id
    );
    return c.redirect(`/backoffice/invoices/${invoice.id}?success=Facture créée`);
  } catch (error: any) {
    return c.redirect(`/backoffice/orders/${body.orderId}?error=${encodeURIComponent(error.message)}`);
  }
});

backofficeRouter.post('/invoices/:id/status', async (c) => {
  const adminUser = c.get('adminUser') as AdminUser;
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  try {
    await invoicesService.changeInvoiceStatus(
      id,
      { status: body.status as any, notes: (body.notes as string) || undefined },
      adminUser.id
    );
    return c.redirect(`/backoffice/invoices/${id}?success=Statut mis à jour`);
  } catch (error: any) {
    return c.redirect(`/backoffice/invoices/${id}?error=${encodeURIComponent(error.message)}`);
  }
});

export default backofficeRouter;
