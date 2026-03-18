import type { FC } from 'hono/jsx';
import { Layout } from './layout';
import type { User } from '../../db/schema';

interface UserFormProps {
  user?: Omit<User, 'password'>;
  error?: string;
}

export const UserForm: FC<UserFormProps> = ({ user, error }) => {
  const isEdit = !!user;

  return (
    <Layout title={isEdit ? 'Modifier utilisateur' : 'Nouvel utilisateur'}>
      <div class="row">
        <div class="col-md-6">
          {error && (
            <div class="alert alert-danger">{error}</div>
          )}

          <form method="post" action={isEdit ? `/admin/users/${user?.id}` : '/admin/users'}>
            <div class="mb-3">
              <label class="form-label">Email</label>
              <input
                type="email"
                name="email"
                class="form-control"
                value={user?.email || ''}
                required
              />
            </div>

            <div class="mb-3">
              <label class="form-label">Mot de passe {isEdit && '(laisser vide pour ne pas changer)'}</label>
              <input
                type="password"
                name="password"
                class="form-control"
                minLength={6}
                required={!isEdit}
              />
            </div>

            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Prenom</label>
                <input
                  type="text"
                  name="firstName"
                  class="form-control"
                  value={user?.firstName || ''}
                  required
                />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">Nom</label>
                <input
                  type="text"
                  name="lastName"
                  class="form-control"
                  value={user?.lastName || ''}
                  required
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">Telephone</label>
              <input
                type="tel"
                name="phone"
                class="form-control"
                value={user?.phone || ''}
              />
            </div>

            <div class="mb-3">
              <label class="form-label">Role</label>
              <select name="role" class="form-select" required>
                <option value="integrateur" selected={user?.role === 'integrateur'}>Integrateur</option>
                <option value="auditeur" selected={user?.role === 'auditeur'}>Auditeur</option>
                <option value="admin" selected={user?.role === 'admin'}>Admin</option>
              </select>
            </div>

            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary">
                {isEdit ? 'Enregistrer' : 'Creer'}
              </button>
              <a href="/admin/users" class="btn btn-secondary">Annuler</a>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
