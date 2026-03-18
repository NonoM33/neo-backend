import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
}

interface SuppliersListPageProps {
  suppliers: Supplier[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  search?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

export const SuppliersListPage: FC<SuppliersListPageProps> = ({
  suppliers,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  search,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Fournisseurs" currentPath="/backoffice/suppliers" user={user}>
      <FlashMessages success={success} error={error} />

      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/suppliers/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouveau fournisseur
              </a>
            </div>
            <div class="col-12">
              <form method="get" class="row g-2">
                <div class="col-md-4">
                  <label class="form-label small text-muted">Recherche</label>
                  <input
                    type="text"
                    name="search"
                    class="form-control"
                    placeholder="Nom, email..."
                    value={search || ''}
                  />
                </div>
                <div class="col-auto d-flex align-items-end">
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-search me-1"></i>Filtrer
                  </button>
                  {search && (
                    <a href="/backoffice/suppliers" class="btn btn-outline-secondary ms-2">
                      <i class="bi bi-x-lg"></i>
                    </a>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body p-0">
          <Table
            columns={[
              {
                key: 'name',
                label: 'Nom',
                render: (s: Supplier) => (
                  <span class="fw-medium">{s.name}</span>
                ),
              },
              {
                key: 'email',
                label: 'Email',
                render: (s: Supplier) => s.email ? (
                  <a href={`mailto:${s.email}`}>{s.email}</a>
                ) : <span class="text-muted">-</span>,
              },
              {
                key: 'phone',
                label: 'Telephone',
                render: (s: Supplier) => s.phone || <span class="text-muted">-</span>,
              },
              {
                key: 'website',
                label: 'Site web',
                render: (s: Supplier) => s.website ? (
                  <a href={s.website} target="_blank" rel="noopener noreferrer" class="text-truncate d-inline-block" style="max-width:200px;">
                    <i class="bi bi-box-arrow-up-right me-1"></i>
                    {new URL(s.website).hostname}
                  </a>
                ) : <span class="text-muted">-</span>,
              },
              {
                key: 'productCount',
                label: 'Produits',
                class: 'text-center',
                render: (s: Supplier) => (
                  <span class="badge bg-primary">{s.productCount}</span>
                ),
              },
              {
                key: 'isActive',
                label: 'Actif',
                class: 'text-center',
                render: (s: Supplier) => (
                  <span class={`badge bg-${s.isActive ? 'success' : 'secondary'}`}>
                    {s.isActive ? 'Oui' : 'Non'}
                  </span>
                ),
              },
            ]}
            data={suppliers}
            emptyMessage="Aucun fournisseur trouve"
            actions={(s: Supplier) => (
              <TableActions
                editUrl={`/backoffice/suppliers/${s.id}`}
                deleteUrl={`/backoffice/suppliers/${s.id}`}
                deleteConfirm={`Supprimer le fournisseur ${s.name} ?`}
              />
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
              baseUrl="/backoffice/suppliers"
              queryParams={{ search }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
