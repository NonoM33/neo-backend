import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Order {
  id: string;
  number: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  createdAt: Date;
  project: {
    id: string;
    name: string;
  };
  client: {
    firstName: string;
    lastName: string;
  };
}

interface OrdersListPageProps {
  orders: Order[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  search?: string;
  status?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'secondary' },
  confirmee: { label: 'Confirmee', color: 'info' },
  payee: { label: 'Payee', color: 'primary' },
  en_preparation: { label: 'En preparation', color: 'warning' },
  expediee: { label: 'Expediee', color: 'info' },
  livree: { label: 'Livree', color: 'success' },
  annulee: { label: 'Annulee', color: 'danger' },
};

export const OrdersListPage: FC<OrdersListPageProps> = ({
  orders,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  search,
  status,
  success,
  error,
  user,
}) => {
  const hasFilters = search || status;

  return (
    <Layout title="Commandes" currentPath="/backoffice/orders" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-12">
              <form method="get" class="row g-2">
                <div class="col-md-3">
                  <label class="form-label small text-muted">Recherche</label>
                  <input
                    type="text"
                    name="search"
                    class="form-control"
                    placeholder="Numero ou client..."
                    value={search || ''}
                  />
                </div>
                <div class="col-md-2">
                  <label class="form-label small text-muted">Statut</label>
                  <select name="status" class="form-select">
                    <option value="">Tous</option>
                    {Object.entries(statusLabels).map(([key, { label }]) => (
                      <option value={key} selected={key === status}>{label}</option>
                    ))}
                  </select>
                </div>
                <div class="col-auto d-flex align-items-end">
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-search me-1"></i>Filtrer
                  </button>
                  {hasFilters && (
                    <a href="/backoffice/orders" class="btn btn-outline-secondary ms-2">
                      <i class="bi bi-x-lg"></i>
                    </a>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div class="card">
        <div class="card-body p-0">
          <Table
            columns={[
              {
                key: 'number',
                label: 'Numero',
                render: (o: Order) => (
                  <a href={`/backoffice/orders/${o.id}`} class="fw-medium text-decoration-none">
                    {o.number}
                  </a>
                ),
              },
              {
                key: 'client',
                label: 'Client',
                render: (o: Order) => (
                  <div>
                    <div class="fw-medium">{o.client.firstName} {o.client.lastName}</div>
                    <small class="text-muted">{o.project.name}</small>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Statut',
                render: (o: Order) => {
                  const s = statusLabels[o.status] || { label: o.status, color: 'secondary' };
                  return <span class={`badge bg-${s.color}`}>{s.label}</span>;
                },
              },
              {
                key: 'totalTTC',
                label: 'Total TTC',
                class: 'text-end',
                render: (o: Order) => (
                  <span class="fw-medium">{parseFloat(o.totalTTC).toFixed(2)} EUR</span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Date',
                render: (o: Order) => (
                  <span class="text-muted">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                ),
              },
            ]}
            data={orders}
            emptyMessage="Aucune commande trouvee"
            actions={(o: Order) => (
              <a href={`/backoffice/orders/${o.id}`} class="btn btn-sm btn-outline-primary">
                <i class="bi bi-eye"></i>
              </a>
            )}
          />
        </div>
        {totalPages > 1 && (
          <div class="card-footer d-flex justify-content-between align-items-center">
            <PaginationInfo
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              baseUrl="/backoffice/orders"
              queryParams={{ search, status }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
