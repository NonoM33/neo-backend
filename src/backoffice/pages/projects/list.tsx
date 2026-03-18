import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  client: {
    firstName: string;
    lastName: string;
  };
  user: {
    firstName: string;
    lastName: string;
  };
  quotesCount: number;
}

interface ProjectsListPageProps {
  projects: Project[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  search?: string;
  status?: string;
  integrateur?: string;
  integrateursList: { id: string; name: string }[];
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  brouillon: 'secondary',
  en_cours: 'primary',
  termine: 'success',
  archive: 'dark',
};

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  termine: 'Termine',
  archive: 'Archive',
};

export const ProjectsListPage: FC<ProjectsListPageProps> = ({
  projects,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  search,
  status,
  integrateur,
  integrateursList,
  success,
  error,
  user,
}) => {
  const hasFilters = search || status || integrateur;

  return (
    <Layout title="Projets" currentPath="/backoffice/projects" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <form method="get" class="row g-3 align-items-end">
            <div class="col-md-3">
              <label class="form-label small text-muted">Recherche</label>
              <input
                type="text"
                name="search"
                class="form-control"
                placeholder="Nom du projet..."
                value={search || ''}
              />
            </div>
            <div class="col-md-3">
              <label class="form-label small text-muted">Statut</label>
              <select name="status" class="form-select">
                <option value="">Tous les statuts</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option value={value} selected={value === status}>{label}</option>
                ))}
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small text-muted">Integrateur</label>
              <select name="integrateur" class="form-select">
                <option value="">Tous</option>
                {integrateursList.map((int) => (
                  <option value={int.id} selected={int.id === integrateur}>{int.name}</option>
                ))}
              </select>
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-outline-primary">
                <i class="bi bi-search me-1"></i>Filtrer
              </button>
              {hasFilters && (
                <a href="/backoffice/projects" class="btn btn-outline-secondary ms-2">
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
                key: 'name',
                label: 'Projet',
                render: (p: Project) => (
                  <a href={`/backoffice/projects/${p.id}`} class="text-decoration-none fw-medium">
                    {p.name}
                  </a>
                ),
              },
              {
                key: 'client',
                label: 'Client',
                render: (p: Project) => `${p.client.firstName} ${p.client.lastName}`,
              },
              {
                key: 'user',
                label: 'Integrateur',
                render: (p: Project) => (
                  <span class="text-muted">{p.user.firstName} {p.user.lastName}</span>
                ),
              },
              {
                key: 'quotesCount',
                label: 'Devis',
                class: 'text-center',
                render: (p: Project) => (
                  <span class={`badge bg-${p.quotesCount > 0 ? 'info' : 'secondary'}`}>
                    {p.quotesCount}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Statut',
                render: (p: Project) => (
                  <span class={`badge bg-${statusColors[p.status] || 'secondary'}`}>
                    {statusLabels[p.status] || p.status}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Date creation',
                render: (p: Project) => new Date(p.createdAt).toLocaleDateString('fr-FR'),
              },
            ]}
            data={projects}
            emptyMessage="Aucun projet trouve"
            actions={(p: Project) => (
              <TableActions
                viewUrl={`/backoffice/projects/${p.id}`}
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
              baseUrl="/backoffice/projects"
              queryParams={{ search, status, integrateur }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
