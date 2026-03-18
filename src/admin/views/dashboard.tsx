import type { FC } from 'hono/jsx';
import { Layout } from './layout';

interface DashboardProps {
  stats: {
    usersCount: number;
    projectsCount: number;
    productsCount: number;
    quotesCount: number;
  };
}

export const Dashboard: FC<DashboardProps> = ({ stats }) => {
  return (
    <Layout title="Dashboard">
      <div class="row">
        <div class="col-md-3">
          <div class="card text-white bg-primary mb-3">
            <div class="card-body">
              <h5 class="card-title">Utilisateurs</h5>
              <p class="card-text display-4">{stats.usersCount}</p>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-white bg-success mb-3">
            <div class="card-body">
              <h5 class="card-title">Projets</h5>
              <p class="card-text display-4">{stats.projectsCount}</p>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-white bg-info mb-3">
            <div class="card-body">
              <h5 class="card-title">Produits</h5>
              <p class="card-text display-4">{stats.productsCount}</p>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-white bg-warning mb-3">
            <div class="card-body">
              <h5 class="card-title">Devis</h5>
              <p class="card-text display-4">{stats.quotesCount}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
