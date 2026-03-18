import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../backoffice/components';
import type { AdminUser } from '../../backoffice/middleware/admin-auth';

interface TicketDetailProps {
  ticket: {
    id: string;
    number: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    source: string;
    slaBreached: boolean;
    escalationLevel: number;
    tags: string[] | null;
    aiDiagnosis: string | null;
    troubleshootingSteps: any;
    satisfactionRating: number | null;
    satisfactionComment: string | null;
    firstResponseDueAt: Date | null;
    resolutionDueAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    clientName: string;
    clientEmail: string;
    projectName: string | null;
    deviceName: string | null;
    roomName: string | null;
    assigneeName: string | null;
    assigneeId: string | null;
    categoryName: string | null;
    chatSessionId: string | null;
  };
  comments: Array<{
    id: string;
    authorType: string;
    authorId: string | null;
    type: string;
    content: string;
    authorName: string;
    createdAt: Date;
  }>;
  history: Array<{
    id: string;
    changeType: string;
    field: string | null;
    oldValue: string | null;
    newValue: string | null;
    changedByName: string;
    createdAt: Date;
  }>;
  assignees: Array<{ id: string; name: string }>;
  cannedResponses: Array<{ id: string; title: string; content: string }>;
  chatTranscript: Array<{ role: string; content: string | null; toolName: string | null; createdAt: Date }> | null;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  nouveau: 'info',
  ouvert: 'primary',
  en_attente_client: 'warning',
  en_attente_interne: 'secondary',
  escalade: 'danger',
  resolu: 'success',
  ferme: 'dark',
};

const statusLabels: Record<string, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_attente_client: 'Attente client',
  en_attente_interne: 'Attente interne',
  escalade: 'Escalade',
  resolu: 'Resolu',
  ferme: 'Ferme',
};

const priorityColors: Record<string, string> = {
  basse: 'secondary',
  normale: 'info',
  haute: 'warning',
  urgente: 'danger',
  critique: 'dark',
};

const priorityLabels: Record<string, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
  critique: 'Critique',
};

const sourceLabels: Record<string, string> = {
  email: 'Email',
  chat: 'Chat',
  telephone: 'Telephone',
  web: 'Web',
  api: 'API',
};

const formatDateTime = (date: Date): string => {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getCommentBgClass = (type: string): string => {
  if (type === 'interne') return 'bg-warning bg-opacity-10 border-start border-warning border-3';
  return '';
};

const getCommentAuthorClass = (authorType: string): string => {
  switch (authorType) {
    case 'client':
      return 'text-primary';
    case 'staff':
      return 'text-success';
    case 'ai':
      return 'text-purple';
    default:
      return 'text-muted';
  }
};

const getCommentAlignment = (authorType: string): string => {
  switch (authorType) {
    case 'client':
      return 'me-auto';
    case 'staff':
      return 'ms-auto';
    case 'ai':
      return 'mx-auto';
    default:
      return '';
  }
};

export const TicketDetailPage: FC<TicketDetailProps> = ({
  ticket,
  comments,
  history,
  assignees,
  cannedResponses,
  chatTranscript,
  success,
  error,
  user,
}) => {
  return (
    <Layout title={`Ticket ${ticket.number}`} currentPath="/backoffice/support/tickets" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Header */}
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div>
          <div class="d-flex align-items-center gap-2 mb-2">
            <a href="/backoffice/support/tickets" class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-arrow-left me-1"></i>Retour
            </a>
            <h4 class="mb-0">{ticket.number} - {ticket.title}</h4>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <span class={`badge bg-${statusColors[ticket.status] || 'secondary'}`}>
              {statusLabels[ticket.status] || ticket.status}
            </span>
            <span
              class={`badge ${
                ticket.priority === 'critique'
                  ? 'bg-danger text-white'
                  : `bg-${priorityColors[ticket.priority] || 'secondary'}`
              }`}
            >
              {priorityLabels[ticket.priority] || ticket.priority}
            </span>
            <span class="badge bg-light text-dark">
              <i class="bi bi-inbox me-1"></i>
              {sourceLabels[ticket.source] || ticket.source}
            </span>
            {ticket.escalationLevel > 0 && (
              <span class="badge bg-danger">
                <i class="bi bi-arrow-up-circle me-1"></i>
                Niveau {ticket.escalationLevel}
              </span>
            )}
          </div>
        </div>
        <div class="text-end">
          {ticket.slaBreached ? (
            <div class="text-danger fw-bold">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>SLA depasse
            </div>
          ) : ticket.resolutionDueAt ? (
            <div class="text-muted small">
              <i class="bi bi-clock me-1"></i>
              Resolution prevue : {formatDateTime(ticket.resolutionDueAt)}
            </div>
          ) : null}
          {ticket.firstResponseDueAt && !ticket.slaBreached && (
            <div class="text-muted small">
              <i class="bi bi-reply me-1"></i>
              Premiere reponse : {formatDateTime(ticket.firstResponseDueAt)}
            </div>
          )}
        </div>
      </div>

      <div class="row g-4">
        {/* Left Column */}
        <div class="col-lg-8">
          {/* Description */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-text-paragraph me-2"></i>Description
            </div>
            <div class="card-body">
              <div style="white-space: pre-wrap;">{ticket.description}</div>
            </div>
          </div>

          {/* AI Diagnosis */}
          {ticket.aiDiagnosis && (
            <div class="card mb-4 border-start border-purple border-3">
              <div class="card-header">
                <i class="bi bi-robot me-2"></i>Diagnostic IA
              </div>
              <div class="card-body">
                <div style="white-space: pre-wrap;">{ticket.aiDiagnosis}</div>
                {ticket.troubleshootingSteps && (
                  <div class="mt-3">
                    <h6>Etapes de depannage :</h6>
                    {Array.isArray(ticket.troubleshootingSteps) ? (
                      <ol class="mb-0">
                        {(ticket.troubleshootingSteps as string[]).map((step: string) => (
                          <li>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <div style="white-space: pre-wrap;">
                        {JSON.stringify(ticket.troubleshootingSteps, null, 2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabs: Comments / Chat / History */}
          <ul class="nav nav-tabs mb-0" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active" id="comments-tab" data-bs-toggle="tab" data-bs-target="#comments-pane" type="button" role="tab">
                <i class="bi bi-chat-dots me-1"></i>Commentaires ({comments.length})
              </button>
            </li>
            {ticket.chatSessionId && chatTranscript && (
              <li class="nav-item" role="presentation">
                <button class="nav-link" id="chat-tab" data-bs-toggle="tab" data-bs-target="#chat-pane" type="button" role="tab">
                  <i class="bi bi-chat-left-text me-1"></i>Conversation chat
                </button>
              </li>
            )}
            <li class="nav-item" role="presentation">
              <button class="nav-link" id="history-tab" data-bs-toggle="tab" data-bs-target="#history-pane" type="button" role="tab">
                <i class="bi bi-clock-history me-1"></i>Historique ({history.length})
              </button>
            </li>
          </ul>

          <div class="tab-content">
            {/* Comments Tab */}
            <div class="tab-pane fade show active" id="comments-pane" role="tabpanel">
              <div class="card border-top-0 rounded-top-0">
                <div class="card-body">
                  {/* Comments thread */}
                  {comments.length === 0 ? (
                    <p class="text-muted text-center py-3">Aucun commentaire</p>
                  ) : (
                    <div class="d-flex flex-column gap-3 mb-4">
                      {comments.map((comment) => (
                        <div class={`card ${getCommentBgClass(comment.type)} ${getCommentAlignment(comment.authorType)}`} style="max-width: 85%;">
                          <div class="card-body py-2 px-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                              <span class={`fw-medium small ${getCommentAuthorClass(comment.authorType)}`}>
                                {comment.authorType === 'ai' && <i class="bi bi-robot me-1"></i>}
                                {comment.authorType === 'client' && <i class="bi bi-person me-1"></i>}
                                {comment.authorType === 'staff' && <i class="bi bi-headset me-1"></i>}
                                {comment.authorName}
                              </span>
                              <span class="text-muted small ms-3">
                                {formatDateTime(comment.createdAt)}
                              </span>
                            </div>
                            <div style="white-space: pre-wrap;">{comment.content}</div>
                            {comment.type === 'interne' && (
                              <span class="badge bg-warning text-dark small mt-1">Note interne</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment form */}
                  <hr />
                  <form method="post" action={`/backoffice/support/tickets/${ticket.id}/comments`}>
                    <div class="mb-3">
                      <label class="form-label fw-medium">Ajouter un commentaire</label>
                      {cannedResponses.length > 0 && (
                        <div class="mb-2">
                          <select class="form-select form-select-sm" id="cannedResponseSelect" style="max-width: 300px;">
                            <option value="">Inserer une reponse type...</option>
                            {cannedResponses.map((cr) => (
                              <option value={cr.content}>{cr.title}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <textarea
                        name="content"
                        id="commentContent"
                        class="form-control"
                        rows={4}
                        required
                        placeholder="Votre commentaire..."
                      ></textarea>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" name="type" value="interne" id="commentType" />
                        <label class="form-check-label" for="commentType">
                          Note interne (invisible pour le client)
                        </label>
                      </div>
                      <button type="submit" class="btn btn-primary">
                        <i class="bi bi-send me-1"></i>Envoyer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Chat Transcript Tab */}
            {ticket.chatSessionId && chatTranscript && (
              <div class="tab-pane fade" id="chat-pane" role="tabpanel">
                <div class="card border-top-0 rounded-top-0">
                  <div class="card-body">
                    {chatTranscript.length === 0 ? (
                      <p class="text-muted text-center py-3">Aucun message</p>
                    ) : (
                      <div class="d-flex flex-column gap-2">
                        {chatTranscript.map((msg) => (
                          <div class={`d-flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                            <div
                              class={`card ${
                                msg.role === 'user'
                                  ? 'bg-primary text-white'
                                  : msg.role === 'assistant'
                                    ? 'bg-light'
                                    : 'bg-warning bg-opacity-10'
                              }`}
                              style="max-width: 75%;"
                            >
                              <div class="card-body py-2 px-3">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                  <span class="fw-medium small">
                                    {msg.role === 'user' ? 'Client' : msg.role === 'assistant' ? 'Assistant IA' : 'Outil'}
                                  </span>
                                  <span class={`small ms-3 ${msg.role === 'user' ? 'text-white-50' : 'text-muted'}`}>
                                    {formatDateTime(msg.createdAt)}
                                  </span>
                                </div>
                                {msg.toolName && (
                                  <div class="small text-muted mb-1">
                                    <i class="bi bi-gear me-1"></i>{msg.toolName}
                                  </div>
                                )}
                                {msg.content && (
                                  <div style="white-space: pre-wrap;">{msg.content}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            <div class="tab-pane fade" id="history-pane" role="tabpanel">
              <div class="card border-top-0 rounded-top-0">
                <div class="card-body p-0">
                  {history.length === 0 ? (
                    <p class="text-muted text-center py-4">Aucun historique</p>
                  ) : (
                    <div class="table-responsive">
                      <table class="table table-hover align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Action</th>
                            <th>Champ</th>
                            <th>Ancienne valeur</th>
                            <th>Nouvelle valeur</th>
                            <th>Par</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((entry) => (
                            <tr>
                              <td class="text-muted small">{formatDateTime(entry.createdAt)}</td>
                              <td>
                                <span class="badge bg-light text-dark">{entry.changeType}</span>
                              </td>
                              <td>{entry.field || '-'}</td>
                              <td class="text-muted">{entry.oldValue || '-'}</td>
                              <td class="fw-medium">{entry.newValue || '-'}</td>
                              <td>{entry.changedByName}</td>
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
        </div>

        {/* Right Sidebar */}
        <div class="col-lg-4">
          {/* Info Card */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-info-circle me-2"></i>Informations
            </div>
            <div class="card-body">
              <dl class="row mb-0">
                <dt class="col-sm-5 text-muted">Client</dt>
                <dd class="col-sm-7">
                  <div class="fw-medium">{ticket.clientName}</div>
                  <small class="text-muted">{ticket.clientEmail}</small>
                </dd>

                <dt class="col-sm-5 text-muted">Projet</dt>
                <dd class="col-sm-7">{ticket.projectName || '-'}</dd>

                <dt class="col-sm-5 text-muted">Equipement</dt>
                <dd class="col-sm-7">{ticket.deviceName || '-'}</dd>

                <dt class="col-sm-5 text-muted">Piece</dt>
                <dd class="col-sm-7">{ticket.roomName || '-'}</dd>

                <dt class="col-sm-5 text-muted">Categorie</dt>
                <dd class="col-sm-7">{ticket.categoryName || '-'}</dd>

                <dt class="col-sm-5 text-muted">Cree le</dt>
                <dd class="col-sm-7">{formatDateTime(ticket.createdAt)}</dd>

                {ticket.resolvedAt && (
                  <>
                    <dt class="col-sm-5 text-muted">Resolu le</dt>
                    <dd class="col-sm-7">{formatDateTime(ticket.resolvedAt)}</dd>
                  </>
                )}

                {ticket.closedAt && (
                  <>
                    <dt class="col-sm-5 text-muted">Ferme le</dt>
                    <dd class="col-sm-7">{formatDateTime(ticket.closedAt)}</dd>
                  </>
                )}

                {ticket.tags && ticket.tags.length > 0 && (
                  <>
                    <dt class="col-sm-5 text-muted">Tags</dt>
                    <dd class="col-sm-7">
                      <div class="d-flex flex-wrap gap-1">
                        {ticket.tags.map((tag) => (
                          <span class="badge bg-light text-dark">{tag}</span>
                        ))}
                      </div>
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Actions Card */}
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-lightning me-2"></i>Actions
            </div>
            <div class="card-body">
              {/* Change Status */}
              <form method="post" action={`/backoffice/support/tickets/${ticket.id}/status`} class="mb-3">
                <label class="form-label small text-muted">Changer le statut</label>
                <div class="input-group">
                  <select name="status" class="form-select">
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option value={value} selected={value === ticket.status}>{label}</option>
                    ))}
                  </select>
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-check-lg"></i>
                  </button>
                </div>
              </form>

              {/* Assign */}
              <form method="post" action={`/backoffice/support/tickets/${ticket.id}/assign`} class="mb-3">
                <label class="form-label small text-muted">Assigner a</label>
                <div class="input-group">
                  <select name="assigneeId" class="form-select">
                    <option value="">Non assigne</option>
                    {assignees.map((a) => (
                      <option value={a.id} selected={a.id === ticket.assigneeId}>{a.name}</option>
                    ))}
                  </select>
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-check-lg"></i>
                  </button>
                </div>
              </form>

              {/* Escalate */}
              <form method="post" action={`/backoffice/support/tickets/${ticket.id}/escalate`}>
                <button type="submit" class="btn btn-outline-danger w-100">
                  <i class="bi bi-arrow-up-circle me-2"></i>
                  Escalader (niveau {ticket.escalationLevel + 1})
                </button>
              </form>
            </div>
          </div>

          {/* Satisfaction Card */}
          {ticket.satisfactionRating !== null && (
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-star me-2"></i>Satisfaction client
              </div>
              <div class="card-body text-center">
                <div class="mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <i
                      class={`bi ${
                        star <= (ticket.satisfactionRating || 0)
                          ? 'bi-star-fill text-warning'
                          : 'bi-star text-muted'
                      } fs-4`}
                    ></i>
                  ))}
                </div>
                <div class="fw-medium">{ticket.satisfactionRating}/5</div>
                {ticket.satisfactionComment && (
                  <div class="mt-2 text-muted small fst-italic">
                    "{ticket.satisfactionComment}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Script for canned responses */}
      <script>{`
        document.addEventListener('DOMContentLoaded', function() {
          var select = document.getElementById('cannedResponseSelect');
          var textarea = document.getElementById('commentContent');
          if (select && textarea) {
            select.addEventListener('change', function() {
              if (this.value) {
                textarea.value = textarea.value ? textarea.value + '\\n\\n' + this.value : this.value;
                this.value = '';
                textarea.focus();
              }
            });
          }
        });
      `}</script>
    </Layout>
  );
};
