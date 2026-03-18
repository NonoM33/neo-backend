import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface InvoiceLine {
  id: string;
  reference: string | null;
  description: string;
  quantity: number;
  unitPriceHT: string;
  tvaRate: string;
  totalHT: string;
}

interface Invoice {
  id: string;
  number: string;
  orderId: string | null;
  status: string;
  totalHT: string;
  totalTVA: string;
  totalTTC: string;
  dueDate: Date | null;
  paymentTerms: string | null;
  paymentMethod: string | null;
  legalMentions: string | null;
  pdfUrl: string | null;
  notes: string | null;
  sentAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  isOverdue: boolean;
  project: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    postalCode: string | null;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
  };
  lines: InvoiceLine[];
}

interface InvoiceDetailPageProps {
  invoice: Invoice;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'secondary' },
  envoyee: { label: 'Envoyee', color: 'info' },
  payee: { label: 'Payee', color: 'success' },
  annulee: { label: 'Annulee', color: 'danger' },
};

const nextStatuses: Record<string, string[]> = {
  brouillon: ['envoyee', 'annulee'],
  envoyee: ['payee', 'annulee'],
};

export const InvoiceDetailPage: FC<InvoiceDetailPageProps> = ({
  invoice,
  success,
  error,
  user,
}) => {
  const s = statusLabels[invoice.status] || { label: invoice.status, color: 'secondary' };
  const possibleNext = nextStatuses[invoice.status] || [];

  return (
    <Layout title={`Facture ${invoice.number}`} currentPath="/backoffice/invoices" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Header */}
      <div class="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 class="mb-1">{invoice.number}</h4>
          <span class={`badge bg-${s.color} me-2`}>{s.label}</span>
          {invoice.isOverdue && <span class="badge bg-danger me-2">En retard</span>}
          <span class="text-muted">
            Creee le {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
          </span>
        </div>
        <div class="d-flex gap-2">
          <a href="/backoffice/invoices" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Retour
          </a>
          {possibleNext.length > 0 && (
            <div class="dropdown">
              <button class="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown">
                Actions
              </button>
              <ul class="dropdown-menu">
                {possibleNext.map((st) => (
                  <li>
                    <form method="post" action={`/backoffice/invoices/${invoice.id}/status`}>
                      <input type="hidden" name="status" value={st} />
                      <button type="submit" class="dropdown-item">
                        {st === 'envoyee' && <i class="bi bi-send me-2"></i>}
                        {st === 'payee' && <i class="bi bi-check-circle me-2"></i>}
                        {st === 'annulee' && <i class="bi bi-x-circle me-2"></i>}
                        {statusLabels[st]?.label || st}
                      </button>
                    </form>
                  </li>
                ))}
                {invoice.pdfUrl && (
                  <>
                    <li><hr class="dropdown-divider" /></li>
                    <li>
                      <a href={invoice.pdfUrl} class="dropdown-item" target="_blank">
                        <i class="bi bi-file-pdf me-2"></i>Telecharger PDF
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div class="row">
        <div class="col-md-8">
          {/* Client */}
          <div class="card mb-4">
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-muted mb-2">Facture a</h6>
                  <strong>{invoice.client.firstName} {invoice.client.lastName}</strong>
                  {invoice.client.address && <p class="mb-0">{invoice.client.address}</p>}
                  {(invoice.client.postalCode || invoice.client.city) && (
                    <p class="mb-0">{invoice.client.postalCode} {invoice.client.city}</p>
                  )}
                  {invoice.client.email && <p class="mb-0 text-muted">{invoice.client.email}</p>}
                </div>
                <div class="col-md-6 text-end">
                  <h6 class="text-muted mb-2">Projet</h6>
                  <p class="mb-0">
                    <a href={`/backoffice/projects/${invoice.project.id}`}>
                      {invoice.project.name}
                    </a>
                  </p>
                  {invoice.project.address && <p class="mb-0 small text-muted">{invoice.project.address}</p>}
                  {invoice.orderId && (
                    <p class="mb-0 mt-2">
                      <a href={`/backoffice/orders/${invoice.orderId}`} class="btn btn-sm btn-outline-primary">
                        Voir commande
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lignes */}
          <div class="card mb-4">
            <div class="card-body p-0">
              <table class="table table-sm mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Description</th>
                    <th class="text-center">Qte</th>
                    <th class="text-end">Prix unit. HT</th>
                    <th class="text-center">TVA</th>
                    <th class="text-end">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr>
                      <td>
                        <div>{line.description}</div>
                        {line.reference && <small class="text-muted">Ref: {line.reference}</small>}
                      </td>
                      <td class="text-center">{line.quantity}</td>
                      <td class="text-end">{parseFloat(line.unitPriceHT).toFixed(2)} EUR</td>
                      <td class="text-center">{line.tvaRate}%</td>
                      <td class="text-end fw-medium">{parseFloat(line.totalHT).toFixed(2)} EUR</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot class="table-light">
                  <tr>
                    <td colSpan={4} class="text-end">Total HT</td>
                    <td class="text-end fw-medium">{parseFloat(invoice.totalHT).toFixed(2)} EUR</td>
                  </tr>
                  <tr>
                    <td colSpan={4} class="text-end">TVA</td>
                    <td class="text-end">{parseFloat(invoice.totalTVA).toFixed(2)} EUR</td>
                  </tr>
                  <tr>
                    <td colSpan={4} class="text-end fw-bold">Total TTC</td>
                    <td class="text-end fw-bold fs-5">{parseFloat(invoice.totalTTC).toFixed(2)} EUR</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mentions legales */}
          {invoice.legalMentions && (
            <div class="card">
              <div class="card-header">
                <h6 class="mb-0">Mentions legales</h6>
              </div>
              <div class="card-body">
                <p class="mb-0 small text-muted" style="white-space: pre-line;">
                  {invoice.legalMentions}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div class="col-md-4">
          {/* Total */}
          <div class="card mb-4">
            <div class="card-body text-center">
              <h6 class="text-muted mb-2">Montant total</h6>
              <div class="fs-2 fw-bold">{parseFloat(invoice.totalTTC).toFixed(2)} EUR</div>
              <small class="text-muted">TTC</small>
            </div>
          </div>

          {/* Paiement */}
          <div class="card mb-4">
            <div class="card-header">
              <h6 class="mb-0">Paiement</h6>
            </div>
            <div class="card-body">
              <table class="table table-sm table-borderless mb-0">
                <tbody>
                  {invoice.paymentTerms && (
                    <tr>
                      <td class="text-muted">Conditions</td>
                      <td>{invoice.paymentTerms}</td>
                    </tr>
                  )}
                  {invoice.dueDate && (
                    <tr>
                      <td class="text-muted">Echeance</td>
                      <td class={invoice.isOverdue ? 'text-danger fw-medium' : ''}>
                        {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  )}
                  {invoice.paymentMethod && (
                    <tr>
                      <td class="text-muted">Mode</td>
                      <td>{invoice.paymentMethod}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dates */}
          <div class="card">
            <div class="card-header">
              <h6 class="mb-0">Historique</h6>
            </div>
            <div class="card-body">
              <table class="table table-sm table-borderless mb-0">
                <tbody>
                  <tr>
                    <td class="text-muted">Creee</td>
                    <td>{new Date(invoice.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                  {invoice.sentAt && (
                    <tr>
                      <td class="text-muted">Envoyee</td>
                      <td>{new Date(invoice.sentAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {invoice.paidAt && (
                    <tr>
                      <td class="text-success">Payee</td>
                      <td class="text-success">{new Date(invoice.paidAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {invoice.cancelledAt && (
                    <tr>
                      <td class="text-danger">Annulee</td>
                      <td class="text-danger">{new Date(invoice.cancelledAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
