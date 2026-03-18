import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface DashboardData {
  period: { from: Date; to: Date };
  leads: {
    total: number;
    won: number;
    lost: number;
    open: number;
    conversionRate: number;
  };
  activities: { completed: number };
  revenue: {
    totalValue: number;
    weightedValue: number;
  };
}

interface PipelineStage {
  status: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  avgProbability: number;
}

interface ConversionBySource {
  source: string;
  total: number;
  won: number;
  lost: number;
  conversionRate: number;
  revenue: number;
}

interface ActivityByType {
  type: string;
  total: number;
  completed: number;
  cancelled: number;
  totalDurationMinutes: number;
}

interface Objective {
  id: string;
  year: number;
  month: number | null;
  revenueTarget: string | null;
  leadsTarget: number | null;
  conversionsTarget: number | null;
  activitiesTarget: number | null;
}

interface ObjectiveProgress {
  revenue: { target: number | null; actual: number; percentage: number | null };
  leads: { target: number | null; actual: number; percentage: number | null };
  conversions: { target: number | null; actual: number; percentage: number | null };
  activities: { target: number | null; actual: number; percentage: number | null };
}

interface KPIsDashboardPageProps {
  dashboard: DashboardData;
  pipeline: { stages: PipelineStage[]; totals: { count: number; totalValue: number; weightedValue: number } };
  conversions: { overall: any; bySource: ConversionBySource[] };
  activityMetrics: { byType: ActivityByType[] };
  currentObjective?: { objective: Objective; progress: ObjectiveProgress };
  user: AdminUser;
  success?: string;
  error?: string;
}

const statusLabels: Record<string, string> = {
  prospect: 'Prospect',
  qualifie: 'Qualifie',
  proposition: 'Proposition',
  negociation: 'Negociation',
};

const statusColors: Record<string, string> = {
  prospect: '#6c757d',
  qualifie: '#0dcaf0',
  proposition: '#0d6efd',
  negociation: '#ffc107',
};

const sourceLabels: Record<string, string> = {
  site_web: 'Site web',
  recommandation: 'Recommandation',
  salon: 'Salon',
  publicite: 'Publicite',
  appel_entrant: 'Appel entrant',
  partenaire: 'Partenaire',
  autre: 'Autre',
};

const activityTypeLabels: Record<string, string> = {
  appel: 'Appels',
  email: 'Emails',
  reunion: 'Reunions',
  visite: 'Visites',
  note: 'Notes',
  tache: 'Taches',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
};

const ProgressBar: FC<{ percentage: number | null; label: string; actual: number; target: number | null }> = ({
  percentage,
  label,
  actual,
  target,
}) => {
  const pct = percentage ?? 0;
  const color = pct >= 100 ? 'success' : pct >= 75 ? 'info' : pct >= 50 ? 'warning' : 'danger';

  return (
    <div class="mb-3">
      <div class="d-flex justify-content-between mb-1">
        <span class="small">{label}</span>
        <span class="small">
          {actual} / {target ?? '-'}
          {percentage !== null && ` (${percentage}%)`}
        </span>
      </div>
      <div class="progress" style="height: 8px;">
        <div
          class={`progress-bar bg-${color}`}
          style={`width: ${Math.min(pct, 100)}%`}
        ></div>
      </div>
    </div>
  );
};

export const KPIsDashboardPage: FC<KPIsDashboardPageProps> = ({
  dashboard,
  pipeline,
  conversions,
  activityMetrics,
  currentObjective,
  user,
  success,
  error,
}) => {
  return (
    <Layout title="KPIs Commercial" currentPath="/backoffice/crm/kpis" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Period Info */}
      <div class="alert alert-light mb-4">
        <i class="bi bi-calendar3 me-2"></i>
        Periode: {new Date(dashboard.period.from).toLocaleDateString('fr-FR')} - {new Date(dashboard.period.to).toLocaleDateString('fr-FR')}
      </div>

      {/* Main KPIs */}
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="card stat-card bg-primary">
            <div class="d-flex justify-content-between">
              <div>
                <div class="stat-value">{dashboard.leads.total}</div>
                <div class="stat-label">Leads crees</div>
              </div>
              <i class="bi bi-funnel stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card stat-card bg-success">
            <div class="d-flex justify-content-between">
              <div>
                <div class="stat-value">{dashboard.leads.won}</div>
                <div class="stat-label">Leads gagnes</div>
              </div>
              <i class="bi bi-trophy stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card stat-card bg-info">
            <div class="d-flex justify-content-between">
              <div>
                <div class="stat-value">{dashboard.leads.conversionRate}%</div>
                <div class="stat-label">Taux conversion</div>
              </div>
              <i class="bi bi-percent stat-icon"></i>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card stat-card bg-warning text-dark">
            <div class="d-flex justify-content-between">
              <div>
                <div class="stat-value">{dashboard.activities.completed}</div>
                <div class="stat-label">Activites terminees</div>
              </div>
              <i class="bi bi-check-circle stat-icon"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        {/* Pipeline Chart */}
        <div class="col-lg-8">
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-bar-chart me-2"></i>Pipeline par etape
            </div>
            <div class="card-body">
              {pipeline.stages.length === 0 ? (
                <div class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-3"></i>
                  <p class="mb-0">Aucun lead en cours</p>
                </div>
              ) : (
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>Etape</th>
                        <th class="text-center">Leads</th>
                        <th class="text-end">Valeur totale</th>
                        <th class="text-end">Valeur ponderee</th>
                        <th class="text-center">Proba moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipeline.stages.map(stage => (
                        <tr>
                          <td>
                            <span
                              class="badge"
                              style={`background-color: ${statusColors[stage.status]}`}
                            >
                              {statusLabels[stage.status] || stage.status}
                            </span>
                          </td>
                          <td class="text-center">{stage.count}</td>
                          <td class="text-end">{formatCurrency(stage.totalValue)}</td>
                          <td class="text-end fw-bold text-success">
                            {formatCurrency(stage.weightedValue)}
                          </td>
                          <td class="text-center">{stage.avgProbability}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot class="table-light">
                      <tr class="fw-bold">
                        <td>Total Pipeline</td>
                        <td class="text-center">{pipeline.totals.count}</td>
                        <td class="text-end">{formatCurrency(pipeline.totals.totalValue)}</td>
                        <td class="text-end text-success">
                          {formatCurrency(pipeline.totals.weightedValue)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Conversion by Source */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-pie-chart me-2"></i>Conversion par source
            </div>
            <div class="card-body">
              {conversions.bySource.length === 0 ? (
                <div class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-3"></i>
                  <p class="mb-0">Aucune donnee</p>
                </div>
              ) : (
                <div class="table-responsive">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th class="text-center">Total</th>
                        <th class="text-center">Gagnes</th>
                        <th class="text-center">Perdus</th>
                        <th class="text-center">Taux</th>
                        <th class="text-end">CA genere</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.bySource.map(src => (
                        <tr>
                          <td>{sourceLabels[src.source] || src.source}</td>
                          <td class="text-center">{src.total}</td>
                          <td class="text-center text-success">{src.won}</td>
                          <td class="text-center text-danger">{src.lost}</td>
                          <td class="text-center">
                            <span class={`badge bg-${src.conversionRate >= 50 ? 'success' : src.conversionRate >= 25 ? 'warning' : 'danger'}`}>
                              {src.conversionRate}%
                            </span>
                          </td>
                          <td class="text-end">{formatCurrency(src.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div class="col-lg-4">
          {/* Objectives Progress */}
          {currentObjective && (
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-bullseye me-2"></i>Objectifs du mois
              </div>
              <div class="card-body">
                {currentObjective.progress.revenue.target !== null && (
                  <ProgressBar
                    label="Chiffre d'affaires"
                    actual={currentObjective.progress.revenue.actual}
                    target={currentObjective.progress.revenue.target}
                    percentage={currentObjective.progress.revenue.percentage}
                  />
                )}
                {currentObjective.progress.leads.target !== null && (
                  <ProgressBar
                    label="Leads crees"
                    actual={currentObjective.progress.leads.actual}
                    target={currentObjective.progress.leads.target}
                    percentage={currentObjective.progress.leads.percentage}
                  />
                )}
                {currentObjective.progress.conversions.target !== null && (
                  <ProgressBar
                    label="Conversions"
                    actual={currentObjective.progress.conversions.actual}
                    target={currentObjective.progress.conversions.target}
                    percentage={currentObjective.progress.conversions.percentage}
                  />
                )}
                {currentObjective.progress.activities.target !== null && (
                  <ProgressBar
                    label="Activites"
                    actual={currentObjective.progress.activities.actual}
                    target={currentObjective.progress.activities.target}
                    percentage={currentObjective.progress.activities.percentage}
                  />
                )}
                <a href="/backoffice/objectives" class="btn btn-outline-primary btn-sm w-100 mt-2">
                  Voir tous les objectifs
                </a>
              </div>
            </div>
          )}

          {/* Revenue Summary */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-currency-euro me-2"></i>Revenus
            </div>
            <div class="card-body">
              <div class="row text-center">
                <div class="col-6">
                  <div class="fs-4 fw-bold text-primary">
                    {formatCurrency(dashboard.revenue.totalValue)}
                  </div>
                  <small class="text-muted">Valeur totale leads</small>
                </div>
                <div class="col-6">
                  <div class="fs-4 fw-bold text-success">
                    {formatCurrency(dashboard.revenue.weightedValue)}
                  </div>
                  <small class="text-muted">Valeur ponderee</small>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Stats */}
          <div class="card">
            <div class="card-header">
              <i class="bi bi-activity me-2"></i>Activites par type
            </div>
            <div class="card-body p-0">
              {activityMetrics.byType.length === 0 ? (
                <div class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-3"></i>
                  <p class="mb-0">Aucune activite</p>
                </div>
              ) : (
                <ul class="list-group list-group-flush">
                  {activityMetrics.byType.map(activity => (
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                      <span>{activityTypeLabels[activity.type] || activity.type}</span>
                      <div>
                        <span class="badge bg-success me-1">{activity.completed}</span>
                        <span class="badge bg-secondary">{activity.total}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
