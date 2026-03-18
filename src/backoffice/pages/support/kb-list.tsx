import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  categoryName: string | null;
  viewCount: number;
  version: number;
  updatedAt: Date;
}

interface KBListProps {
  articles: KBArticle[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  filters: { status?: string; search?: string };
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  brouillon: 'secondary',
  publie: 'success',
  archive: 'dark',
};

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  publie: 'Publie',
  archive: 'Archive',
};

export const KBListPage: FC<KBListProps> = ({
  articles,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  filters,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Base de connaissances" currentPath="/backoffice/support/kb" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/support/kb/articles/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvel article
              </a>
            </div>
            <div class="col">
              <form method="get" class="row g-2">
                <div class="col-md-4">
                  <label class="form-label small text-muted">Recherche</label>
                  <input
                    type="text"
                    name="search"
                    class="form-control"
                    placeholder="Titre ou contenu..."
                    value={filters.search || ''}
                  />
                </div>
                <div class="col-md-3">
                  <label class="form-label small text-muted">Statut</label>
                  <select name="status" class="form-select">
                    <option value="">Tous les statuts</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option value={value} selected={value === filters.status}>{label}</option>
                    ))}
                  </select>
                </div>
                <div class="col-auto d-flex align-items-end">
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-search me-1"></i>Filtrer
                  </button>
                  {(filters.search || filters.status) && (
                    <a href="/backoffice/support/kb" class="btn btn-outline-secondary ms-2">
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
                key: 'title',
                label: 'Titre',
                render: (a: KBArticle) => (
                  <a href={`/backoffice/support/kb/articles/${a.id}/edit`} class="text-decoration-none fw-medium">
                    {a.title}
                  </a>
                ),
              },
              {
                key: 'slug',
                label: 'Slug',
                render: (a: KBArticle) => <code class="small">{a.slug}</code>,
              },
              {
                key: 'categoryName',
                label: 'Categorie',
                render: (a: KBArticle) => a.categoryName || '-',
              },
              {
                key: 'status',
                label: 'Statut',
                render: (a: KBArticle) => (
                  <span class={`badge bg-${statusColors[a.status] || 'secondary'}`}>
                    {statusLabels[a.status] || a.status}
                  </span>
                ),
              },
              {
                key: 'viewCount',
                label: 'Vues',
                render: (a: KBArticle) => (
                  <span>
                    <i class="bi bi-eye me-1 text-muted"></i>{a.viewCount}
                  </span>
                ),
              },
              {
                key: 'version',
                label: 'Version',
                render: (a: KBArticle) => `v${a.version}`,
              },
              {
                key: 'updatedAt',
                label: 'Mise a jour',
                render: (a: KBArticle) => new Date(a.updatedAt).toLocaleDateString('fr-FR'),
              },
            ]}
            data={articles}
            emptyMessage="Aucun article trouve"
            actions={(a: KBArticle) => (
              <TableActions
                editUrl={`/backoffice/support/kb/articles/${a.id}/edit`}
                deleteUrl={`/backoffice/support/kb/articles/${a.id}`}
                deleteConfirm={`Supprimer l'article "${a.title}" ?`}
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
              baseUrl="/backoffice/support/kb"
              queryParams={{ search: filters.search, status: filters.status }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
