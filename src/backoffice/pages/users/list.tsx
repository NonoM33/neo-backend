import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'admin' | 'integrateur' | 'auditeur';
  createdAt: Date;
}

interface UsersListPageProps {
  users: User[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  search?: string;
  role?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

const roleColors: Record<string, string> = {
  admin: 'danger',
  integrateur: 'primary',
  auditeur: 'secondary',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  integrateur: 'Integrateur',
  auditeur: 'Auditeur',
};

export const UsersListPage: FC<UsersListPageProps> = ({
  users,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  search,
  role,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Utilisateurs" currentPath="/backoffice/users" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/users/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvel utilisateur
              </a>
            </div>
            <div class="col">
              <form method="get" class="row g-2">
                <div class="col-md-4">
                  <label class="form-label small text-muted">Recherche</label>
                  <input
                    type="text"
                    name="search"
                    class="form-control"
                    placeholder="Nom ou email..."
                    value={search || ''}
                  />
                </div>
                <div class="col-md-3">
                  <label class="form-label small text-muted">Role</label>
                  <select name="role" class="form-select">
                    <option value="">Tous les roles</option>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option value={value} selected={value === role}>{label}</option>
                    ))}
                  </select>
                </div>
                <div class="col-auto d-flex align-items-end">
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-search me-1"></i>Filtrer
                  </button>
                  {(search || role) && (
                    <a href="/backoffice/users" class="btn btn-outline-secondary ms-2">
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
                key: 'email',
                label: 'Email',
                render: (u: User) => (
                  <div>
                    <div class="fw-medium">{u.email}</div>
                    <small class="text-muted">{u.firstName} {u.lastName}</small>
                  </div>
                ),
              },
              {
                key: 'phone',
                label: 'Telephone',
                render: (u: User) => u.phone || '-',
              },
              {
                key: 'role',
                label: 'Role',
                render: (u: User) => (
                  <span class={`badge bg-${roleColors[u.role] || 'secondary'}`}>
                    {roleLabels[u.role] || u.role}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Date creation',
                render: (u: User) => new Date(u.createdAt).toLocaleDateString('fr-FR'),
              },
            ]}
            data={users}
            emptyMessage="Aucun utilisateur trouve"
            actions={(u: User) => (
              <TableActions
                editUrl={`/backoffice/users/${u.id}/edit`}
                deleteUrl={`/backoffice/users/${u.id}`}
                deleteConfirm={`Supprimer l'utilisateur ${u.email} ?`}
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
              baseUrl="/backoffice/users"
              queryParams={{ search, role }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
