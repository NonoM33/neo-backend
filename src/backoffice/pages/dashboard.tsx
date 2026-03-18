import type { FC } from 'hono/jsx';
import { Layout } from '../components/layout';
import type { AdminUser } from '../middleware/admin-auth';

interface Stats {
  usersCount: number;
  clientsCount: number;
  projectsCount: number;
  productsCount: number;
  quotesCount: number;
  pendingQuotesCount: number;
}

interface RecentProject {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  clientName: string;
}

interface RecentQuote {
  id: string;
  number: string;
  status: string;
  totalTTC: string;
  projectName: string;
  createdAt: Date;
}

interface DashboardPageProps {
  stats: Stats;
  recentProjects: RecentProject[];
  recentQuotes: RecentQuote[];
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  brouillon: 'secondary',
  en_cours: 'primary',
  termine: 'success',
  archive: 'dark',
  envoye: 'info',
  accepte: 'success',
  refuse: 'danger',
  expire: 'warning',
};

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  termine: 'Termine',
  archive: 'Archive',
  envoye: 'Envoye',
  accepte: 'Accepte',
  refuse: 'Refuse',
  expire: 'Expire',
};

export const DashboardPage: FC<DashboardPageProps> = ({ stats, recentProjects, recentQuotes, user }) => {
  return (
    <Layout title="Dashboard" currentPath="/backoffice" user={user}>
      {/* Stats Cards */}
      <div class="row g-4 mb-4">
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-primary">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.usersCount}</div>
                <div class="stat-label">Utilisateurs</div>
              </div>
              <i class="bi bi-people stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-info">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.clientsCount}</div>
                <div class="stat-label">Clients</div>
              </div>
              <i class="bi bi-person-badge stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-success">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.projectsCount}</div>
                <div class="stat-label">Projets</div>
              </div>
              <i class="bi bi-folder stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-warning">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.productsCount}</div>
                <div class="stat-label">Produits</div>
              </div>
              <i class="bi bi-box-seam stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-secondary">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.quotesCount}</div>
                <div class="stat-label">Devis</div>
              </div>
              <i class="bi bi-file-text stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-4 col-xl-2">
          <div class="stat-card bg-danger">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-value">{stats.pendingQuotesCount}</div>
                <div class="stat-label">Devis en attente</div>
              </div>
              <i class="bi bi-hourglass-split stat-icon"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        {/* Recent Projects */}
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-folder me-2"></i>Derniers projets</span>
              <a href="/backoffice/projects" class="btn btn-sm btn-outline-primary">Voir tout</a>
            </div>
            <div class="card-body p-0">
              {recentProjects.length === 0 ? (
                <div class="p-4 text-center text-muted">
                  <i class="bi bi-inbox display-4"></i>
                  <p class="mt-2 mb-0">Aucun projet</p>
                </div>
              ) : (
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Projet</th>
                        <th>Client</th>
                        <th>Statut</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentProjects.map((project) => (
                        <tr>
                          <td>
                            <a href={`/backoffice/projects/${project.id}`} class="text-decoration-none">
                              {project.name}
                            </a>
                          </td>
                          <td class="text-muted">{project.clientName}</td>
                          <td>
                            <span class={`badge bg-${statusColors[project.status] || 'secondary'}`}>
                              {statusLabels[project.status] || project.status}
                            </span>
                          </td>
                          <td class="text-muted">
                            {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Quotes */}
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-file-text me-2"></i>Derniers devis</span>
              <a href="/backoffice/projects" class="btn btn-sm btn-outline-primary">Voir tout</a>
            </div>
            <div class="card-body p-0">
              {recentQuotes.length === 0 ? (
                <div class="p-4 text-center text-muted">
                  <i class="bi bi-inbox display-4"></i>
                  <p class="mt-2 mb-0">Aucun devis</p>
                </div>
              ) : (
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Numero</th>
                        <th>Projet</th>
                        <th>Total TTC</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentQuotes.map((quote) => (
                        <tr>
                          <td>
                            <a href={`/backoffice/projects/${quote.id}`} class="text-decoration-none">
                              {quote.number}
                            </a>
                          </td>
                          <td class="text-muted">{quote.projectName}</td>
                          <td>{parseFloat(quote.totalTTC).toFixed(2)} EUR</td>
                          <td>
                            <span class={`badge bg-${statusColors[quote.status] || 'secondary'}`}>
                              {statusLabels[quote.status] || quote.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
