import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'admin' | 'integrateur' | 'auditeur';
}

interface UserFormPageProps {
  userData?: UserData;
  error?: string;
  user: AdminUser;
}

const roleOptions = [
  { value: 'integrateur', label: 'Integrateur', description: 'Peut creer et gerer des projets' },
  { value: 'auditeur', label: 'Auditeur', description: 'Acces en lecture seule' },
  { value: 'admin', label: 'Administrateur', description: 'Acces complet au backoffice' },
];

export const UserFormPage: FC<UserFormPageProps> = ({ userData, error, user }) => {
  const isEdit = !!userData;
  const title = isEdit ? 'Modifier utilisateur' : 'Nouvel utilisateur';

  return (
    <Layout title={title} currentPath="/backoffice/users" user={user}>
      <div class="row">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">
              <i class="bi bi-person me-2"></i>
              {isEdit ? `Modification de ${userData?.firstName} ${userData?.lastName}` : 'Creer un nouvel utilisateur'}
            </div>
            <div class="card-body">
              <FlashMessages error={error} />

              <form method="post" action={isEdit ? `/backoffice/users/${userData?.id}` : '/backoffice/users'}>
                <div class="row g-3">
                  {/* Email */}
                  <div class="col-12">
                    <label class="form-label" for="email">
                      Email <span class="text-danger">*</span>
                    </label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <i class="bi bi-envelope"></i>
                      </span>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        class="form-control"
                        value={userData?.email || ''}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div class="col-12">
                    <label class="form-label" for="password">
                      Mot de passe {!isEdit && <span class="text-danger">*</span>}
                    </label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <i class="bi bi-lock"></i>
                      </span>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        class="form-control"
                        minLength={6}
                        required={!isEdit}
                        placeholder={isEdit ? 'Laisser vide pour ne pas changer' : ''}
                      />
                    </div>
                    <div class="form-text">Minimum 6 caracteres</div>
                  </div>

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
                      value={userData?.firstName || ''}
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
                      value={userData?.lastName || ''}
                      required
                    />
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
                        value={userData?.phone || ''}
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div class="col-md-6">
                    <label class="form-label" for="role">
                      Role <span class="text-danger">*</span>
                    </label>
                    <select id="role" name="role" class="form-select" required>
                      {roleOptions.map((option) => (
                        <option
                          value={option.value}
                          selected={userData?.role === option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Role descriptions */}
                  <div class="col-12">
                    <div class="alert alert-light mb-0">
                      <h6 class="alert-heading mb-2">
                        <i class="bi bi-info-circle me-2"></i>Roles disponibles
                      </h6>
                      <ul class="mb-0 small">
                        {roleOptions.map((option) => (
                          <li><strong>{option.label}</strong>: {option.description}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div class="d-flex gap-2 mt-4 pt-3 border-top">
                  <button type="submit" class="btn btn-primary">
                    <i class="bi bi-check-lg me-2"></i>
                    {isEdit ? 'Enregistrer' : 'Creer'}
                  </button>
                  <a href="/backoffice/users" class="btn btn-outline-secondary">
                    <i class="bi bi-x-lg me-2"></i>Annuler
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
