import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

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
  ownerId: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface LeadFormPageProps {
  lead?: Lead;
  commercials: User[];
  isEdit: boolean;
  error?: string;
  user: AdminUser;
}

const statusOptions = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'qualifie', label: 'Qualifie' },
  { value: 'proposition', label: 'Proposition' },
  { value: 'negociation', label: 'Negociation' },
  { value: 'gagne', label: 'Gagne' },
  { value: 'perdu', label: 'Perdu' },
];

const sourceOptions = [
  { value: 'site_web', label: 'Site web' },
  { value: 'recommandation', label: 'Recommandation' },
  { value: 'salon', label: 'Salon' },
  { value: 'publicite', label: 'Publicite' },
  { value: 'appel_entrant', label: 'Appel entrant' },
  { value: 'partenaire', label: 'Partenaire' },
  { value: 'autre', label: 'Autre' },
];

export const LeadFormPage: FC<LeadFormPageProps> = ({
  lead,
  commercials,
  isEdit,
  error,
  user,
}) => {
  const title = isEdit ? `Modifier: ${lead?.title}` : 'Nouveau Lead';
  const action = isEdit ? `/backoffice/crm/leads/${lead?.id}` : '/backoffice/crm/leads';

  return (
    <Layout title={title} currentPath="/backoffice/crm/pipeline" user={user}>
      <FlashMessages error={error} />

      <div class="row">
        <div class="col-lg-8">
          <form method="post" action={action}>
            {isEdit && <input type="hidden" name="_method" value="PUT" />}

            {/* Contact Info */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-person me-2"></i>Informations Contact
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Prenom *</label>
                    <input
                      type="text"
                      name="firstName"
                      class="form-control"
                      value={lead?.firstName || ''}
                      required
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Nom *</label>
                    <input
                      type="text"
                      name="lastName"
                      class="form-control"
                      value={lead?.lastName || ''}
                      required
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Email</label>
                    <input
                      type="email"
                      name="email"
                      class="form-control"
                      value={lead?.email || ''}
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Telephone</label>
                    <input
                      type="tel"
                      name="phone"
                      class="form-control"
                      value={lead?.phone || ''}
                    />
                  </div>
                  <div class="col-12">
                    <label class="form-label">Entreprise</label>
                    <input
                      type="text"
                      name="company"
                      class="form-control"
                      value={lead?.company || ''}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lead Details */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-funnel me-2"></i>Details du Lead
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label">Titre du projet *</label>
                    <input
                      type="text"
                      name="title"
                      class="form-control"
                      value={lead?.title || ''}
                      required
                      placeholder="Ex: Installation domotique villa..."
                    />
                  </div>
                  <div class="col-12">
                    <label class="form-label">Description</label>
                    <textarea
                      name="description"
                      class="form-control"
                      rows={3}
                    >{lead?.description || ''}</textarea>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Statut</label>
                    <select name="status" class="form-select">
                      {statusOptions.map(opt => (
                        <option value={opt.value} selected={lead?.status === opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Source</label>
                    <select name="source" class="form-select">
                      {sourceOptions.map(opt => (
                        <option value={opt.value} selected={lead?.source === opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Valeur estimee (EUR)</label>
                    <input
                      type="number"
                      name="estimatedValue"
                      class="form-control"
                      value={lead?.estimatedValue || ''}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Probabilite (%)</label>
                    <input
                      type="number"
                      name="probability"
                      class="form-control"
                      value={lead?.probability ?? 0}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Date cloture prevue</label>
                    <input
                      type="date"
                      name="expectedCloseDate"
                      class="form-control"
                      value={lead?.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().split('T')[0] : ''}
                    />
                  </div>
                  <div class="col-12">
                    <label class="form-label">Commercial assigne</label>
                    <select name="ownerId" class="form-select">
                      {commercials.map(c => (
                        <option value={c.id} selected={lead?.ownerId === c.id}>
                          {c.firstName} {c.lastName} ({c.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-geo-alt me-2"></i>Localisation (projet)
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label">Adresse</label>
                    <input
                      type="text"
                      name="address"
                      class="form-control"
                      value={lead?.address || ''}
                    />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Code postal</label>
                    <input
                      type="text"
                      name="postalCode"
                      class="form-control"
                      value={lead?.postalCode || ''}
                    />
                  </div>
                  <div class="col-md-5">
                    <label class="form-label">Ville</label>
                    <input
                      type="text"
                      name="city"
                      class="form-control"
                      value={lead?.city || ''}
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Surface (m2)</label>
                    <input
                      type="number"
                      name="surface"
                      class="form-control"
                      value={lead?.surface || ''}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-check-lg me-2"></i>
                {isEdit ? 'Enregistrer' : 'Creer le lead'}
              </button>
              <a href="/backoffice/crm/pipeline" class="btn btn-outline-secondary">
                Annuler
              </a>
            </div>
          </form>
        </div>

        {/* Sidebar Tips */}
        <div class="col-lg-4">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title">
                <i class="bi bi-lightbulb me-2"></i>Conseils
              </h6>
              <ul class="small mb-0">
                <li class="mb-2">La probabilite permet de calculer la valeur ponderee du pipeline</li>
                <li class="mb-2">Un lead peut etre converti en projet une fois qualifie</li>
                <li>Les activites (appels, emails, reunions) peuvent etre ajoutees depuis la page de detail</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
