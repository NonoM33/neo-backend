import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  title: string;
  status: string;
  source: string;
  estimatedValue: string | null;
  probability: number | null;
  expectedCloseDate: Date | null;
  createdAt: Date;
}

interface ProjectCard {
  id: string;
  name: string;
  status: string;
  clientName: string;
  totalTTC: string | null;
  createdAt: Date;
  fromLead: boolean;
}

interface PipelineStats {
  status: string;
  count: number;
  totalValue: string;
  weightedValue: string;
}

interface PipelinePageProps {
  leads: Lead[];
  projects: ProjectCard[];
  stats: PipelineStats[];
  projectStats: { brouillon: number; en_cours: number; termine: number };
  search?: string;
  source?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

const stageConfig = [
  { key: 'prospect',    label: 'Prospect',    color: 'secondary', icon: 'bi-person-plus', type: 'lead' },
  { key: 'qualifie',    label: 'Qualifie',    color: 'info',      icon: 'bi-check-circle', type: 'lead' },
  { key: 'proposition', label: 'Proposition', color: 'primary',   icon: 'bi-file-earmark-text', type: 'lead' },
  { key: 'negociation', label: 'Negociation', color: 'warning',   icon: 'bi-chat-dots', type: 'lead' },
  { key: 'brouillon',   label: 'Gagne',       color: 'success',   icon: 'bi-trophy', type: 'project' },
  { key: 'en_cours',    label: 'En cours',    color: 'primary',   icon: 'bi-gear', type: 'project' },
  { key: 'termine',     label: 'Termine',     color: 'dark',      icon: 'bi-check2-all', type: 'project' },
] as const;

const leadStages = ['prospect', 'qualifie', 'proposition', 'negociation'];
const projectStages = ['brouillon', 'en_cours', 'termine'];

const sourceLabels: Record<string, string> = {
  site_web: 'Site web',
  recommandation: 'Recommandation',
  salon: 'Salon',
  publicite: 'Publicite',
  appel_entrant: 'Appel entrant',
  partenaire: 'Partenaire',
  autre: 'Autre',
};

const formatCurrency = (value: string | null) => {
  if (!value || value === '0') return '-';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(value));
};

export const PipelinePage: FC<PipelinePageProps> = ({
  leads,
  projects,
  stats,
  projectStats,
  search,
  source,
  success,
  error,
  user,
}) => {
  const leadsByStatus: Record<string, Lead[]> = {};
  leadStages.forEach(s => { leadsByStatus[s] = leads.filter(l => l.status === s); });

  const projectsByStatus: Record<string, ProjectCard[]> = {};
  projectStages.forEach(s => { projectsByStatus[s] = projects.filter(p => p.status === s); });

  const pipelineTotal = stats
    .filter(s => leadStages.includes(s.status))
    .reduce((sum, s) => sum + parseFloat(s.totalValue || '0'), 0);

  const weightedTotal = stats
    .filter(s => leadStages.includes(s.status))
    .reduce((sum, s) => sum + parseFloat(s.weightedValue || '0'), 0);

  const totalLeads = leadStages.reduce((sum, s) => sum + (leadsByStatus[s]?.length || 0), 0);
  const totalProjects = projectStages.reduce((sum, s) => sum + (projectsByStatus[s]?.length || 0), 0);

  function getStageCount(key: string): number {
    if (leadStages.includes(key)) return leadsByStatus[key]?.length || 0;
    return projectsByStatus[key]?.length || 0;
  }

  return (
    <Layout title="Pipeline Commercial" currentPath="/backoffice/crm/pipeline" user={user}>
      <style>{`
        .pipeline-board {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 16px;
        }
        .pipeline-col {
          min-width: 220px;
          flex: 1;
        }
        .pipeline-col-header {
          border-radius: 10px 10px 0 0;
          padding: 10px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .pipeline-col-body {
          background: #f8f9fa;
          border-radius: 0 0 10px 10px;
          padding: 8px;
          min-height: 120px;
          max-height: 500px;
          overflow-y: auto;
        }
        .pipeline-card {
          background: #fff;
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 8px;
          border-left: 3px solid transparent;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          text-decoration: none;
          display: block;
          transition: transform 0.15s, box-shadow 0.15s;
          color: inherit;
        }
        .pipeline-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          color: inherit;
        }
        .pipeline-card-lead { border-left-color: #6c757d; }
        .pipeline-card-project { border-left-color: #0d6efd; }
        .pipeline-divider {
          display: flex;
          align-items: center;
          padding: 0 4px;
          color: #dee2e6;
        }
        .pipeline-summary {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }
        .pipeline-summary-item {
          display: flex;
          flex-direction: column;
        }
        .pipeline-summary-value {
          font-size: 1.25rem;
          font-weight: 700;
        }
        .pipeline-summary-label {
          font-size: 0.75rem;
          color: #6c757d;
        }
        .pipeline-empty {
          text-align: center;
          padding: 24px 8px;
          color: #adb5bd;
          font-size: 0.8rem;
        }
      `}</style>

      <FlashMessages success={success} error={error} />

      {/* Summary Bar */}
      <div class="card mb-4">
        <div class="card-body py-3">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div class="pipeline-summary">
              <div class="pipeline-summary-item">
                <span class="pipeline-summary-value text-secondary">{totalLeads}</span>
                <span class="pipeline-summary-label">Leads actifs</span>
              </div>
              <div class="pipeline-summary-item">
                <span class="pipeline-summary-value text-primary">{formatCurrency(pipelineTotal.toString())}</span>
                <span class="pipeline-summary-label">Valeur pipeline</span>
              </div>
              <div class="pipeline-summary-item">
                <span class="pipeline-summary-value text-success">{formatCurrency(weightedTotal.toString())}</span>
                <span class="pipeline-summary-label">Valeur ponderee</span>
              </div>
              <div class="pipeline-summary-item" style="border-left: 2px solid #dee2e6; padding-left: 24px;">
                <span class="pipeline-summary-value text-dark">{totalProjects}</span>
                <span class="pipeline-summary-label">Projets</span>
              </div>
            </div>
            <a href="/backoffice/crm/leads/new" class="btn btn-primary">
              <i class="bi bi-plus-lg me-2"></i>Nouveau Lead
            </a>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div class="card mb-4">
        <div class="card-body py-2">
          <form method="get" class="row g-2 align-items-end">
            <div class="col-md-4">
              <input
                type="text"
                name="search"
                class="form-control form-control-sm"
                placeholder="Rechercher un lead ou projet..."
                value={search || ''}
              />
            </div>
            <div class="col-md-3">
              <select name="source" class="form-select form-select-sm">
                <option value="">Toutes les sources</option>
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option value={value} selected={value === source}>{label}</option>
                ))}
              </select>
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-search me-1"></i>Filtrer
              </button>
              {(search || source) && (
                <a href="/backoffice/crm/pipeline" class="btn btn-sm btn-outline-secondary ms-2">
                  <i class="bi bi-x-lg"></i>
                </a>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Kanban Board - Unified Pipeline */}
      <div class="pipeline-board">
        {stageConfig.map((stage, idx) => {
          const count = getStageCount(stage.key);
          const isLeadStage = stage.type === 'lead';
          const showDivider = stage.key === 'brouillon';

          return (
            <>
              {showDivider && (
                <div class="pipeline-divider">
                  <div style="writing-mode: vertical-lr; transform: rotate(180deg); font-size: 0.7rem; letter-spacing: 1px; text-transform: uppercase; color: #adb5bd;">
                    Conversion
                  </div>
                </div>
              )}
              <div class="pipeline-col">
                <div class={`pipeline-col-header bg-${stage.color} bg-opacity-10`}>
                  <span class={`badge bg-${stage.color}`}>
                    <i class={`bi ${stage.icon} me-1`}></i>
                    {stage.label}
                  </span>
                  <span class={`badge bg-${stage.color}`}>{count}</span>
                </div>
                <div class="pipeline-col-body">
                  {isLeadStage ? (
                    (leadsByStatus[stage.key]?.length || 0) === 0 ? (
                      <div class="pipeline-empty">
                        <i class="bi bi-inbox d-block mb-1" style="font-size:1.5rem;"></i>
                        Aucun lead
                      </div>
                    ) : (
                      leadsByStatus[stage.key]?.map(lead => (
                        <a href={`/backoffice/crm/leads/${lead.id}`} class="pipeline-card pipeline-card-lead">
                          <div class="fw-medium" style="font-size:0.85rem;">{lead.title}</div>
                          <div class="text-muted" style="font-size:0.75rem;">
                            {lead.firstName} {lead.lastName}
                            {lead.company && ` · ${lead.company}`}
                          </div>
                          <div class="d-flex justify-content-between align-items-center mt-1">
                            <span class="fw-bold text-primary" style="font-size:0.8rem;">
                              {formatCurrency(lead.estimatedValue)}
                            </span>
                            {lead.probability !== null && (
                              <span class="badge bg-light text-dark" style="font-size:0.65rem;">
                                {lead.probability}%
                              </span>
                            )}
                          </div>
                        </a>
                      ))
                    )
                  ) : (
                    (projectsByStatus[stage.key]?.length || 0) === 0 ? (
                      <div class="pipeline-empty">
                        <i class="bi bi-inbox d-block mb-1" style="font-size:1.5rem;"></i>
                        Aucun projet
                      </div>
                    ) : (
                      projectsByStatus[stage.key]?.map(proj => (
                        <a href={`/backoffice/projects/${proj.id}`} class="pipeline-card pipeline-card-project">
                          <div class="fw-medium" style="font-size:0.85rem;">{proj.name}</div>
                          <div class="text-muted" style="font-size:0.75rem;">
                            {proj.clientName}
                          </div>
                          <div class="d-flex justify-content-between align-items-center mt-1">
                            <span class="fw-bold text-primary" style="font-size:0.8rem;">
                              {formatCurrency(proj.totalTTC)}
                            </span>
                            {proj.fromLead && (
                              <span class="badge bg-success bg-opacity-10 text-success" style="font-size:0.6rem;">
                                <i class="bi bi-funnel me-1"></i>CRM
                              </span>
                            )}
                          </div>
                        </a>
                      ))
                    )
                  )}
                </div>
              </div>
            </>
          );
        })}
      </div>

      {/* Legend */}
      <div class="d-flex gap-4 mt-3 justify-content-center">
        <div class="d-flex align-items-center gap-2" style="font-size:0.75rem;color:#6c757d;">
          <div style="width:12px;height:12px;border-radius:3px;border-left:3px solid #6c757d;background:#f8f9fa;"></div>
          Lead commercial
        </div>
        <div class="d-flex align-items-center gap-2" style="font-size:0.75rem;color:#6c757d;">
          <div style="width:12px;height:12px;border-radius:3px;border-left:3px solid #0d6efd;background:#f8f9fa;"></div>
          Projet
        </div>
        <div class="d-flex align-items-center gap-2" style="font-size:0.75rem;color:#6c757d;">
          <span class="badge bg-success bg-opacity-10 text-success" style="font-size:0.6rem;">CRM</span>
          Converti depuis un lead
        </div>
      </div>
    </Layout>
  );
};
