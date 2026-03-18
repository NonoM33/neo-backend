import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  reference: string;
  name: string;
  stock: number | null;
  stockMin: number | null;
  purchasePriceHT: string | null;
  supplierId: string | null;
}

interface SupplierOrderFormPageProps {
  suppliers: Supplier[];
  products: Product[];
  preselectedSupplierId?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

export const SupplierOrderFormPage: FC<SupplierOrderFormPageProps> = ({
  suppliers,
  products,
  preselectedSupplierId,
  success,
  error,
  user,
}) => {
  return (
    <Layout title="Nouvelle commande fournisseur" currentPath="/backoffice/supplier-orders" user={user}>
      <FlashMessages success={success} error={error} />

      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0">Nouvelle commande fournisseur</h4>
        <a href="/backoffice/supplier-orders" class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1"></i>Retour
        </a>
      </div>

      <form method="post" action="/backoffice/supplier-orders">
        <div class="row">
          <div class="col-md-8">
            {/* Fournisseur */}
            <div class="card mb-4">
              <div class="card-header">
                <h6 class="mb-0">Fournisseur</h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-8">
                    <label class="form-label">Fournisseur *</label>
                    <select name="supplierId" class="form-select" required id="supplierSelect">
                      <option value="">Selectionner un fournisseur</option>
                      {suppliers.map((s) => (
                        <option value={s.id} selected={s.id === preselectedSupplierId}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Reference fournisseur</label>
                    <input
                      type="text"
                      name="supplierReference"
                      class="form-control"
                      placeholder="N° commande fournisseur"
                    />
                  </div>
                </div>
                <div class="mt-3">
                  <label class="form-label">Date de livraison prevue</label>
                  <input
                    type="date"
                    name="expectedDeliveryDate"
                    class="form-control"
                    style="max-width: 200px;"
                  />
                </div>
              </div>
            </div>

            {/* Produits */}
            <div class="card mb-4">
              <div class="card-header">
                <h6 class="mb-0">Produits a commander</h6>
              </div>
              <div class="card-body">
                <div class="alert alert-info mb-3">
                  <i class="bi bi-info-circle me-2"></i>
                  Selectionnez un fournisseur pour voir les produits associes
                </div>
                <div id="productsContainer">
                  {products.length > 0 ? (
                    <table class="table table-sm">
                      <thead>
                        <tr>
                          <th style="width: 40px;">
                            <input type="checkbox" id="selectAll" />
                          </th>
                          <th>Produit</th>
                          <th class="text-center">Stock</th>
                          <th class="text-center">Min</th>
                          <th class="text-center" style="width: 100px;">Quantite</th>
                          <th class="text-end" style="width: 120px;">Prix unit. HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p, idx) => (
                          <tr>
                            <td>
                              <input
                                type="checkbox"
                                name={`lines[${idx}][selected]`}
                                value="true"
                                class="product-checkbox"
                              />
                            </td>
                            <td>
                              <input type="hidden" name={`lines[${idx}][productId]`} value={p.id} />
                              <div class="fw-medium">{p.name}</div>
                              <small class="text-muted">{p.reference}</small>
                            </td>
                            <td class="text-center">
                              <span class={`badge bg-${(p.stock ?? 0) === 0 ? 'danger' : (p.stockMin && (p.stock ?? 0) <= p.stockMin) ? 'warning' : 'success'}`}>
                                {p.stock ?? 0}
                              </span>
                            </td>
                            <td class="text-center text-muted">{p.stockMin ?? '-'}</td>
                            <td>
                              <input
                                type="number"
                                name={`lines[${idx}][quantityOrdered]`}
                                class="form-control form-control-sm text-center"
                                min="1"
                                value={p.stockMin ? Math.max(p.stockMin * 2 - (p.stock ?? 0), p.stockMin) : 1}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                name={`lines[${idx}][unitPriceHT]`}
                                class="form-control form-control-sm text-end"
                                step="0.01"
                                min="0"
                                value={p.purchasePriceHT ? parseFloat(p.purchasePriceHT).toFixed(2) : '0.00'}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p class="text-muted mb-0">Aucun produit disponible</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div class="card">
              <div class="card-header">
                <h6 class="mb-0">Notes</h6>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">Notes (visibles sur la commande)</label>
                  <textarea
                    name="notes"
                    class="form-control"
                    rows={2}
                  ></textarea>
                </div>
                <div class="mb-0">
                  <label class="form-label">Notes internes</label>
                  <textarea
                    name="internalNotes"
                    class="form-control"
                    rows={2}
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-4">
            <div class="card sticky-top" style="top: 80px;">
              <div class="card-body">
                <button type="submit" class="btn btn-primary w-100 mb-3">
                  <i class="bi bi-check-lg me-2"></i>Creer la commande
                </button>
                <p class="text-muted small mb-0">
                  La commande sera creee en statut "Brouillon".
                  Vous pourrez ensuite l'envoyer au fournisseur.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>

      <script>{`
        document.getElementById('selectAll')?.addEventListener('change', function() {
          document.querySelectorAll('.product-checkbox').forEach(cb => {
            cb.checked = this.checked;
          });
        });
      `}</script>
    </Layout>
  );
};
