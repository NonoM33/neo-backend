import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import { errorHandler } from './middleware/error.middleware';

import { authRoutes } from './modules/auth';
import { usersRoutes } from './modules/users';
import { projectsRoutes } from './modules/projects';
import { roomsRoutes } from './modules/rooms';
import { photosRoutes } from './modules/photos';
import { devicesRoutes } from './modules/devices';
import { productsRoutes } from './modules/products';
import { quotesRoutes } from './modules/quotes';
import { ordersRoutes } from './modules/orders';
import { stockRoutes } from './modules/stock';
import { supplierOrdersRoutes } from './modules/supplier-orders';
import { invoicesRoutes } from './modules/invoices';
import { syncRoutes } from './modules/sync';
import { leadsRoutes } from './modules/leads';
import { activitiesRoutes } from './modules/activities';
import { kpisRoutes } from './modules/kpis';
import { appointmentsRoutes, availabilityRoutes } from './modules/appointments';
import { bookingRoutes } from './modules/booking';
import { calendarSyncRoutes } from './modules/calendar-sync';
import { callsRoutes } from './modules/calls';
import { trackingRoutes, publicTrackingRoutes } from './modules/tracking';
import { cloudInstancesRoutes } from './modules/cloud-instances';
import { floorPlansRoutes } from './modules/floor-plans';
import { clientAuthRoutes, ticketsRoutes, kbRoutes, chatRoutes } from './support';

import { scanSessionsRoutes } from './modules/scan-sessions';
import adminRoutes from './admin/admin.routes';
import backofficeRoutes from './backoffice/backoffice.routes';
import swaggerRoutes from './swagger/swagger.routes';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
  })
);

// Error handler
app.onError(errorHandler);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Scan Sessions — PUBLIC routes (no auth, accessed by iPhone via QR code)
app.route('/', scanSessionsRoutes);

// Client-facing routes (must be registered BEFORE generic /api routes
// which use catch-all middleware that would intercept /api/client/* paths)
// Public booking routes (no auth required)
app.route('/api/public/booking', bookingRoutes);

// Calendar sync routes (mixed: token-based feed + JWT-authenticated management)
app.route('/api/calendar', calendarSyncRoutes);

app.route('/api/client/auth', clientAuthRoutes);
app.route('/api/client/tickets', ticketsRoutes.clientRoutes);
app.route('/api/client/kb', kbRoutes.clientRoutes);
app.route('/api/client/chat', chatRoutes);

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/projets', projectsRoutes);
app.route('/api', roomsRoutes);
app.route('/api', photosRoutes);
app.route('/api', devicesRoutes);
app.route('/api/produits', productsRoutes);
app.route('/api', quotesRoutes);
app.route('/api/commandes', ordersRoutes);
app.route('/api/stock', stockRoutes);
app.route('/api/commandes-fournisseurs', supplierOrdersRoutes);
app.route('/api/factures', invoicesRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/tickets', ticketsRoutes.staffRoutes);
app.route('/api/kb', kbRoutes.staffRoutes);

// CRM Routes
app.route('/api/leads', leadsRoutes);
app.route('/api/activities', activitiesRoutes);
app.route('/api/kpis', kpisRoutes);
app.route('/api/appointments', appointmentsRoutes);
app.route('/api/availability', availabilityRoutes);
app.route('/api/calls', callsRoutes);
app.route('/api/tracking', trackingRoutes);
app.route('/api/cloud-instances', cloudInstancesRoutes);
app.route('/api', floorPlansRoutes);

// Public tracking page (no auth, token-based)
app.route('/tracking', publicTrackingRoutes);

// Swagger
app.route('/swagger', swaggerRoutes);

// Admin routes
app.route('/admin', adminRoutes);

// Backoffice routes
app.route('/backoffice', backofficeRoutes);

// 404
app.notFound((c) => {
  return c.json({ error: { message: 'Route non trouvée', code: 'NOT_FOUND' } }, 404);
});

export default app;
