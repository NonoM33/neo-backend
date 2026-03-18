import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Ticket {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  slaBreached: boolean;
  clientName: string;
  assigneeName: string | null;
  categoryName: string | null;
  createdAt: Date;
}

interface TicketsListProps {
  tickets: Ticket[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  filters: {
    status?: string;
    priority?: string;
    assignedToId?: string;
    slaBreached?: string;
    search?: string;
  };
  assignees: Array<{ id: string; name: string }>;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  nouveau: 'info',
  ouvert: 'primary',
  en_attente_client: 'warning',
  en_attente_interne: 'secondary',
  escalade: 'danger',
  resolu: 'success',
  ferme: 'dark',
};

const statusLabels: Record<string, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_attente_client: 'Attente client',
  en_attente_interne: 'Attente interne',
  escalade: 'Escalade',
  resolu: 'Resolu',
  ferme: 'Ferme',
};

const priorityColors: Record<string, string> = {
  basse: 'secondary',
  normale: 'info',
  haute: 'warning',
  urgente: 'danger',
  critique: 'dark',
};

const priorityLabels: Record<string, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
  critique: 'Critique',
};

const hasFilters = (filters: TicketsListProps['filters']): boolean => {
  return !!(filters.status || filters.priority || filters.assignedToId || filters.slaBreached || filters.search);
};

export const TicketsListPage: FC<TicketsListProps> = ({
  tickets,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  filters,
  assignees,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Tickets" currentPath="/backoffice/support/tickets" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <form method="get" class="row g-3 align-items-end">
            <div class="col-md-3">
              <label class="form-label small text-muted">Recherche</label>
              <input
                type="text"
                name="search"
                class="form-control"
                placeholder="Numero, titre, client..."
                value={filters.search || ''}
              />
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted">Statut</label>
              <select name="status" class="form-select">
                <option value="">Tous les statuts</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option value={value} selected={value === filters.status}>{label}</option>
                ))}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted">Priorite</label>
              <select name="priority" class="form-select">
                <option value="">Toutes les priorites</option>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option value={value} selected={value === filters.priority}>{label}</option>
                ))}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted">Assignee</label>
              <select name="assignedToId" class="form-select">
                <option value="">Tous</option>
                {assignees.map((a) => (
                  <option value={a.id} selected={a.id === filters.assignedToId}>{a.name}</option>
                ))}
              </select>
            </div>
            <div class="col-md-1">
              <div class="form-check mt-4">
                <input
                  class="form-check-input"
                  type="checkbox"
                  name="slaBreached"
                  value="true"
                  id="slaBreachedFilter"
                  checked={filters.slaBreached === 'true'}
                />
                <label class="form-check-label small text-muted" for="slaBreachedFilter">
                  SLA
                </label>
              </div>
            </div>
            <div class="col-auto d-flex align-items-end">
              <button type="submit" class="btn btn-outline-primary">
                <i class="bi bi-search me-1"></i>Filtrer
              </button>
              {hasFilters(filters) && (
                <a href="/backoffice/support/tickets" class="btn btn-outline-secondary ms-2">
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
                render: (t: Ticket) => (
                  <a href={`/backoffice/support/tickets/${t.id}`} class="text-decoration-none fw-medium">
                    {t.number}
                  </a>
                ),
              },
              {
                key: 'title',
                label: 'Titre',
                render: (t: Ticket) => (
                  <div>
                    <div>{t.title}</div>
                    <small class="text-muted">{t.source}</small>
                  </div>
                ),
              },
              {
                key: 'clientName',
                label: 'Client',
                render: (t: Ticket) => <span class="text-muted">{t.clientName}</span>,
              },
              {
                key: 'assigneeName',
                label: 'Assignee',
                render: (t: Ticket) => t.assigneeName || <span class="text-muted fst-italic">Non assigne</span>,
              },
              {
                key: 'categoryName',
                label: 'Categorie',
                render: (t: Ticket) => t.categoryName || '-',
              },
              {
                key: 'status',
                label: 'Statut',
                render: (t: Ticket) => (
                  <span class={`badge bg-${statusColors[t.status] || 'secondary'}`}>
                    {statusLabels[t.status] || t.status}
                  </span>
                ),
              },
              {
                key: 'priority',
                label: 'Priorite',
                render: (t: Ticket) => (
                  <span
                    class={`badge ${
                      t.priority === 'critique'
                        ? 'bg-danger text-white'
                        : `bg-${priorityColors[t.priority] || 'secondary'}`
                    }`}
                  >
                    {priorityLabels[t.priority] || t.priority}
                  </span>
                ),
              },
              {
                key: 'slaBreached',
                label: 'SLA',
                render: (t: Ticket) =>
                  t.slaBreached ? (
                    <i class="bi bi-exclamation-triangle-fill text-danger" title="SLA depasse"></i>
                  ) : (
                    <i class="bi bi-check-circle text-success" title="SLA respecte"></i>
                  ),
              },
              {
                key: 'createdAt',
                label: 'Date',
                render: (t: Ticket) => new Date(t.createdAt).toLocaleDateString('fr-FR'),
              },
            ]}
            data={tickets}
            emptyMessage="Aucun ticket trouve"
            actions={(t: Ticket) => (
              <TableActions
                viewUrl={`/backoffice/support/tickets/${t.id}`}
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
              baseUrl="/backoffice/support/tickets"
              queryParams={{
                search: filters.search,
                status: filters.status,
                priority: filters.priority,
                assignedToId: filters.assignedToId,
                slaBreached: filters.slaBreached,
              }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
