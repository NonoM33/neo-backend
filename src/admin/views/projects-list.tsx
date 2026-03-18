import type { FC } from 'hono/jsx';
import { Layout } from './layout';

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  client: {
    firstName: string;
    lastName: string;
  };
  user: {
    firstName: string;
    lastName: string;
  };
}

interface ProjectsListProps {
  projects: Project[];
  currentStatus?: string;
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

export const ProjectsList: FC<ProjectsListProps> = ({ projects, currentStatus }) => {
  return (
    <Layout title="Projets">
      <div class="d-flex justify-content-between mb-3">
        <form method="get" class="d-flex gap-2">
          <select name="status" class="form-select" style="width: auto;">
            <option value="">Tous statuts</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} selected={value === currentStatus}>{label}</option>
            ))}
          </select>
          <button type="submit" class="btn btn-outline-primary">Filtrer</button>
        </form>
      </div>

      <table class="table table-striped">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Client</th>
            <th>Integrateur</th>
            <th>Statut</th>
            <th>Date creation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr>
              <td>{project.name}</td>
              <td>{project.client.firstName} {project.client.lastName}</td>
              <td>{project.user.firstName} {project.user.lastName}</td>
              <td>
                <span class={`badge bg-${statusColors[project.status] || 'secondary'}`}>
                  {statusLabels[project.status] || project.status}
                </span>
              </td>
              <td>{new Date(project.createdAt).toLocaleDateString('fr-FR')}</td>
              <td>
                <a href={`/admin/projects/${project.id}`} class="btn btn-sm btn-outline-primary">Voir</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
};
