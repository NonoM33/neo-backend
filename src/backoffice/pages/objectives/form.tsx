import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Objective {
  id: string;
  userId: string;
  year: number;
  month: number | null;
  quarter: number | null;
  revenueTarget: string | null;
  leadsTarget: number | null;
  conversionsTarget: number | null;
  activitiesTarget: number | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ObjectiveFormPageProps {
  objective?: Objective;
  commercials: User[];
  isEdit: boolean;
  error?: string;
  user: AdminUser;
}

const monthOptions = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Fevrier' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Aout' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Decembre' },
];

const quarterOptions = [
  { value: 1, label: 'T1 (Jan-Mar)' },
  { value: 2, label: 'T2 (Avr-Juin)' },
  { value: 3, label: 'T3 (Juil-Sep)' },
  { value: 4, label: 'T4 (Oct-Dec)' },
];

export const ObjectiveFormPage: FC<ObjectiveFormPageProps> = ({
  objective,
  commercials,
  isEdit,
  error,
  user,
}) => {
  const title = isEdit ? 'Modifier l\'objectif' : 'Nouvel Objectif';
  const action = isEdit ? `/backoffice/objectives/${objective?.id}` : '/backoffice/objectives';

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <Layout title={title} currentPath="/backoffice/objectives" user={user}>
      <FlashMessages error={error} />

      <div class="row">
        <div class="col-lg-8">
          <form method="post" action={action}>
            {isEdit && <input type="hidden" name="_method" value="PUT" />}

            {/* Commercial & Period */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-person me-2"></i>Commercial et Periode
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label">Commercial *</label>
                    <select name="userId" class="form-select" required>
                      <option value="">-- Selectionner --</option>
                      {commercials.map(c => (
                        <option value={c.id} selected={objective?.userId === c.id}>
                          {c.firstName} {c.lastName} ({c.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Annee *</label>
                    <select name="year" class="form-select" required>
                      {years.map(y => (
                        <option value={y} selected={objective?.year === y || (!objective && y === currentYear)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Mois</label>
                    <select name="month" class="form-select">
                      <option value="">-- Aucun (annuel ou trimestre) --</option>
                      {monthOptions.map(m => (
                        <option value={m.value} selected={objective?.month === m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Trimestre</label>
                    <select name="quarter" class="form-select">
                      <option value="">-- Aucun (annuel ou mois) --</option>
                      {quarterOptions.map(q => (
                        <option value={q.value} selected={objective?.quarter === q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                    <small class="text-muted">Si mois et trimestre sont vides, l'objectif est annuel</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Targets */}
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-bullseye me-2"></i>Objectifs Cibles
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">
                      <i class="bi bi-currency-euro me-1"></i>
                      Chiffre d'Affaires (EUR)
                    </label>
                    <input
                      type="number"
                      name="revenueTarget"
                      class="form-control"
                      value={objective?.revenueTarget || ''}
                      min="0"
                      step="0.01"
                      placeholder="Ex: 50000"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">
                      <i class="bi bi-funnel me-1"></i>
                      Nombre de Leads
                    </label>
                    <input
                      type="number"
                      name="leadsTarget"
                      class="form-control"
                      value={objective?.leadsTarget ?? ''}
                      min="0"
                      placeholder="Ex: 20"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">
                      <i class="bi bi-trophy me-1"></i>
                      Nombre de Conversions
                    </label>
                    <input
                      type="number"
                      name="conversionsTarget"
                      class="form-control"
                      value={objective?.conversionsTarget ?? ''}
                      min="0"
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">
                      <i class="bi bi-activity me-1"></i>
                      Nombre d'Activites
                    </label>
                    <input
                      type="number"
                      name="activitiesTarget"
                      class="form-control"
                      value={objective?.activitiesTarget ?? ''}
                      min="0"
                      placeholder="Ex: 50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-check-lg me-2"></i>
                {isEdit ? 'Enregistrer' : 'Creer l\'objectif'}
              </button>
              <a href="/backoffice/objectives" class="btn btn-outline-secondary">
                Annuler
              </a>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div class="col-lg-4">
          <div class="card bg-light mb-4">
            <div class="card-body">
              <h6 class="card-title">
                <i class="bi bi-lightbulb me-2"></i>Conseils
              </h6>
              <ul class="small mb-0">
                <li class="mb-2">
                  Definissez des objectifs realistes mais ambitieux
                </li>
                <li class="mb-2">
                  Les objectifs mensuels permettent un suivi plus fin
                </li>
                <li class="mb-2">
                  La progression est visible dans le tableau de bord KPI
                </li>
                <li>
                  Les commerciaux voient leurs propres objectifs dans l'app
                </li>
              </ul>
            </div>
          </div>

          <div class="card bg-info bg-opacity-10">
            <div class="card-body">
              <h6 class="card-title">
                <i class="bi bi-info-circle me-2"></i>Periodes
              </h6>
              <p class="small mb-2">
                <strong>Mensuel:</strong> Selectionnez un mois specifique
              </p>
              <p class="small mb-2">
                <strong>Trimestriel:</strong> Selectionnez un trimestre
              </p>
              <p class="small mb-0">
                <strong>Annuel:</strong> Laissez mois et trimestre vides
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
