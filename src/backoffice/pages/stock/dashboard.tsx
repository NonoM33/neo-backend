import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface StockAlert {
  id: string;
  reference: string;
  name: string;
  category: string;
  stock: number | null;
  stockMin: number | null;
  supplierId: string | null;
  supplierName: string | null;
}

interface RecentMovement {
  id: string;
  type: string;
  quantity: number;
  createdAt: Date;
  productName: string | null;
  productReference: string | null;
}

interface StockDashboardPageProps {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  alerts: StockAlert[];
  recentMovements: RecentMovement[];
  success?: string;
  error?: string;
  user: AdminUser;
}

const movementTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
  entree: { label: 'Entree', color: 'success', icon: 'bi-box-arrow-in-down' },
  sortie: { label: 'Sortie', color: 'danger', icon: 'bi-box-arrow-up' },
  reservation: { label: 'Reservation', color: 'warning', icon: 'bi-lock' },
  liberation: { label: 'Liberation', color: 'info', icon: 'bi-unlock' },
  correction: { label: 'Correction', color: 'secondary', icon: 'bi-pencil' },
  retour: { label: 'Retour', color: 'primary', icon: 'bi-arrow-return-left' },
};

export const StockDashboardPage: FC<StockDashboardPageProps> = ({
  totalProducts,
  lowStockCount,
  outOfStockCount,
  alerts,
  recentMovements,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Stock" currentPath="/backoffice/stock" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Stats */}
      <div class="row mb-4">
        <div class="col-md-4">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="text-muted mb-1">Produits suivis</h6>
                  <h3 class="mb-0">{totalProducts}</h3>
                </div>
                <div class="bg-primary bg-opacity-10 p-3 rounded">
                  <i class="bi bi-boxes fs-4 text-primary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="text-muted mb-1">Stock bas</h6>
                  <h3 class="mb-0 text-warning">{lowStockCount}</h3>
                </div>
                <div class="bg-warning bg-opacity-10 p-3 rounded">
                  <i class="bi bi-exclamation-triangle fs-4 text-warning"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="text-muted mb-1">Rupture</h6>
                  <h3 class="mb-0 text-danger">{outOfStockCount}</h3>
                </div>
                <div class="bg-danger bg-opacity-10 p-3 rounded">
                  <i class="bi bi-x-circle fs-4 text-danger"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        {/* Alertes */}
        <div class="col-md-8">
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0">
                <i class="bi bi-exclamation-triangle text-warning me-2"></i>
                Alertes de stock
              </h6>
              <a href="/backoffice/stock/suggestions" class="btn btn-sm btn-outline-primary">
                Suggestions reappro
              </a>
            </div>
            <div class="card-body p-0">
              {alerts.length === 0 ? (
                <div class="p-4 text-center text-muted">
                  <i class="bi bi-check-circle fs-1"></i>
                  <p class="mb-0 mt-2">Tous les stocks sont OK</p>
                </div>
              ) : (
                <table class="table table-sm mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Produit</th>
                      <th>Categorie</th>
                      <th class="text-center">Stock</th>
                      <th class="text-center">Seuil</th>
                      <th>Fournisseur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr class={(alert.stock ?? 0) === 0 ? 'table-danger' : 'table-warning'}>
                        <td>
                          <a href={`/backoffice/products/${alert.id}/edit`} class="text-decoration-none">
                            <div class="fw-medium">{alert.name}</div>
                            <small class="text-muted">{alert.reference}</small>
                          </a>
                        </td>
                        <td>
                          <span class="badge bg-light text-dark">{alert.category}</span>
                        </td>
                        <td class="text-center">
                          <span class={`badge bg-${(alert.stock ?? 0) === 0 ? 'danger' : 'warning'}`}>
                            {alert.stock ?? 0}
                          </span>
                        </td>
                        <td class="text-center text-muted">{alert.stockMin}</td>
                        <td>
                          {alert.supplierName ? (
                            <a href={`/backoffice/suppliers/${alert.supplierId}`}>
                              {alert.supplierName}
                            </a>
                          ) : (
                            <span class="text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Mouvements recents */}
        <div class="col-md-4">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0">Derniers mouvements</h6>
              <a href="/backoffice/stock/movements" class="btn btn-sm btn-outline-secondary">
                Voir tout
              </a>
            </div>
            <div class="card-body p-0">
              <ul class="list-group list-group-flush">
                {recentMovements.map((m) => {
                  const t = movementTypeLabels[m.type] || { label: m.type, color: 'secondary', icon: 'bi-arrow-left-right' };
                  return (
                    <li class="list-group-item">
                      <div class="d-flex align-items-center">
                        <span class={`badge bg-${t.color} me-2`}>
                          <i class={`bi ${t.icon}`}></i>
                        </span>
                        <div class="flex-grow-1">
                          <div class="small fw-medium">{m.productName}</div>
                          <small class="text-muted">
                            {m.quantity > 0 ? '+' : ''}{m.quantity} - {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                          </small>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div class="card mt-4">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-auto">
              <a href="/backoffice/stock/movements" class="btn btn-outline-primary">
                <i class="bi bi-list-ul me-2"></i>Historique mouvements
              </a>
            </div>
            <div class="col-auto">
              <a href="/backoffice/stock/correction" class="btn btn-outline-secondary">
                <i class="bi bi-pencil-square me-2"></i>Correction manuelle
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
