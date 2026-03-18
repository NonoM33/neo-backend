import type { FC } from 'hono/jsx';
import { Layout, Table, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface SupplierOrder {
  id: string;
  number: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  expectedDeliveryDate: Date | null;
  createdAt: Date;
  supplier: {
    id: string;
    name: string;
  };
}

interface Supplier {
  id: string;
  name: string;
}

interface SupplierOrdersListPageProps {
  orders: SupplierOrder[];
  suppliers: Supplier[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  status?: string;
  supplierId?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'secondary' },
  envoyee: { label: 'Envoyee', color: 'info' },
  confirmee: { label: 'Confirmee', color: 'primary' },
  recue: { label: 'Recue', color: 'success' },
  annulee: { label: 'Annulee', color: 'danger' },
};

export const SupplierOrdersListPage: FC<SupplierOrdersListPageProps> = ({
  orders,
  suppliers,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  status,
  supplierId,
  success,
  error,
  user,
}) => {
  const hasFilters = status || supplierId;

  return (
    <Layout title="Commandes fournisseurs" currentPath="/backoffice/supplier-orders" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/supplier-orders/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvelle commande
              </a>
              <a href="/backoffice/stock/suggestions" class="btn btn-outline-secondary ms-2">
                <i class="bi bi-lightbulb me-2"></i>Suggestions
              </a>
            </div>
            <div class="col-12">
              <form method="get" class="row g-2">
                <div class="col-md-3">
                  <label class="form-label small text-muted">Fournisseur</label>
                  <select name="supplierId" class="form-select">
                    <option value="">Tous</option>
                    {suppliers.map((s) => (
                      <option value={s.id} selected={s.id === supplierId}>{s.name}</option>
                    ))}
                  </select>
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
                    <a href="/backoffice/supplier-orders" class="btn btn-outline-secondary ms-2">
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
                render: (o: SupplierOrder) => (
                  <a href={`/backoffice/supplier-orders/${o.id}`} class="fw-medium text-decoration-none">
                    {o.number}
                  </a>
                ),
              },
              {
                key: 'supplier',
                label: 'Fournisseur',
                render: (o: SupplierOrder) => (
                  <a href={`/backoffice/suppliers/${o.supplier.id}`} class="text-decoration-none">
                    {o.supplier.name}
                  </a>
                ),
              },
              {
                key: 'status',
                label: 'Statut',
                render: (o: SupplierOrder) => {
                  const s = statusLabels[o.status] || { label: o.status, color: 'secondary' };
                  return <span class={`badge bg-${s.color}`}>{s.label}</span>;
                },
              },
              {
                key: 'totalHT',
                label: 'Total HT',
                class: 'text-end',
                render: (o: SupplierOrder) => (
                  <span class="fw-medium">{parseFloat(o.totalHT).toFixed(2)} EUR</span>
                ),
              },
              {
                key: 'expectedDeliveryDate',
                label: 'Livraison prevue',
                render: (o: SupplierOrder) => o.expectedDeliveryDate ? (
                  <span class={new Date(o.expectedDeliveryDate) < new Date() && !['recue', 'annulee'].includes(o.status) ? 'text-danger' : ''}>
                    {new Date(o.expectedDeliveryDate).toLocaleDateString('fr-FR')}
                  </span>
                ) : <span class="text-muted">-</span>,
              },
              {
                key: 'createdAt',
                label: 'Date',
                render: (o: SupplierOrder) => (
                  <span class="text-muted">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                ),
              },
            ]}
            data={orders}
            emptyMessage="Aucune commande fournisseur trouvee"
            actions={(o: SupplierOrder) => (
              <a href={`/backoffice/supplier-orders/${o.id}`} class="btn btn-sm btn-outline-primary">
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
              baseUrl="/backoffice/supplier-orders"
              queryParams={{ status, supplierId }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
