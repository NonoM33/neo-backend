import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  projectsCount: number;
  createdAt: Date;
}

interface ClientsListPageProps {
  clients: Client[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  search?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

export const ClientsListPage: FC<ClientsListPageProps> = ({
  clients,
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
    <Layout title="Clients" currentPath="/backoffice/clients" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/clients/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouveau client
              </a>
            </div>
            <div class="col">
              <form method="get" class="row g-2">
                <div class="col-md-5">
                  <label class="form-label small text-muted">Recherche</label>
                  <input
                    type="text"
                    name="search"
                    class="form-control"
                    placeholder="Nom, email ou telephone..."
                    value={search || ''}
                  />
                </div>
                <div class="col-auto d-flex align-items-end">
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-search me-1"></i>Filtrer
                  </button>
                  {search && (
                    <a href="/backoffice/clients" class="btn btn-outline-secondary ms-2">
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
                key: 'name',
                label: 'Client',
                render: (c: Client) => (
                  <div>
                    <div class="fw-medium">{c.firstName} {c.lastName}</div>
                    {c.email && <small class="text-muted">{c.email}</small>}
                  </div>
                ),
              },
              {
                key: 'phone',
                label: 'Telephone',
                render: (c: Client) => c.phone || '-',
              },
              {
                key: 'city',
                label: 'Ville',
                render: (c: Client) => c.city || '-',
              },
              {
                key: 'projectsCount',
                label: 'Projets',
                render: (c: Client) => (
                  <span class={`badge bg-${c.projectsCount > 0 ? 'primary' : 'secondary'}`}>
                    {c.projectsCount}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Date creation',
                render: (c: Client) => new Date(c.createdAt).toLocaleDateString('fr-FR'),
              },
            ]}
            data={clients}
            emptyMessage="Aucun client trouve"
            actions={(c: Client) => (
              <TableActions
                viewUrl={`/backoffice/clients/${c.id}`}
                editUrl={`/backoffice/clients/${c.id}/edit`}
                deleteUrl={`/backoffice/clients/${c.id}`}
                deleteConfirm={`Supprimer le client ${c.firstName} ${c.lastName} ?`}
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
              baseUrl="/backoffice/clients"
              queryParams={{ search }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
