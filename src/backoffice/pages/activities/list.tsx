import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Activity {
  id: string;
  leadId: string | null;
  clientId: string | null;
  projectId: string | null;
  type: string;
  subject: string;
  description: string | null;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  createdAt: Date;
}

interface ActivitiesListPageProps {
  activities: Activity[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  type?: string;
  status?: string;
  search?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

const typeColors: Record<string, string> = {
  appel: 'info',
  email: 'primary',
  reunion: 'success',
  visite: 'warning',
  note: 'secondary',
  tache: 'dark',
};

const typeLabels: Record<string, string> = {
  appel: 'Appel',
  email: 'Email',
  reunion: 'Reunion',
  visite: 'Visite',
  note: 'Note',
  tache: 'Tache',
};

const typeIcons: Record<string, string> = {
  appel: 'telephone',
  email: 'envelope',
  reunion: 'people',
  visite: 'geo-alt',
  note: 'journal-text',
  tache: 'check-square',
};

const statusColors: Record<string, string> = {
  planifie: 'warning',
  termine: 'success',
  annule: 'danger',
};

const statusLabels: Record<string, string> = {
  planifie: 'Planifie',
  termine: 'Termine',
  annule: 'Annule',
};

const formatDateTime = (date: Date | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ActivitiesListPage: FC<ActivitiesListPageProps> = ({
  activities,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  type,
  status,
  search,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Activites" currentPath="/backoffice/activities" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/activities/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvelle activite
              </a>
            </div>
            <div class="col">
              <form method="get" class="row g-2">
                <div class="col-md-3">
                  <label class="form-label small text-muted">Recherche</label>
                  <input
                    type="text"
                    name="search"
                    class="form-control"
                    placeholder="Sujet..."
                    value={search || ''}
                  />
                </div>
                <div class="col-md-2">
                  <label class="form-label small text-muted">Type</label>
                  <select name="type" class="form-select">
                    <option value="">Tous</option>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option value={value} selected={value === type}>{label}</option>
                    ))}
                  </select>
                </div>
                <div class="col-md-2">
                  <label class="form-label small text-muted">Statut</label>
                  <select name="status" class="form-select">
                    <option value="">Tous</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option value={value} selected={value === status}>{label}</option>
                    ))}
                  </select>
                </div>
                <div class="col-auto d-flex align-items-end">
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-search me-1"></i>Filtrer
                  </button>
                  {(search || type || status) && (
                    <a href="/backoffice/activities" class="btn btn-outline-secondary ms-2">
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
                key: 'type',
                label: 'Type',
                render: (a: Activity) => (
                  <span class={`badge bg-${typeColors[a.type] || 'secondary'}`}>
                    <i class={`bi bi-${typeIcons[a.type]} me-1`}></i>
                    {typeLabels[a.type] || a.type}
                  </span>
                ),
              },
              {
                key: 'subject',
                label: 'Sujet',
                render: (a: Activity) => (
                  <div>
                    <div class="fw-medium">{a.subject}</div>
                    {a.description && (
                      <small class="text-muted">{a.description.substring(0, 50)}...</small>
                    )}
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Statut',
                render: (a: Activity) => (
                  <span class={`badge bg-${statusColors[a.status] || 'secondary'}`}>
                    {statusLabels[a.status] || a.status}
                  </span>
                ),
              },
              {
                key: 'scheduledAt',
                label: 'Date',
                render: (a: Activity) => formatDateTime(a.scheduledAt || a.createdAt),
              },
              {
                key: 'link',
                label: 'Lie a',
                render: (a: Activity) => {
                  if (a.leadId) return <span class="badge bg-light text-dark">Lead</span>;
                  if (a.clientId) return <span class="badge bg-light text-dark">Client</span>;
                  if (a.projectId) return <span class="badge bg-light text-dark">Projet</span>;
                  return '-';
                },
              },
            ]}
            data={activities}
            emptyMessage="Aucune activite trouvee"
            actions={(a: Activity) => (
              <div class="d-flex gap-1">
                {a.status === 'planifie' && (
                  <form method="post" action={`/backoffice/activities/${a.id}/complete`} style="display:inline;">
                    <button type="submit" class="btn btn-sm btn-outline-success btn-action" title="Terminer">
                      <i class="bi bi-check-lg"></i>
                    </button>
                  </form>
                )}
                <TableActions
                  editUrl={`/backoffice/activities/${a.id}/edit`}
                  deleteUrl={`/backoffice/activities/${a.id}`}
                  deleteConfirm={`Supprimer l'activite "${a.subject}" ?`}
                />
              </div>
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
              baseUrl="/backoffice/activities"
              queryParams={{ search, type, status }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
