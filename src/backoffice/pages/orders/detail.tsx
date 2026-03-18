import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface OrderLine {
  id: string;
  productId: string | null;
  reference: string | null;
  description: string;
  quantity: number;
  unitPriceHT: string;
  tvaRate: string;
  totalHT: string;
  product: {
    id: string;
    reference: string;
    name: string;
  } | null;
}

interface OrderHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  changedAt: Date;
}

interface Order {
  id: string;
  number: string;
  status: string;
  totalHT: string;
  totalTVA: string;
  totalTTC: string;
  totalCostHT: string | null;
  totalMarginHT: string | null;
  discount: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingNotes: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  notes: string | null;
  internalNotes: string | null;
  confirmedAt: Date | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  project: { id: string; name: string };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  lines: OrderLine[];
  history: OrderHistory[];
}

interface OrderDetailPageProps {
  order: Order;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'secondary' },
  confirmee: { label: 'Confirmee', color: 'info' },
  payee: { label: 'Payee', color: 'primary' },
  en_preparation: { label: 'En preparation', color: 'warning' },
  expediee: { label: 'Expediee', color: 'info' },
  livree: { label: 'Livree', color: 'success' },
  annulee: { label: 'Annulee', color: 'danger' },
};

const nextStatuses: Record<string, string[]> = {
  en_attente: ['confirmee', 'annulee'],
  confirmee: ['payee', 'annulee'],
  payee: ['en_preparation', 'annulee'],
  en_preparation: ['expediee', 'annulee'],
  expediee: ['livree'],
};

export const OrderDetailPage: FC<OrderDetailPageProps> = ({
  order,
  success,
  error,
  user,
}) => {
  const s = statusLabels[order.status] || { label: order.status, color: 'secondary' };
  const possibleNext = nextStatuses[order.status] || [];
  const margin = order.totalCostHT && order.totalHT
    ? ((parseFloat(order.totalHT) - parseFloat(order.totalCostHT)) / parseFloat(order.totalHT) * 100)
    : null;

  return (
    <Layout title={`Commande ${order.number}`} currentPath="/backoffice/orders" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Header */}
      <div class="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 class="mb-1">{order.number}</h4>
          <span class={`badge bg-${s.color} me-2`}>{s.label}</span>
          <span class="text-muted">
            Creee le {new Date(order.createdAt).toLocaleDateString('fr-FR')}
          </span>
        </div>
        <div class="d-flex gap-2">
          <a href="/backoffice/orders" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left me-1"></i>Retour
          </a>
          {possibleNext.length > 0 && (
            <div class="dropdown">
              <button class="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown">
                Changer statut
              </button>
              <ul class="dropdown-menu">
                {possibleNext.map((st) => (
                  <li>
                    <form method="post" action={`/backoffice/orders/${order.id}/status`}>
                      <input type="hidden" name="status" value={st} />
                      <button type="submit" class="dropdown-item">
                        {statusLabels[st]?.label || st}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div class="row">
        {/* Infos principales */}
        <div class="col-md-8">
          {/* Client & Projet */}
          <div class="card mb-4">
            <div class="card-header">
              <h6 class="mb-0">Client & Projet</h6>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <strong>Client</strong>
                  <p class="mb-0">
                    {order.client.firstName} {order.client.lastName}<br />
                    {order.client.email && <small class="text-muted">{order.client.email}</small>}
                    {order.client.phone && <small class="text-muted d-block">{order.client.phone}</small>}
                  </p>
                </div>
                <div class="col-md-6">
                  <strong>Projet</strong>
                  <p class="mb-0">
                    <a href={`/backoffice/projects/${order.project.id}`}>
                      {order.project.name}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Lignes */}
          <div class="card mb-4">
            <div class="card-header">
              <h6 class="mb-0">Articles</h6>
            </div>
            <div class="card-body p-0">
              <table class="table table-sm mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Article</th>
                    <th class="text-center">Qte</th>
                    <th class="text-end">Prix unit. HT</th>
                    <th class="text-end">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr>
                      <td>
                        <div class="fw-medium">{line.description}</div>
                        {line.reference && <small class="text-muted">Ref: {line.reference}</small>}
                      </td>
                      <td class="text-center">{line.quantity}</td>
                      <td class="text-end">{parseFloat(line.unitPriceHT).toFixed(2)} EUR</td>
                      <td class="text-end fw-medium">{parseFloat(line.totalHT).toFixed(2)} EUR</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot class="table-light">
                  {order.discount && parseFloat(order.discount) > 0 && (
                    <tr>
                      <td colSpan={3} class="text-end">Remise ({order.discount}%)</td>
                      <td class="text-end text-danger">
                        -{(parseFloat(order.totalHT) * parseFloat(order.discount) / (100 - parseFloat(order.discount))).toFixed(2)} EUR
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} class="text-end">Total HT</td>
                    <td class="text-end fw-medium">{parseFloat(order.totalHT).toFixed(2)} EUR</td>
                  </tr>
                  <tr>
                    <td colSpan={3} class="text-end">TVA</td>
                    <td class="text-end">{parseFloat(order.totalTVA).toFixed(2)} EUR</td>
                  </tr>
                  <tr>
                    <td colSpan={3} class="text-end fw-bold">Total TTC</td>
                    <td class="text-end fw-bold">{parseFloat(order.totalTTC).toFixed(2)} EUR</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Livraison */}
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between">
              <h6 class="mb-0">Livraison</h6>
              <a href={`/backoffice/orders/${order.id}/edit`} class="btn btn-sm btn-outline-primary">
                <i class="bi bi-pencil"></i>
              </a>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <strong>Adresse</strong>
                  <p class="mb-0">
                    {order.shippingAddress || '-'}<br />
                    {order.shippingPostalCode} {order.shippingCity}
                  </p>
                  {order.shippingNotes && (
                    <p class="text-muted small mt-2">{order.shippingNotes}</p>
                  )}
                </div>
                <div class="col-md-6">
                  <strong>Suivi</strong>
                  {order.carrier || order.trackingNumber ? (
                    <p class="mb-0">
                      {order.carrier && <span>Transporteur: {order.carrier}<br /></span>}
                      {order.trackingNumber && <span>N° suivi: {order.trackingNumber}</span>}
                    </p>
                  ) : (
                    <p class="text-muted mb-0">Non renseigne</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Historique */}
          <div class="card">
            <div class="card-header">
              <h6 class="mb-0">Historique</h6>
            </div>
            <div class="card-body">
              <ul class="list-unstyled mb-0">
                {order.history.map((h) => (
                  <li class="d-flex align-items-start mb-3">
                    <div class="bg-light rounded-circle p-2 me-3">
                      <i class="bi bi-clock"></i>
                    </div>
                    <div>
                      <div class="fw-medium">
                        {h.fromStatus
                          ? `${statusLabels[h.fromStatus]?.label || h.fromStatus} → ${statusLabels[h.toStatus]?.label || h.toStatus}`
                          : statusLabels[h.toStatus]?.label || h.toStatus
                        }
                      </div>
                      <small class="text-muted">
                        {new Date(h.changedAt).toLocaleString('fr-FR')}
                      </small>
                      {h.notes && <p class="mb-0 small text-muted">{h.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div class="col-md-4">
          {/* Totaux */}
          <div class="card mb-4">
            <div class="card-header">
              <h6 class="mb-0">Totaux</h6>
            </div>
            <div class="card-body">
              <div class="d-flex justify-content-between mb-2">
                <span>Total HT</span>
                <strong>{parseFloat(order.totalHT).toFixed(2)} EUR</strong>
              </div>
              <div class="d-flex justify-content-between mb-2">
                <span>TVA</span>
                <span>{parseFloat(order.totalTVA).toFixed(2)} EUR</span>
              </div>
              <hr />
              <div class="d-flex justify-content-between mb-3">
                <span class="fw-bold">Total TTC</span>
                <span class="fw-bold fs-5">{parseFloat(order.totalTTC).toFixed(2)} EUR</span>
              </div>
              {order.totalCostHT && (
                <>
                  <hr />
                  <div class="d-flex justify-content-between mb-2">
                    <span class="text-muted">Cout HT</span>
                    <span class="text-muted">{parseFloat(order.totalCostHT).toFixed(2)} EUR</span>
                  </div>
                  <div class="d-flex justify-content-between">
                    <span class="text-muted">Marge</span>
                    <span class={`badge bg-${margin && margin >= 30 ? 'success' : margin && margin >= 15 ? 'warning' : 'danger'}`}>
                      {margin?.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dates importantes */}
          <div class="card mb-4">
            <div class="card-header">
              <h6 class="mb-0">Dates</h6>
            </div>
            <div class="card-body">
              <table class="table table-sm table-borderless mb-0">
                <tbody>
                  <tr>
                    <td class="text-muted">Creee</td>
                    <td>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                  {order.confirmedAt && (
                    <tr>
                      <td class="text-muted">Confirmee</td>
                      <td>{new Date(order.confirmedAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {order.paidAt && (
                    <tr>
                      <td class="text-muted">Payee</td>
                      <td>{new Date(order.paidAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {order.shippedAt && (
                    <tr>
                      <td class="text-muted">Expediee</td>
                      <td>{new Date(order.shippedAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {order.deliveredAt && (
                    <tr>
                      <td class="text-muted">Livree</td>
                      <td>{new Date(order.deliveredAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {order.cancelledAt && (
                    <tr>
                      <td class="text-danger">Annulee</td>
                      <td class="text-danger">{new Date(order.cancelledAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          {order.status === 'payee' && (
            <div class="card">
              <div class="card-body">
                <form method="post" action="/backoffice/invoices/depuis-commande">
                  <input type="hidden" name="orderId" value={order.id} />
                  <button type="submit" class="btn btn-success w-100">
                    <i class="bi bi-receipt me-2"></i>Generer facture
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Notes */}
          {(order.notes || order.internalNotes) && (
            <div class="card mt-4">
              <div class="card-header">
                <h6 class="mb-0">Notes</h6>
              </div>
              <div class="card-body">
                {order.notes && (
                  <div class="mb-3">
                    <strong>Notes client</strong>
                    <p class="mb-0 text-muted">{order.notes}</p>
                  </div>
                )}
                {order.internalNotes && (
                  <div>
                    <strong>Notes internes</strong>
                    <p class="mb-0 text-muted">{order.internalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
