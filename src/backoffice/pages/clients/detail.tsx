import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  notes: string | null;
  createdAt: Date;
}

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  quotesCount: number;
  totalTTC: string | null;
}

interface Quote {
  id: string;
  number: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  projectId: string;
  projectName: string;
  createdAt: Date;
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
}

interface Ticket {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
}

interface Lead {
  id: string;
  title: string;
  status: string;
  estimatedValue: string | null;
  createdAt: Date;
}

interface ClientDetailPageProps {
  client: ClientData;
  projects: Project[];
  quotes: Quote[];
  activities: Activity[];
  tickets: Ticket[];
  leads: Lead[];
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  // Projects
  brouillon: 'secondary',
  en_cours: 'primary',
  termine: 'success',
  archive: 'dark',
  // Quotes
  envoye: 'info',
  accepte: 'success',
  refuse: 'danger',
  expire: 'warning',
  // Activities
  planifie: 'info',
  annule: 'secondary',
  // Tickets
  ouvert: 'warning',
  en_attente: 'info',
  resolu: 'success',
  ferme: 'dark',
  // Leads
  prospect: 'info',
  qualification: 'primary',
  proposition: 'warning',
  negociation: 'purple',
  gagne: 'success',
  perdu: 'danger',
  // Priorities
  basse: 'secondary',
  normale: 'info',
  haute: 'warning',
  urgente: 'danger',
};

const statusLabels: Record<string, string> = {
  // Projects
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  termine: 'Termine',
  archive: 'Archive',
  // Quotes
  envoye: 'Envoye',
  accepte: 'Accepte',
  refuse: 'Refuse',
  expire: 'Expire',
  // Activities
  planifie: 'Planifie',
  annule: 'Annule',
  // Tickets
  ouvert: 'Ouvert',
  en_attente: 'En attente',
  resolu: 'Resolu',
  ferme: 'Ferme',
  // Leads
  prospect: 'Prospect',
  qualification: 'Qualification',
  proposition: 'Proposition',
  negociation: 'Negociation',
  gagne: 'Gagne',
  perdu: 'Perdu',
  // Priorities
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
};

const activityTypeLabels: Record<string, string> = {
  appel: 'Appel',
  email: 'Email',
  reunion: 'Reunion',
  visite: 'Visite',
  note: 'Note',
  tache: 'Tache',
};

const activityTypeIcons: Record<string, string> = {
  appel: 'telephone',
  email: 'envelope',
  reunion: 'people',
  visite: 'geo-alt',
  note: 'journal',
  tache: 'check2-square',
};

export const ClientDetailPage: FC<ClientDetailPageProps> = ({
  client,
  projects,
  quotes,
  activities,
  tickets,
  leads,
  success,
  error,
  user,
}) => {
  const totalDevisTTC = quotes.reduce((sum, q) => sum + parseFloat(q.totalTTC || '0'), 0);
  const acceptedQuotes = quotes.filter(q => q.status === 'accepte');
  const totalAcceptedTTC = acceptedQuotes.reduce((sum, q) => sum + parseFloat(q.totalTTC || '0'), 0);

  return (
    <Layout title={`${client.firstName} ${client.lastName}`} currentPath="/backoffice/clients" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Header */}
      <div class="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 class="mb-1">
            <i class="bi bi-person-badge me-2"></i>
            {client.firstName} {client.lastName}
          </h4>
          <p class="text-muted mb-0">
            Client depuis le {new Date(client.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div class="d-flex gap-2">
          <a href={`/backoffice/clients/${client.id}/edit`} class="btn btn-primary">
            <i class="bi bi-pencil me-2"></i>Modifier
          </a>
          <a href="/backoffice/clients" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </a>
        </div>
      </div>

      <div class="row g-4">
        {/* Main content */}
        <div class="col-lg-8">
          {/* Projets */}
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-folder me-2"></i>Projets ({projects.length})</span>
            </div>
            <div class="card-body p-0">
              {projects.length === 0 ? (
                <div class="p-4 text-center text-muted">
                  <i class="bi bi-inbox display-4"></i>
                  <p class="mt-2 mb-0">Aucun projet</p>
                </div>
              ) : (
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Statut</th>
                      <th class="text-center">Devis</th>
                      <th class="text-end">Total TTC</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr>
                        <td class="fw-medium">{project.name}</td>
                        <td>
                          <span class={`badge bg-${statusColors[project.status] || 'secondary'}`}>
                            {statusLabels[project.status] || project.status}
                          </span>
                        </td>
                        <td class="text-center">
                          <span class="badge bg-light text-dark">{project.quotesCount}</span>
                        </td>
                        <td class="text-end">
                          {project.totalTTC ? `${parseFloat(project.totalTTC).toFixed(2)} EUR` : '-'}
                        </td>
                        <td class="text-muted">
                          {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td class="text-end">
                          <a href={`/backoffice/projects/${project.id}`} class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-eye"></i>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Devis */}
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-file-text me-2"></i>Devis ({quotes.length})</span>
            </div>
            <div class="card-body p-0">
              {quotes.length === 0 ? (
                <div class="p-4 text-center text-muted">
                  <i class="bi bi-inbox display-4"></i>
                  <p class="mt-2 mb-0">Aucun devis</p>
                </div>
              ) : (
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Projet</th>
                      <th>Statut</th>
                      <th class="text-end">Total HT</th>
                      <th class="text-end">Total TTC</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => (
                      <tr>
                        <td class="fw-medium">{quote.number}</td>
                        <td>
                          <a href={`/backoffice/projects/${quote.projectId}`} class="text-decoration-none">
                            {quote.projectName}
                          </a>
                        </td>
                        <td>
                          <span class={`badge bg-${statusColors[quote.status] || 'secondary'}`}>
                            {statusLabels[quote.status] || quote.status}
                          </span>
                        </td>
                        <td class="text-end">{parseFloat(quote.totalHT).toFixed(2)} EUR</td>
                        <td class="text-end fw-medium">{parseFloat(quote.totalTTC).toFixed(2)} EUR</td>
                        <td class="text-muted">
                          {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Activites */}
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-calendar-event me-2"></i>Activites ({activities.length})</span>
              <a href={`/backoffice/activities/new?clientId=${client.id}`} class="btn btn-sm btn-outline-primary">
                <i class="bi bi-plus-lg me-1"></i>Ajouter
              </a>
            </div>
            <div class="card-body p-0">
              {activities.length === 0 ? (
                <div class="p-4 text-center text-muted">
                  <i class="bi bi-inbox display-4"></i>
                  <p class="mt-2 mb-0">Aucune activite</p>
                </div>
              ) : (
                <ul class="list-group list-group-flush">
                  {activities.slice(0, 10).map((activity) => (
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                      <div class="d-flex align-items-center">
                        <span class="badge bg-light text-dark me-3">
                          <i class={`bi bi-${activityTypeIcons[activity.type] || 'calendar'} me-1`}></i>
                          {activityTypeLabels[activity.type] || activity.type}
                        </span>
                        <div>
                          <div class="fw-medium">{activity.subject}</div>
                          <small class="text-muted">
                            {activity.scheduledAt
                              ? new Date(activity.scheduledAt).toLocaleDateString('fr-FR')
                              : '-'}
                          </small>
                        </div>
                      </div>
                      <span class={`badge bg-${statusColors[activity.status] || 'secondary'}`}>
                        {statusLabels[activity.status] || activity.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {activities.length > 10 && (
                <div class="card-footer text-center">
                  <a href={`/backoffice/activities?clientId=${client.id}`} class="text-decoration-none">
                    Voir toutes les activites ({activities.length})
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Tickets */}
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-headset me-2"></i>Tickets Support ({tickets.length})</span>
            </div>
            <div class="card-body p-0">
              {tickets.length === 0 ? (
                <div class="p-4 text-center text-muted">
                  <i class="bi bi-inbox display-4"></i>
                  <p class="mt-2 mb-0">Aucun ticket</p>
                </div>
              ) : (
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Titre</th>
                      <th>Statut</th>
                      <th>Priorite</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 10).map((ticket) => (
                      <tr>
                        <td class="fw-medium">{ticket.number}</td>
                        <td>{ticket.title}</td>
                        <td>
                          <span class={`badge bg-${statusColors[ticket.status] || 'secondary'}`}>
                            {statusLabels[ticket.status] || ticket.status}
                          </span>
                        </td>
                        <td>
                          <span class={`badge bg-${statusColors[ticket.priority] || 'secondary'}`}>
                            {statusLabels[ticket.priority] || ticket.priority}
                          </span>
                        </td>
                        <td class="text-muted">
                          {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td class="text-end">
                          <a href={`/backoffice/support/tickets/${ticket.id}`} class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-eye"></i>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tickets.length > 10 && (
                <div class="card-footer text-center">
                  <a href={`/backoffice/support/tickets?clientId=${client.id}`} class="text-decoration-none">
                    Voir tous les tickets ({tickets.length})
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Leads */}
          {leads.length > 0 && (
            <div class="card">
              <div class="card-header">
                <i class="bi bi-funnel me-2"></i>Leads ({leads.length})
              </div>
              <div class="card-body p-0">
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Statut</th>
                      <th class="text-end">Valeur estimee</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr>
                        <td class="fw-medium">{lead.title}</td>
                        <td>
                          <span class={`badge bg-${statusColors[lead.status] || 'secondary'}`}>
                            {statusLabels[lead.status] || lead.status}
                          </span>
                        </td>
                        <td class="text-end">
                          {lead.estimatedValue ? `${parseFloat(lead.estimatedValue).toFixed(2)} EUR` : '-'}
                        </td>
                        <td class="text-muted">
                          {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td class="text-end">
                          <a href={`/backoffice/crm/leads/${lead.id}`} class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-eye"></i>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div class="col-lg-4">
          {/* Contact Info */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-person-lines-fill me-2"></i>Coordonnees
            </div>
            <div class="card-body">
              {client.email && (
                <p class="mb-2">
                  <i class="bi bi-envelope me-2 text-muted"></i>
                  <a href={`mailto:${client.email}`}>{client.email}</a>
                </p>
              )}
              {client.phone && (
                <p class="mb-2">
                  <i class="bi bi-telephone me-2 text-muted"></i>
                  <a href={`tel:${client.phone}`}>{client.phone}</a>
                </p>
              )}
              {(client.address || client.city) && (
                <div class="mt-3 pt-3 border-top">
                  <p class="mb-0 text-muted small">
                    <i class="bi bi-geo-alt me-2"></i>
                    {client.address && <>{client.address}<br /></>}
                    {client.postalCode && client.city
                      ? `${client.postalCode} ${client.city}`
                      : client.city}
                  </p>
                </div>
              )}
              {!client.email && !client.phone && !client.address && !client.city && (
                <p class="text-muted mb-0">Aucune coordonnee renseignee</p>
              )}
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-sticky me-2"></i>Notes
              </div>
              <div class="card-body">
                <p class="mb-0" style="white-space: pre-wrap;">{client.notes}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-graph-up me-2"></i>Resume
            </div>
            <div class="card-body">
              <div class="d-flex justify-content-between mb-2">
                <span class="text-muted">Projets</span>
                <span class="fw-medium">{projects.length}</span>
              </div>
              <div class="d-flex justify-content-between mb-2">
                <span class="text-muted">Devis</span>
                <span class="fw-medium">{quotes.length}</span>
              </div>
              <div class="d-flex justify-content-between mb-2">
                <span class="text-muted">Activites</span>
                <span class="fw-medium">{activities.length}</span>
              </div>
              <div class="d-flex justify-content-between mb-2">
                <span class="text-muted">Tickets</span>
                <span class="fw-medium">{tickets.length}</span>
              </div>
              {quotes.length > 0 && (
                <>
                  <hr />
                  <div class="d-flex justify-content-between mb-2">
                    <span class="text-muted">Total devis TTC</span>
                    <span class="fw-medium">{totalDevisTTC.toFixed(2)} EUR</span>
                  </div>
                  {acceptedQuotes.length > 0 && (
                    <div class="d-flex justify-content-between">
                      <span class="text-muted">Devis acceptes</span>
                      <span class="fw-medium text-success">{totalAcceptedTTC.toFixed(2)} EUR</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div class="card">
            <div class="card-header">
              <i class="bi bi-lightning me-2"></i>Actions rapides
            </div>
            <div class="card-body">
              <div class="d-grid gap-2">
                <a href={`/backoffice/activities/new?clientId=${client.id}`} class="btn btn-outline-primary btn-sm">
                  <i class="bi bi-calendar-plus me-2"></i>Nouvelle activite
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
