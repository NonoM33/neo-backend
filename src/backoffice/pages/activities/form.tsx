import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
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
  duration: number | null;
  reminderAt: Date | null;
  ownerId: string;
}

interface Lead {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ActivityFormPageProps {
  activity?: Activity;
  leads: Lead[];
  clients: Client[];
  projects: Project[];
  users: User[];
  isEdit: boolean;
  preselectedLeadId?: string;
  preselectedClientId?: string;
  preselectedProjectId?: string;
  error?: string;
  user: AdminUser;
}

const typeOptions = [
  { value: 'appel', label: 'Appel', icon: 'telephone' },
  { value: 'email', label: 'Email', icon: 'envelope' },
  { value: 'reunion', label: 'Reunion', icon: 'people' },
  { value: 'visite', label: 'Visite', icon: 'geo-alt' },
  { value: 'note', label: 'Note', icon: 'journal-text' },
  { value: 'tache', label: 'Tache', icon: 'check-square' },
];

const statusOptions = [
  { value: 'planifie', label: 'Planifie' },
  { value: 'termine', label: 'Termine' },
  { value: 'annule', label: 'Annule' },
];

const formatDateTimeLocal = (date: Date | null) => {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const ActivityFormPage: FC<ActivityFormPageProps> = ({
  activity,
  leads,
  clients,
  projects,
  users,
  isEdit,
  preselectedLeadId,
  preselectedClientId,
  preselectedProjectId,
  error,
  user,
}) => {
  const title = isEdit ? `Modifier: ${activity?.subject}` : 'Nouvelle Activite';
  const action = isEdit ? `/backoffice/activities/${activity?.id}` : '/backoffice/activities';

  const selectedLeadId = activity?.leadId || preselectedLeadId || '';
  const selectedClientId = activity?.clientId || preselectedClientId || '';
  const selectedProjectId = activity?.projectId || preselectedProjectId || '';

  return (
    <Layout title={title} currentPath="/backoffice/activities" user={user}>
      <FlashMessages error={error} />

      <div class="row">
        <div class="col-lg-8">
          <form method="post" action={action}>
            {isEdit && <input type="hidden" name="_method" value="PUT" />}

            {/* Activity Type */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-tag me-2"></i>Type d'activite
              </div>
              <div class="card-body">
                <div class="row g-2">
                  {typeOptions.map(opt => (
                    <div class="col-4 col-md-2">
                      <input
                        type="radio"
                        class="btn-check"
                        name="type"
                        id={`type-${opt.value}`}
                        value={opt.value}
                        checked={activity?.type === opt.value || (!activity && opt.value === 'appel')}
                        required
                      />
                      <label
                        class="btn btn-outline-primary w-100 py-3"
                        for={`type-${opt.value}`}
                      >
                        <i class={`bi bi-${opt.icon} d-block fs-4 mb-1`}></i>
                        <small>{opt.label}</small>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Details */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-info-circle me-2"></i>Details
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label">Sujet *</label>
                    <input
                      type="text"
                      name="subject"
                      class="form-control"
                      value={activity?.subject || ''}
                      required
                      placeholder="Ex: Appel de qualification..."
                    />
                  </div>
                  <div class="col-12">
                    <label class="form-label">Description</label>
                    <textarea
                      name="description"
                      class="form-control"
                      rows={3}
                      placeholder="Notes, compte-rendu, etc."
                    >{activity?.description || ''}</textarea>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Statut</label>
                    <select name="status" class="form-select">
                      {statusOptions.map(opt => (
                        <option value={opt.value} selected={activity?.status === opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Assigne a</label>
                    <select name="ownerId" class="form-select">
                      {users.map(u => (
                        <option value={u.id} selected={activity?.ownerId === u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Scheduling */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-calendar-event me-2"></i>Planification
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Date et heure</label>
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      class="form-control"
                      value={formatDateTimeLocal(activity?.scheduledAt || null)}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Duree (minutes)</label>
                    <input
                      type="number"
                      name="duration"
                      class="form-control"
                      value={activity?.duration || ''}
                      min="0"
                      placeholder="Ex: 30"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Rappel</label>
                    <input
                      type="datetime-local"
                      name="reminderAt"
                      class="form-control"
                      value={formatDateTimeLocal(activity?.reminderAt || null)}
                    />
                    <small class="text-muted">Optionnel: recevoir un rappel</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Links */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-link-45deg me-2"></i>Liaison
              </div>
              <div class="card-body">
                <p class="text-muted small mb-3">
                  Associez cette activite a un lead, client ou projet.
                </p>
                <div class="row g-3">
                  <div class="col-md-4">
                    <label class="form-label">Lead</label>
                    <select name="leadId" class="form-select">
                      <option value="">-- Aucun --</option>
                      {leads.map(l => (
                        <option value={l.id} selected={selectedLeadId === l.id}>
                          {l.title} ({l.firstName} {l.lastName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Client</label>
                    <select name="clientId" class="form-select">
                      <option value="">-- Aucun --</option>
                      {clients.map(c => (
                        <option value={c.id} selected={selectedClientId === c.id}>
                          {c.firstName} {c.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Projet</label>
                    <select name="projectId" class="form-select">
                      <option value="">-- Aucun --</option>
                      {projects.map(p => (
                        <option value={p.id} selected={selectedProjectId === p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-check-lg me-2"></i>
                {isEdit ? 'Enregistrer' : 'Creer l\'activite'}
              </button>
              <a href="/backoffice/activities" class="btn btn-outline-secondary">
                Annuler
              </a>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div class="col-lg-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">
                <i class="bi bi-lightbulb me-2"></i>Types d'activites
              </h6>
              <dl class="small mb-0">
                <dt><i class="bi bi-telephone me-1"></i> Appel</dt>
                <dd class="mb-2">Appel telephonique entrant ou sortant</dd>
                <dt><i class="bi bi-envelope me-1"></i> Email</dt>
                <dd class="mb-2">Email envoye ou recu</dd>
                <dt><i class="bi bi-people me-1"></i> Reunion</dt>
                <dd class="mb-2">Reunion en personne ou visio</dd>
                <dt><i class="bi bi-geo-alt me-1"></i> Visite</dt>
                <dd class="mb-2">Visite sur site client</dd>
                <dt><i class="bi bi-journal-text me-1"></i> Note</dt>
                <dd class="mb-2">Note interne ou memo</dd>
                <dt><i class="bi bi-check-square me-1"></i> Tache</dt>
                <dd class="mb-0">Tache a accomplir</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
