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
}

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
}

interface ClientFormPageProps {
  clientData?: ClientData;
  projects?: Project[];
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

export const ClientFormPage: FC<ClientFormPageProps> = ({ clientData, projects = [], error, user }) => {
  const isEdit = !!clientData;
  const title = isEdit ? 'Modifier client' : 'Nouveau client';

  return (
    <Layout title={title} currentPath="/backoffice/clients" user={user}>
      <div class="row g-4">
        <div class={isEdit && projects.length > 0 ? 'col-lg-8' : 'col-lg-8'}>
          <div class="card">
            <div class="card-header">
              <i class="bi bi-person-badge me-2"></i>
              {isEdit ? `Modification de ${clientData?.firstName} ${clientData?.lastName}` : 'Creer un nouveau client'}
            </div>
            <div class="card-body">
              <FlashMessages error={error} />

              <form method="post" action={isEdit ? `/backoffice/clients/${clientData?.id}` : '/backoffice/clients'}>
                <div class="row g-3">
                  {/* First Name */}
                  <div class="col-md-6">
                    <label class="form-label" for="firstName">
                      Prenom <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      class="form-control"
                      value={clientData?.firstName || ''}
                      required
                    />
                  </div>

                  {/* Last Name */}
                  <div class="col-md-6">
                    <label class="form-label" for="lastName">
                      Nom <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      class="form-control"
                      value={clientData?.lastName || ''}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div class="col-md-6">
                    <label class="form-label" for="email">Email</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <i class="bi bi-envelope"></i>
                      </span>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        class="form-control"
                        value={clientData?.email || ''}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div class="col-md-6">
                    <label class="form-label" for="phone">Telephone</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <i class="bi bi-telephone"></i>
                      </span>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        class="form-control"
                        value={clientData?.phone || ''}
                      />
                    </div>
                  </div>

                  <div class="col-12">
                    <hr class="my-2" />
                    <h6 class="text-muted mb-3">
                      <i class="bi bi-geo-alt me-2"></i>Adresse
                    </h6>
                  </div>

                  {/* Address */}
                  <div class="col-12">
                    <label class="form-label" for="address">Adresse</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      class="form-control"
                      value={clientData?.address || ''}
                    />
                  </div>

                  {/* Postal Code */}
                  <div class="col-md-4">
                    <label class="form-label" for="postalCode">Code postal</label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      class="form-control"
                      value={clientData?.postalCode || ''}
                    />
                  </div>

                  {/* City */}
                  <div class="col-md-8">
                    <label class="form-label" for="city">Ville</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      class="form-control"
                      value={clientData?.city || ''}
                    />
                  </div>

                  {/* Notes */}
                  <div class="col-12">
                    <label class="form-label" for="notes">Notes</label>
                    <textarea
                      id="notes"
                      name="notes"
                      class="form-control"
                      rows={3}
                    >{clientData?.notes || ''}</textarea>
                  </div>
                </div>

                {/* Actions */}
                <div class="d-flex gap-2 mt-4 pt-3 border-top">
                  <button type="submit" class="btn btn-primary">
                    <i class="bi bi-check-lg me-2"></i>
                    {isEdit ? 'Enregistrer' : 'Creer'}
                  </button>
                  <a href="/backoffice/clients" class="btn btn-outline-secondary">
                    <i class="bi bi-x-lg me-2"></i>Annuler
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Projects sidebar for edit mode */}
        {isEdit && projects.length > 0 && (
          <div class="col-lg-4">
            <div class="card">
              <div class="card-header">
                <i class="bi bi-folder me-2"></i>Projets associes
              </div>
              <div class="card-body p-0">
                <ul class="list-group list-group-flush">
                  {projects.map((project) => (
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <a href={`/backoffice/projects/${project.id}`} class="text-decoration-none">
                          {project.name}
                        </a>
                        <br />
                        <small class="text-muted">
                          {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                        </small>
                      </div>
                      <span class={`badge bg-${statusColors[project.status] || 'secondary'}`}>
                        {statusLabels[project.status] || project.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
