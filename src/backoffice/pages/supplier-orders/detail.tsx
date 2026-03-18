import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface SupplierOrderLine {
  id: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPriceHT: string;
  totalHT: string;
  notes: string | null;
  product: {
    id: string;
    reference: string;
    name: string;
    stock: number | null;
    stockMin: number | null;
  };
}

interface SupplierOrder {
  id: string;
  number: string;
  status: string;
  totalHT: string;
  totalTVA: string;
  totalTTC: string;
  expectedDeliveryDate: Date | null;
  supplierReference: string | null;
  notes: string | null;
  internalNotes: string | null;
  sentAt: Date | null;
  confirmedAt: Date | null;
  receivedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    contactName: string | null;
    contactEmail: string | null;
  };
  lines: SupplierOrderLine[];
}

interface SupplierOrderDetailPageProps {
  order: SupplierOrder;
  success?: string;
  error?: string;
  user: AdminUser;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'secondary' },
  envoyee: { label: 'Envoyee', color: 'info' },
  confirmee: { label: 'Confirmee', color: 'primary' },
  recue: { label: 'Recue', color: 'success' },
  annulee: { label: 'Annulee', color: 'danger' },
};

const nextStatuses: Record<string, string[]> = {
  brouillon: ['envoyee', 'annulee'],
  envoyee: ['confirmee', 'annulee'],
  confirmee: ['annulee'],
};

export const SupplierOrderDetailPage: FC<SupplierOrderDetailPageProps> = ({
  order,
  success,
  error,
  user,
}) => {
  const s = statusLabels[order.status] || { label: order.status, color: 'secondary' };
  const possibleNext = nextStatuses[order.status] || [];
  const canReceive = ['envoyee', 'confirmee'].includes(order.status);
  const allReceived = order.lines.every((l) => l.quantityReceived >= l.quantityOrdered);

  return (
    <Layout title={`Commande ${order.number}`} currentPath="/backoffice/supplier-orders" user={user}>
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
          <a href="/backoffice/supplier-orders" class="btn btn-outline-secondary">
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
                    <form method="post" action={`/backoffice/supplier-orders/${order.id}/status`}>
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
        <div class="col-md-8">
          {/* Fournisseur */}
          <div class="card mb-4">
            <div class="card-header">
              <h6 class="mb-0">Fournisseur</h6>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <strong>
                    <a href={`/backoffice/suppliers/${order.supplier.id}`}>
                      {order.supplier.name}
                    </a>
                  </strong>
                  {order.supplier.email && <p class="mb-0 text-muted">{order.supplier.email}</p>}
                  {order.supplier.phone && <p class="mb-0 text-muted">{order.supplier.phone}</p>}
                </div>
                <div class="col-md-6">
                  {order.supplier.contactName && (
                    <>
                      <strong>Contact</strong>
                      <p class="mb-0">{order.supplier.contactName}</p>
                      {order.supplier.contactEmail && <p class="mb-0 text-muted">{order.supplier.contactEmail}</p>}
                    </>
                  )}
                </div>
              </div>
              {order.supplierReference && (
                <div class="mt-3">
                  <strong>Reference fournisseur:</strong> {order.supplierReference}
                </div>
              )}
            </div>
          </div>

          {/* Lignes */}
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0">Articles</h6>
              {canReceive && !allReceived && (
                <button
                  class="btn btn-sm btn-success"
                  data-bs-toggle="modal"
                  data-bs-target="#receptionModal"
                >
                  <i class="bi bi-box-arrow-in-down me-1"></i>Enregistrer reception
                </button>
              )}
            </div>
            <div class="card-body p-0">
              <table class="table table-sm mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Produit</th>
                    <th class="text-center">Commande</th>
                    <th class="text-center">Recu</th>
                    <th class="text-end">Prix unit.</th>
                    <th class="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr class={line.quantityReceived >= line.quantityOrdered ? 'table-success' : ''}>
                      <td>
                        <a href={`/backoffice/products/${line.product.id}/edit`} class="text-decoration-none">
                          <div class="fw-medium">{line.product.name}</div>
                          <small class="text-muted">{line.product.reference}</small>
                        </a>
                        <div class="small text-muted">
                          Stock actuel: {line.product.stock ?? 0}
                          {line.product.stockMin && ` / Min: ${line.product.stockMin}`}
                        </div>
                      </td>
                      <td class="text-center">{line.quantityOrdered}</td>
                      <td class="text-center">
                        <span class={`badge bg-${line.quantityReceived >= line.quantityOrdered ? 'success' : line.quantityReceived > 0 ? 'warning' : 'secondary'}`}>
                          {line.quantityReceived}
                        </span>
                      </td>
                      <td class="text-end">{parseFloat(line.unitPriceHT).toFixed(2)} EUR</td>
                      <td class="text-end fw-medium">{parseFloat(line.totalHT).toFixed(2)} EUR</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot class="table-light">
                  <tr>
                    <td colSpan={4} class="text-end">Total HT</td>
                    <td class="text-end fw-medium">{parseFloat(order.totalHT).toFixed(2)} EUR</td>
                  </tr>
                  <tr>
                    <td colSpan={4} class="text-end">TVA (20%)</td>
                    <td class="text-end">{parseFloat(order.totalTVA).toFixed(2)} EUR</td>
                  </tr>
                  <tr>
                    <td colSpan={4} class="text-end fw-bold">Total TTC</td>
                    <td class="text-end fw-bold">{parseFloat(order.totalTTC).toFixed(2)} EUR</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {(order.notes || order.internalNotes) && (
            <div class="card">
              <div class="card-header">
                <h6 class="mb-0">Notes</h6>
              </div>
              <div class="card-body">
                {order.notes && (
                  <div class="mb-3">
                    <strong>Notes</strong>
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

        {/* Sidebar */}
        <div class="col-md-4">
          {/* Dates */}
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
                  {order.expectedDeliveryDate && (
                    <tr>
                      <td class="text-muted">Livraison prevue</td>
                      <td>{new Date(order.expectedDeliveryDate).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {order.sentAt && (
                    <tr>
                      <td class="text-muted">Envoyee</td>
                      <td>{new Date(order.sentAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {order.confirmedAt && (
                    <tr>
                      <td class="text-muted">Confirmee</td>
                      <td>{new Date(order.confirmedAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )}
                  {order.receivedAt && (
                    <tr>
                      <td class="text-success">Recue</td>
                      <td class="text-success">{new Date(order.receivedAt).toLocaleDateString('fr-FR')}</td>
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

          {/* Totaux */}
          <div class="card">
            <div class="card-header">
              <h6 class="mb-0">Total</h6>
            </div>
            <div class="card-body text-center">
              <div class="fs-4 fw-bold">{parseFloat(order.totalTTC).toFixed(2)} EUR</div>
              <small class="text-muted">TTC</small>
            </div>
          </div>
        </div>
      </div>

      {/* Modal reception */}
      {canReceive && (
        <div class="modal fade" id="receptionModal" tabIndex={-1}>
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <form method="post" action={`/backoffice/supplier-orders/${order.id}/reception`}>
                <div class="modal-header">
                  <h5 class="modal-title">Enregistrer reception</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th class="text-center">Commande</th>
                        <th class="text-center">Deja recu</th>
                        <th class="text-center" style="width: 150px;">Quantite recue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.filter(l => l.quantityReceived < l.quantityOrdered).map((line) => (
                        <tr>
                          <td>
                            <div class="fw-medium">{line.product.name}</div>
                            <small class="text-muted">{line.product.reference}</small>
                          </td>
                          <td class="text-center">{line.quantityOrdered}</td>
                          <td class="text-center">{line.quantityReceived}</td>
                          <td>
                            <input
                              type="hidden"
                              name={`lines[${line.id}][lineId]`}
                              value={line.id}
                            />
                            <input
                              type="number"
                              name={`lines[${line.id}][quantityReceived]`}
                              class="form-control form-control-sm text-center"
                              min="0"
                              max={line.quantityOrdered - line.quantityReceived}
                              value={line.quantityOrdered - line.quantityReceived}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                  <button type="submit" class="btn btn-success">
                    <i class="bi bi-check-lg me-1"></i>Valider reception
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
