import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Activity {
  id: string;
  type: string;
  subject: string;
  description: string | null;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface StageHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  changedAt: Date;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string;
  description: string | null;
  status: string;
  source: string;
  estimatedValue: string | null;
  probability: number | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  surface: string | null;
  expectedCloseDate: Date | null;
  convertedProjectId: string | null;
  convertedAt: Date | null;
  lostReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  activities: Activity[];
  stageHistory: StageHistory[];
}

interface LeadDetailPageProps {
  lead: Lead;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  prospect: 'secondary',
  qualifie: 'info',
  proposition: 'primary',
  negociation: 'warning',
  gagne: 'success',
  perdu: 'danger',
};

const statusLabels: Record<string, string> = {
  prospect: 'Prospect',
  qualifie: 'Qualifie',
  proposition: 'Proposition',
  negociation: 'Negociation',
  gagne: 'Gagne',
  perdu: 'Perdu',
};

const sourceLabels: Record<string, string> = {
  site_web: 'Site web',
  recommandation: 'Recommandation',
  salon: 'Salon',
  publicite: 'Publicite',
  appel_entrant: 'Appel entrant',
  partenaire: 'Partenaire',
  autre: 'Autre',
};

const activityTypeIcons: Record<string, string> = {
  appel: 'telephone',
  email: 'envelope',
  reunion: 'people',
  visite: 'geo-alt',
  note: 'journal-text',
  tache: 'check-square',
};

const activityTypeLabels: Record<string, string> = {
  appel: 'Appel',
  email: 'Email',
  reunion: 'Reunion',
  visite: 'Visite',
  note: 'Note',
  tache: 'Tache',
};

const formatCurrency = (value: string | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(value));
};

const formatDate = (date: Date | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

export const LeadDetailPage: FC<LeadDetailPageProps> = ({
  lead,
  success,
  error,
  user,
}) => {
  const canConvert = !lead.convertedProjectId && !['gagne', 'perdu'].includes(lead.status);
  const isOpen = !['gagne', 'perdu'].includes(lead.status);

  return (
    <Layout title={lead.title} currentPath="/backoffice/crm/pipeline" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Header Actions */}
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <span class={`badge bg-${statusColors[lead.status]} fs-6 me-2`}>
            {statusLabels[lead.status]}
          </span>
          <span class="badge bg-light text-dark">
            {sourceLabels[lead.source]}
          </span>
        </div>
        <div class="d-flex gap-2">
          {canConvert && (
            <button
              type="button"
              class="btn btn-success"
              data-bs-toggle="modal"
              data-bs-target="#convertModal"
            >
              <i class="bi bi-arrow-right-circle me-2"></i>Convertir en projet
            </button>
          )}
          {isOpen && (
            <button
              type="button"
              class="btn btn-outline-warning"
              data-bs-toggle="modal"
              data-bs-target="#statusModal"
            >
              <i class="bi bi-pencil me-2"></i>Changer statut
            </button>
          )}
          <a href={`/backoffice/crm/leads/${lead.id}/edit`} class="btn btn-primary">
            <i class="bi bi-pencil me-2"></i>Modifier
          </a>
          <a href="/backoffice/crm/pipeline" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </a>
        </div>
      </div>

      <div class="row">
        {/* Main Content */}
        <div class="col-lg-8">
          {/* Contact Info */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-person me-2"></i>Contact
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <h5>{lead.firstName} {lead.lastName}</h5>
                  {lead.company && <p class="text-muted mb-2">{lead.company}</p>}
                  {lead.email && (
                    <p class="mb-1">
                      <i class="bi bi-envelope me-2"></i>
                      <a href={`mailto:${lead.email}`}>{lead.email}</a>
                    </p>
                  )}
                  {lead.phone && (
                    <p class="mb-0">
                      <i class="bi bi-telephone me-2"></i>
                      <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                    </p>
                  )}
                </div>
                <div class="col-md-6">
                  {(lead.address || lead.city) && (
                    <div>
                      <strong class="d-block mb-1">
                        <i class="bi bi-geo-alt me-2"></i>Localisation
                      </strong>
                      {lead.address && <span>{lead.address}<br /></span>}
                      {lead.postalCode && <span>{lead.postalCode} </span>}
                      {lead.city && <span>{lead.city}</span>}
                      {lead.surface && (
                        <p class="text-muted mt-1 mb-0">Surface: {lead.surface} m2</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {lead.description && (
                <div class="mt-3 pt-3 border-top">
                  <strong class="d-block mb-2">Description</strong>
                  <p class="mb-0">{lead.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Activities */}
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-activity me-2"></i>Activites</span>
              <a
                href={`/backoffice/activities/new?leadId=${lead.id}`}
                class="btn btn-sm btn-primary"
              >
                <i class="bi bi-plus-lg me-1"></i>Ajouter
              </a>
            </div>
            <div class="card-body p-0">
              {lead.activities.length === 0 ? (
                <div class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-3"></i>
                  <p class="mb-0">Aucune activite</p>
                </div>
              ) : (
                <div class="list-group list-group-flush">
                  {lead.activities.map(activity => (
                    <a
                      href={`/backoffice/activities/${activity.id}`}
                      class="list-group-item list-group-item-action"
                    >
                      <div class="d-flex justify-content-between align-items-start">
                        <div>
                          <i class={`bi bi-${activityTypeIcons[activity.type]} me-2`}></i>
                          <span class="fw-medium">{activity.subject}</span>
                          <span class={`badge ms-2 bg-${activity.status === 'termine' ? 'success' : activity.status === 'annule' ? 'danger' : 'warning'}`}>
                            {activity.status === 'termine' ? 'Termine' : activity.status === 'annule' ? 'Annule' : 'Planifie'}
                          </span>
                        </div>
                        <small class="text-muted">
                          {formatDateTime(activity.scheduledAt || activity.createdAt)}
                        </small>
                      </div>
                      {activity.description && (
                        <small class="text-muted d-block mt-1">{activity.description}</small>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stage History */}
          <div class="card">
            <div class="card-header">
              <i class="bi bi-clock-history me-2"></i>Historique
            </div>
            <div class="card-body p-0">
              <div class="list-group list-group-flush">
                {lead.stageHistory.map(history => (
                  <div class="list-group-item">
                    <div class="d-flex justify-content-between">
                      <div>
                        {history.fromStatus ? (
                          <>
                            <span class={`badge bg-${statusColors[history.fromStatus]}`}>
                              {statusLabels[history.fromStatus]}
                            </span>
                            <i class="bi bi-arrow-right mx-2"></i>
                          </>
                        ) : null}
                        <span class={`badge bg-${statusColors[history.toStatus]}`}>
                          {statusLabels[history.toStatus]}
                        </span>
                      </div>
                      <small class="text-muted">{formatDateTime(history.changedAt)}</small>
                    </div>
                    {history.notes && (
                      <small class="text-muted d-block mt-1">{history.notes}</small>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div class="col-lg-4">
          {/* Financial */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-currency-euro me-2"></i>Financier
            </div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-6">
                  <label class="small text-muted d-block">Valeur estimee</label>
                  <span class="fs-5 fw-bold text-primary">
                    {formatCurrency(lead.estimatedValue)}
                  </span>
                </div>
                <div class="col-6">
                  <label class="small text-muted d-block">Probabilite</label>
                  <span class="fs-5 fw-bold">{lead.probability ?? 0}%</span>
                </div>
                <div class="col-12">
                  <label class="small text-muted d-block">Valeur ponderee</label>
                  <span class="fs-5 fw-bold text-success">
                    {formatCurrency(
                      lead.estimatedValue
                        ? (parseFloat(lead.estimatedValue) * (lead.probability || 0) / 100).toString()
                        : null
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-calendar me-2"></i>Dates
            </div>
            <div class="card-body">
              <dl class="mb-0">
                <dt class="small text-muted">Cree le</dt>
                <dd>{formatDate(lead.createdAt)}</dd>
                <dt class="small text-muted">Derniere modif</dt>
                <dd>{formatDate(lead.updatedAt)}</dd>
                {lead.expectedCloseDate && (
                  <>
                    <dt class="small text-muted">Cloture prevue</dt>
                    <dd>{formatDate(lead.expectedCloseDate)}</dd>
                  </>
                )}
                {lead.convertedAt && (
                  <>
                    <dt class="small text-muted">Converti le</dt>
                    <dd class="mb-0">{formatDate(lead.convertedAt)}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Lost Reason */}
          {lead.status === 'perdu' && lead.lostReason && (
            <div class="card mb-4 border-danger">
              <div class="card-header bg-danger text-white">
                <i class="bi bi-x-circle me-2"></i>Raison de perte
              </div>
              <div class="card-body">
                <p class="mb-0">{lead.lostReason}</p>
              </div>
            </div>
          )}

          {/* Converted Project Link */}
          {lead.convertedProjectId && (
            <div class="card mb-4 border-success">
              <div class="card-header bg-success text-white">
                <i class="bi bi-check-circle me-2"></i>Projet cree
              </div>
              <div class="card-body">
                <a
                  href={`/backoffice/projects/${lead.convertedProjectId}`}
                  class="btn btn-outline-success w-100"
                >
                  <i class="bi bi-folder me-2"></i>Voir le projet
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Change Modal */}
      <div class="modal fade" id="statusModal" tabindex={-1}>
        <div class="modal-dialog">
          <div class="modal-content">
            <form method="post" action={`/backoffice/crm/leads/${lead.id}/status`}>
              <div class="modal-header">
                <h5 class="modal-title">Changer le statut</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Nouveau statut</label>
                  <select name="status" class="form-select" required>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option value={value} selected={lead.status === value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea name="notes" class="form-control" rows={2}></textarea>
                </div>
                <div class="mb-3" id="lostReasonGroup" style="display: none;">
                  <label class="form-label">Raison de perte *</label>
                  <textarea name="lostReason" class="form-control" rows={2}></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                  Annuler
                </button>
                <button type="submit" class="btn btn-primary">
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Convert Modal */}
      {canConvert && (
        <div class="modal fade" id="convertModal" tabindex={-1}>
          <div class="modal-dialog">
            <div class="modal-content">
              <form method="post" action={`/backoffice/crm/leads/${lead.id}/convert`}>
                <div class="modal-header">
                  <h5 class="modal-title">Convertir en projet</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                  <p>Cette action va:</p>
                  <ul>
                    <li>Marquer le lead comme "Gagne"</li>
                    <li>Creer un nouveau client (si non existant)</li>
                    <li>Creer un nouveau projet</li>
                    <li>Transferer les activites vers le projet</li>
                  </ul>
                  <div class="mb-3">
                    <label class="form-label">Nom du projet</label>
                    <input
                      type="text"
                      name="projectName"
                      class="form-control"
                      value={lead.title}
                    />
                  </div>
                  <div class="form-check">
                    <input
                      type="checkbox"
                      name="createClient"
                      class="form-check-input"
                      id="createClient"
                      checked
                    />
                    <label class="form-check-label" for="createClient">
                      Creer un client si necessaire
                    </label>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    Annuler
                  </button>
                  <button type="submit" class="btn btn-success">
                    <i class="bi bi-check-lg me-2"></i>Convertir
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <script>{`
        document.querySelector('select[name="status"]')?.addEventListener('change', function(e) {
          const lostGroup = document.getElementById('lostReasonGroup');
          if (lostGroup) {
            lostGroup.style.display = e.target.value === 'perdu' ? 'block' : 'none';
          }
        });
      `}</script>
    </Layout>
  );
};
