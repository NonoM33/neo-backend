import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../backoffice/components';
import type { AdminUser } from '../../backoffice/middleware/admin-auth';

interface SLADefinition {
  id: string;
  name: string;
  priority: string | null;
  categoryName: string | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isDefault: boolean;
  isActive: boolean;
}

interface TicketCategory {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
}

interface CannedResponse {
  id: string;
  title: string;
  shortcut: string | null;
  isActive: boolean;
}

interface SupportSettingsProps {
  slaDefinitions: SLADefinition[];
  ticketCategories: TicketCategory[];
  cannedResponses: CannedResponse[];
  success?: string;
  error?: string;
  user: AdminUser;
}

const priorityLabels: Record<string, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
  critique: 'Critique',
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}j ${remainingHours}h` : `${days}j`;
};

export const SupportSettingsPage: FC<SupportSettingsProps> = ({
  slaDefinitions,
  ticketCategories,
  cannedResponses,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Parametres Support" currentPath="/backoffice/support/settings" user={user}>
      <FlashMessages success={success} error={error} />

      {/* SLA Definitions */}
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center" role="button" data-bs-toggle="collapse" data-bs-target="#slaSection">
          <span>
            <i class="bi bi-clock-history me-2"></i>Definitions SLA
            <span class="badge bg-primary ms-2">{slaDefinitions.length}</span>
          </span>
          <i class="bi bi-chevron-down"></i>
        </div>
        <div class="collapse show" id="slaSection">
          <div class="card-body">
            <div class="mb-3">
              <a href="/backoffice/support/settings/sla/new" class="btn btn-sm btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvelle SLA
              </a>
            </div>
            {slaDefinitions.length === 0 ? (
              <div class="text-center text-muted py-4">
                <i class="bi bi-clock-history display-6 d-block mb-2"></i>
                <p class="mb-0">Aucune definition SLA</p>
              </div>
            ) : (
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Priorite</th>
                      <th>Categorie</th>
                      <th>Temps de reponse</th>
                      <th>Temps de resolution</th>
                      <th>Par defaut</th>
                      <th>Actif</th>
                      <th style="width: 100px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slaDefinitions.map((sla) => (
                      <tr id={`row-${sla.id}`}>
                        <td class="fw-medium">{sla.name}</td>
                        <td>{sla.priority ? (priorityLabels[sla.priority] || sla.priority) : '-'}</td>
                        <td>{sla.categoryName || '-'}</td>
                        <td>{formatDuration(sla.firstResponseMinutes)}</td>
                        <td>{formatDuration(sla.resolutionMinutes)}</td>
                        <td>
                          {sla.isDefault ? (
                            <span class="badge bg-primary">Par defaut</span>
                          ) : '-'}
                        </td>
                        <td>
                          {sla.isActive ? (
                            <span class="badge bg-success">Actif</span>
                          ) : (
                            <span class="badge bg-secondary">Inactif</span>
                          )}
                        </td>
                        <td>
                          <div class="d-flex gap-1">
                            <a
                              href={`/backoffice/support/settings/sla/${sla.id}/edit`}
                              class="btn btn-sm btn-outline-primary btn-action"
                              title="Modifier"
                            >
                              <i class="bi bi-pencil"></i>
                            </a>
                            <button
                              class="btn btn-sm btn-outline-danger btn-action"
                              title="Supprimer"
                              hx-delete={`/backoffice/support/settings/sla/${sla.id}`}
                              hx-confirm={`Supprimer la SLA "${sla.name}" ?`}
                              hx-target="closest tr"
                              hx-swap="outerHTML"
                            >
                              <i class="bi bi-trash"></i>
                            </button>
                          </div>
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

      {/* Ticket Categories */}
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center" role="button" data-bs-toggle="collapse" data-bs-target="#categoriesSection">
          <span>
            <i class="bi bi-tags me-2"></i>Categories de tickets
            <span class="badge bg-primary ms-2">{ticketCategories.length}</span>
          </span>
          <i class="bi bi-chevron-down"></i>
        </div>
        <div class="collapse show" id="categoriesSection">
          <div class="card-body">
            <div class="mb-3">
              <a href="/backoffice/support/settings/categories/new" class="btn btn-sm btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvelle categorie
              </a>
            </div>
            {ticketCategories.length === 0 ? (
              <div class="text-center text-muted py-4">
                <i class="bi bi-tags display-6 d-block mb-2"></i>
                <p class="mb-0">Aucune categorie</p>
              </div>
            ) : (
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Slug</th>
                      <th>Actif</th>
                      <th>Ordre</th>
                      <th style="width: 100px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketCategories.map((cat) => (
                      <tr id={`row-${cat.id}`}>
                        <td class="fw-medium">{cat.name}</td>
                        <td><code class="small">{cat.slug}</code></td>
                        <td>
                          {cat.isActive ? (
                            <span class="badge bg-success">Actif</span>
                          ) : (
                            <span class="badge bg-secondary">Inactif</span>
                          )}
                        </td>
                        <td>
                          <span class="badge bg-light text-dark">{cat.sortOrder}</span>
                        </td>
                        <td>
                          <div class="d-flex gap-1">
                            <a
                              href={`/backoffice/support/settings/categories/${cat.id}/edit`}
                              class="btn btn-sm btn-outline-primary btn-action"
                              title="Modifier"
                            >
                              <i class="bi bi-pencil"></i>
                            </a>
                            <button
                              class="btn btn-sm btn-outline-danger btn-action"
                              title="Supprimer"
                              hx-delete={`/backoffice/support/settings/categories/${cat.id}`}
                              hx-confirm={`Supprimer la categorie "${cat.name}" ?`}
                              hx-target="closest tr"
                              hx-swap="outerHTML"
                            >
                              <i class="bi bi-trash"></i>
                            </button>
                          </div>
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

      {/* Canned Responses */}
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center" role="button" data-bs-toggle="collapse" data-bs-target="#cannedSection">
          <span>
            <i class="bi bi-chat-square-text me-2"></i>Reponses types
            <span class="badge bg-primary ms-2">{cannedResponses.length}</span>
          </span>
          <i class="bi bi-chevron-down"></i>
        </div>
        <div class="collapse show" id="cannedSection">
          <div class="card-body">
            <div class="mb-3">
              <a href="/backoffice/support/settings/canned-responses/new" class="btn btn-sm btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouvelle reponse type
              </a>
            </div>
            {cannedResponses.length === 0 ? (
              <div class="text-center text-muted py-4">
                <i class="bi bi-chat-square-text display-6 d-block mb-2"></i>
                <p class="mb-0">Aucune reponse type</p>
              </div>
            ) : (
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Raccourci</th>
                      <th>Actif</th>
                      <th style="width: 100px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cannedResponses.map((cr) => (
                      <tr id={`row-${cr.id}`}>
                        <td class="fw-medium">{cr.title}</td>
                        <td>
                          {cr.shortcut ? (
                            <code class="small">{cr.shortcut}</code>
                          ) : '-'}
                        </td>
                        <td>
                          {cr.isActive ? (
                            <span class="badge bg-success">Actif</span>
                          ) : (
                            <span class="badge bg-secondary">Inactif</span>
                          )}
                        </td>
                        <td>
                          <div class="d-flex gap-1">
                            <a
                              href={`/backoffice/support/settings/canned-responses/${cr.id}/edit`}
                              class="btn btn-sm btn-outline-primary btn-action"
                              title="Modifier"
                            >
                              <i class="bi bi-pencil"></i>
                            </a>
                            <button
                              class="btn btn-sm btn-outline-danger btn-action"
                              title="Supprimer"
                              hx-delete={`/backoffice/support/settings/canned-responses/${cr.id}`}
                              hx-confirm={`Supprimer la reponse type "${cr.title}" ?`}
                              hx-target="closest tr"
                              hx-swap="outerHTML"
                            >
                              <i class="bi bi-trash"></i>
                            </button>
                          </div>
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
    </Layout>
  );
};
