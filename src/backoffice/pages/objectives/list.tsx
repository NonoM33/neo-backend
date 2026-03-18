import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Objective {
  id: string;
  userId: string;
  userName: string;
  year: number;
  month: number | null;
  quarter: number | null;
  revenueTarget: string | null;
  leadsTarget: number | null;
  conversionsTarget: number | null;
  activitiesTarget: number | null;
  createdAt: Date;
}

interface ObjectivesListPageProps {
  objectives: Objective[];
  year?: number;
  success?: string;
  error?: string;
  user: AdminUser;
}

const monthNames = [
  '', 'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

const quarterNames = ['', 'T1', 'T2', 'T3', 'T4'];

const formatCurrency = (value: string | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(value));
};

const getPeriodLabel = (obj: Objective) => {
  if (obj.month) return monthNames[obj.month];
  if (obj.quarter) return quarterNames[obj.quarter];
  return 'Annuel';
};

export const ObjectivesListPage: FC<ObjectivesListPageProps> = ({
  objectives,
  year,
  success,
  error,
  user,
}) => {
  const currentYear = new Date().getFullYear();
  const selectedYear = year || currentYear;
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Layout title="Objectifs Commerciaux" currentPath="/backoffice/objectives" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/objectives/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvel objectif
              </a>
            </div>
            <div class="col">
              <form method="get" class="row g-2">
                <div class="col-md-3">
                  <label class="form-label small text-muted">Annee</label>
                  <select name="year" class="form-select" onchange="this.form.submit()">
                    {years.map(y => (
                      <option value={y} selected={y === selectedYear}>{y}</option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-primary mb-0">{objectives.length}</h3>
              <small class="text-muted">Objectifs definis</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-success mb-0">
                {formatCurrency(
                  objectives
                    .filter(o => o.revenueTarget)
                    .reduce((sum, o) => sum + parseFloat(o.revenueTarget!), 0)
                    .toString()
                )}
              </h3>
              <small class="text-muted">CA cible total</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-info mb-0">
                {objectives
                  .filter(o => o.leadsTarget)
                  .reduce((sum, o) => sum + (o.leadsTarget || 0), 0)}
              </h3>
              <small class="text-muted">Leads cible total</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-warning mb-0">
                {objectives
                  .filter(o => o.conversionsTarget)
                  .reduce((sum, o) => sum + (o.conversionsTarget || 0), 0)}
              </h3>
              <small class="text-muted">Conversions cible total</small>
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
                key: 'userName',
                label: 'Commercial',
                render: (o: Objective) => <span class="fw-medium">{o.userName}</span>,
              },
              {
                key: 'period',
                label: 'Periode',
                render: (o: Objective) => (
                  <span>
                    {o.year} - {getPeriodLabel(o)}
                  </span>
                ),
              },
              {
                key: 'revenueTarget',
                label: 'CA Cible',
                render: (o: Objective) => formatCurrency(o.revenueTarget),
              },
              {
                key: 'leadsTarget',
                label: 'Leads',
                render: (o: Objective) => o.leadsTarget ?? '-',
              },
              {
                key: 'conversionsTarget',
                label: 'Conversions',
                render: (o: Objective) => o.conversionsTarget ?? '-',
              },
              {
                key: 'activitiesTarget',
                label: 'Activites',
                render: (o: Objective) => o.activitiesTarget ?? '-',
              },
            ]}
            data={objectives}
            emptyMessage="Aucun objectif defini pour cette annee"
            actions={(o: Objective) => (
              <TableActions
                viewUrl={`/backoffice/objectives/${o.id}`}
                editUrl={`/backoffice/objectives/${o.id}/edit`}
                deleteUrl={`/backoffice/objectives/${o.id}`}
                deleteConfirm={`Supprimer cet objectif ?`}
              />
            )}
          />
        </div>
      </div>
    </Layout>
  );
};
