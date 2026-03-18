import type { FC } from 'hono/jsx';
import { Layout } from '../../backoffice/components';
import type { AdminUser } from '../../backoffice/middleware/admin-auth';

interface SupportDashboardProps {
  stats: {
    openTickets: number;
    unassignedTickets: number;
    slaBreached: number;
    avgResponseMinutes: number;
    avgResolutionMinutes: number;
    satisfactionAvg: number;
    ticketsByStatus: Record<string, number>;
    ticketsByPriority: Record<string, number>;
  };
  recentTickets: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    priority: string;
    clientName: string;
    createdAt: Date;
  }>;
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

const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}min`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}j ${remainingHours}h`;
};

export const SupportDashboardPage: FC<SupportDashboardProps> = ({ stats, recentTickets, user }) => {
  return (
    <Layout title="Support - Dashboard" currentPath="/backoffice/support" user={user}>
      {/* Stats Cards */}
      <div class="row g-4 mb-4">
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-primary">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.openTickets}</div>
                <div class="stat-label">Tickets ouverts</div>
              </div>
              <i class="bi bi-ticket-detailed stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-warning">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.unassignedTickets}</div>
                <div class="stat-label">Non assignes</div>
              </div>
              <i class="bi bi-person-exclamation stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-danger">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.slaBreached}</div>
                <div class="stat-label">SLA depasses</div>
              </div>
              <i class="bi bi-exclamation-triangle stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-info">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{formatMinutes(stats.avgResponseMinutes)}</div>
                <div class="stat-label">Temps reponse moy.</div>
              </div>
              <i class="bi bi-clock-history stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-secondary">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{formatMinutes(stats.avgResolutionMinutes)}</div>
                <div class="stat-label">Temps resolution moy.</div>
              </div>
              <i class="bi bi-hourglass-split stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-success">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.satisfactionAvg.toFixed(1)}/5</div>
                <div class="stat-label">Satisfaction</div>
              </div>
              <i class="bi bi-emoji-smile stat-icon"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4 mb-4">
        {/* Tickets by Status */}
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <i class="bi bi-bar-chart me-2"></i>Tickets par statut
            </div>
            <div class="card-body">
              {Object.entries(stats.ticketsByStatus).length === 0 ? (
                <p class="text-muted mb-0">Aucune donnee</p>
              ) : (
                <div class="d-flex flex-wrap gap-2">
                  {Object.entries(stats.ticketsByStatus).map(([status, count]) => (
                    <span class={`badge bg-${statusColors[status] || 'secondary'} fs-6`}>
                      {statusLabels[status] || status}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tickets by Priority */}
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header">
              <i class="bi bi-flag me-2"></i>Tickets par priorite
            </div>
            <div class="card-body">
              {Object.entries(stats.ticketsByPriority).length === 0 ? (
                <p class="text-muted mb-0">Aucune donnee</p>
              ) : (
                <div class="d-flex flex-wrap gap-2">
                  {Object.entries(stats.ticketsByPriority).map(([priority, count]) => (
                    <span
                      class={`badge fs-6 ${
                        priority === 'critique'
                          ? 'bg-danger text-white'
                          : `bg-${priorityColors[priority] || 'secondary'}`
                      }`}
                    >
                      {priorityLabels[priority] || priority}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-ticket-detailed me-2"></i>Derniers tickets</span>
          <a href="/backoffice/support/tickets" class="btn btn-sm btn-outline-primary">Voir tout</a>
        </div>
        <div class="card-body p-0">
          {recentTickets.length === 0 ? (
            <div class="p-4 text-center text-muted">
              <i class="bi bi-inbox display-4"></i>
              <p class="mt-2 mb-0">Aucun ticket</p>
            </div>
          ) : (
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Titre</th>
                    <th>Client</th>
                    <th>Statut</th>
                    <th>Priorite</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((ticket) => (
                    <tr>
                      <td>
                        <a href={`/backoffice/support/tickets/${ticket.id}`} class="text-decoration-none fw-medium">
                          {ticket.number}
                        </a>
                      </td>
                      <td>{ticket.title}</td>
                      <td class="text-muted">{ticket.clientName}</td>
                      <td>
                        <span class={`badge bg-${statusColors[ticket.status] || 'secondary'}`}>
                          {statusLabels[ticket.status] || ticket.status}
                        </span>
                      </td>
                      <td>
                        <span
                          class={`badge ${
                            ticket.priority === 'critique'
                              ? 'bg-danger text-white'
                              : `bg-${priorityColors[ticket.priority] || 'secondary'}`
                          }`}
                        >
                          {priorityLabels[ticket.priority] || ticket.priority}
                        </span>
                      </td>
                      <td class="text-muted">
                        {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
