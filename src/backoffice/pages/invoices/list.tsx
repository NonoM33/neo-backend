import type { FC } from 'hono/jsx';
import { Layout, Table, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Invoice {
  id: string;
  number: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  dueDate: Date | null;
  createdAt: Date;
  isOverdue: boolean;
  project: {
    id: string;
    name: string;
  };
  client: {
    firstName: string;
    lastName: string;
  };
}

interface InvoicesListPageProps {
  invoices: Invoice[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  status?: string;
  overdue?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'secondary' },
  envoyee: { label: 'Envoyee', color: 'info' },
  payee: { label: 'Payee', color: 'success' },
  annulee: { label: 'Annulee', color: 'danger' },
};

export const InvoicesListPage: FC<InvoicesListPageProps> = ({
  invoices,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  status,
  overdue,
  success,
  error,
  user,
}) => {
  const hasFilters = status || overdue;

  return (
    <Layout title="Factures" currentPath="/backoffice/invoices" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <form method="get" class="row g-2 align-items-end">
            <div class="col-md-2">
              <label class="form-label small text-muted">Statut</label>
              <select name="status" class="form-select">
                <option value="">Tous</option>
                {Object.entries(statusLabels).map(([key, { label }]) => (
                  <option value={key} selected={key === status}>{label}</option>
                ))}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted">Retard</label>
              <select name="overdue" class="form-select">
                <option value="">Tous</option>
                <option value="true" selected={overdue === 'true'}>En retard</option>
              </select>
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-outline-primary">
                <i class="bi bi-search me-1"></i>Filtrer
              </button>
              {hasFilters && (
                <a href="/backoffice/invoices" class="btn btn-outline-secondary ms-2">
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
                key: 'number',
                label: 'Numero',
                render: (inv: Invoice) => (
                  <a href={`/backoffice/invoices/${inv.id}`} class="fw-medium text-decoration-none">
                    {inv.number}
                  </a>
                ),
              },
              {
                key: 'client',
                label: 'Client',
                render: (inv: Invoice) => (
                  <div>
                    <div class="fw-medium">{inv.client.firstName} {inv.client.lastName}</div>
                    <small class="text-muted">{inv.project.name}</small>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Statut',
                render: (inv: Invoice) => {
                  const s = statusLabels[inv.status] || { label: inv.status, color: 'secondary' };
                  return (
                    <div>
                      <span class={`badge bg-${s.color}`}>{s.label}</span>
                      {inv.isOverdue && (
                        <span class="badge bg-danger ms-1">En retard</span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'totalTTC',
                label: 'Total TTC',
                class: 'text-end',
                render: (inv: Invoice) => (
                  <span class="fw-medium">{parseFloat(inv.totalTTC).toFixed(2)} EUR</span>
                ),
              },
              {
                key: 'dueDate',
                label: 'Echeance',
                render: (inv: Invoice) => inv.dueDate ? (
                  <span class={inv.isOverdue ? 'text-danger fw-medium' : ''}>
                    {new Date(inv.dueDate).toLocaleDateString('fr-FR')}
                  </span>
                ) : <span class="text-muted">-</span>,
              },
              {
                key: 'createdAt',
                label: 'Date',
                render: (inv: Invoice) => (
                  <span class="text-muted">
                    {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                ),
              },
            ]}
            data={invoices}
            emptyMessage="Aucune facture trouvee"
            actions={(inv: Invoice) => (
              <a href={`/backoffice/invoices/${inv.id}`} class="btn btn-sm btn-outline-primary">
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
              baseUrl="/backoffice/invoices"
              queryParams={{ status, overdue }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
