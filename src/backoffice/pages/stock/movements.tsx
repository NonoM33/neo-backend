import type { FC } from 'hono/jsx';
import { Layout, Table, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string | null;
  createdAt: Date;
  product: {
    id: string;
    reference: string;
    name: string;
  } | null;
}

interface StockMovementsPageProps {
  movements: StockMovement[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  type?: string;
  productId?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

const movementTypeLabels: Record<string, { label: string; color: string }> = {
  entree: { label: 'Entree', color: 'success' },
  sortie: { label: 'Sortie', color: 'danger' },
  reservation: { label: 'Reservation', color: 'warning' },
  liberation: { label: 'Liberation', color: 'info' },
  correction: { label: 'Correction', color: 'secondary' },
  retour: { label: 'Retour', color: 'primary' },
};

export const StockMovementsPage: FC<StockMovementsPageProps> = ({
  movements,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  type,
  productId,
  success,
  error,
  user,
}) => {
  const hasFilters = type || productId;

  return (
    <Layout title="Mouvements de stock" currentPath="/backoffice/stock" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Header */}
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0">Historique des mouvements</h4>
        <a href="/backoffice/stock" class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1"></i>Dashboard stock
        </a>
      </div>

      {/* Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <form method="get" class="row g-2 align-items-end">
            <div class="col-md-3">
              <label class="form-label small text-muted">Type</label>
              <select name="type" class="form-select">
                <option value="">Tous</option>
                {Object.entries(movementTypeLabels).map(([key, { label }]) => (
                  <option value={key} selected={key === type}>{label}</option>
                ))}
              </select>
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-outline-primary">
                <i class="bi bi-search me-1"></i>Filtrer
              </button>
              {hasFilters && (
                <a href="/backoffice/stock/movements" class="btn btn-outline-secondary ms-2">
                  <i class="bi bi-x-lg"></i>
                </a>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Table */}
      <div class="card">
        <div class="card-body p-0">
          <Table
            columns={[
              {
                key: 'createdAt',
                label: 'Date',
                render: (m: StockMovement) => (
                  <span>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                ),
              },
              {
                key: 'product',
                label: 'Produit',
                render: (m: StockMovement) => m.product ? (
                  <a href={`/backoffice/products/${m.product.id}/edit`} class="text-decoration-none">
                    <div class="fw-medium">{m.product.name}</div>
                    <small class="text-muted">{m.product.reference}</small>
                  </a>
                ) : <span class="text-muted">-</span>,
              },
              {
                key: 'type',
                label: 'Type',
                render: (m: StockMovement) => {
                  const t = movementTypeLabels[m.type] || { label: m.type, color: 'secondary' };
                  return <span class={`badge bg-${t.color}`}>{t.label}</span>;
                },
              },
              {
                key: 'quantity',
                label: 'Quantite',
                class: 'text-center',
                render: (m: StockMovement) => (
                  <span class={`fw-medium ${m.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                ),
              },
              {
                key: 'stock',
                label: 'Stock',
                class: 'text-center',
                render: (m: StockMovement) => (
                  <span class="text-muted">
                    {m.stockBefore} → {m.stockAfter}
                  </span>
                ),
              },
              {
                key: 'reason',
                label: 'Raison',
                render: (m: StockMovement) => (
                  <span class="text-muted small">{m.reason || '-'}</span>
                ),
              },
            ]}
            data={movements}
            emptyMessage="Aucun mouvement trouve"
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
              baseUrl="/backoffice/stock/movements"
              queryParams={{ type, productId }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
