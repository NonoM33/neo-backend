import type { FC } from 'hono/jsx';
import { Layout } from './layout';
import type { User } from '../../db/schema';

interface UsersListProps {
  users: Omit<User, 'password'>[];
}

export const UsersList: FC<UsersListProps> = ({ users }) => {
  return (
    <Layout title="Utilisateurs">
      <div class="mb-3">
        <a href="/admin/users/new" class="btn btn-primary">Nouvel utilisateur</a>
      </div>

      <table class="table table-striped">
        <thead>
          <tr>
            <th>Email</th>
            <th>Nom</th>
            <th>Role</th>
            <th>Date creation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr>
              <td>{user.email}</td>
              <td>{user.firstName} {user.lastName}</td>
              <td>
                <span class={`badge bg-${user.role === 'admin' ? 'danger' : user.role === 'integrateur' ? 'primary' : 'secondary'}`}>
                  {user.role}
                </span>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
              <td>
                <a href={`/admin/users/${user.id}/edit`} class="btn btn-sm btn-outline-primary">Modifier</a>
                <button
                  class="btn btn-sm btn-outline-danger ms-1"
                  hx-delete={`/admin/users/${user.id}`}
                  hx-confirm="Supprimer cet utilisateur ?"
                  hx-target="closest tr"
                  hx-swap="outerHTML"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
};
