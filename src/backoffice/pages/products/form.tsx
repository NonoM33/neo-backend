import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface ProductData {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  priceHT: string;
  tvaRate: string;
  imageUrl: string | null;
  isActive: boolean;
  stock: number | null;
}

interface DependencyData {
  id: string;
  type: string;
  description: string | null;
  requiredProduct: {
    id: string;
    reference: string;
    name: string;
    category: string;
    brand: string | null;
    priceHT: string;
  };
}

interface DependentData {
  id: string;
  type: string;
  product: {
    id: string;
    reference: string;
    name: string;
    category: string;
    brand: string | null;
  };
}

interface AvailableProduct {
  id: string;
  reference: string;
  name: string;
  brand: string | null;
  category: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ProductFormPageProps {
  productData?: ProductData & {
    purchasePriceHT?: string | null;
    supplierId?: string | null;
    supplierProductUrl?: string | null;
  };
  categories: string[];
  suppliers?: SupplierOption[];
  dependencies?: DependencyData[];
  dependents?: DependentData[];
  availableProducts?: AvailableProduct[];
  error?: string;
  success?: string;
  user: AdminUser;
}

export const ProductFormPage: FC<ProductFormPageProps> = ({ productData, categories, suppliers, dependencies, dependents, availableProducts, error, success, user }) => {
  const isEdit = !!productData;
  const title = isEdit ? 'Modifier produit' : 'Nouveau produit';
  const deps = dependencies || [];
  const revDeps = dependents || [];
  const hasDeps = deps.length > 0 || revDeps.length > 0;

  return (
    <Layout title={title} currentPath="/backoffice/products" user={user}>
      <style>{`
        .dep-graph {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 32px 16px;
          overflow-x: auto;
        }
        .dep-graph-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          min-width: 180px;
        }
        .dep-graph-center {
          min-width: 200px;
        }
        .dep-graph-arrows {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 60px;
          gap: 8px;
        }
        .dep-arrow {
          color: #6c757d;
          font-size: 1.5rem;
          line-height: 1;
        }
        .dep-arrow-label {
          font-size: 0.65rem;
          color: #adb5bd;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        .dep-node {
          border: 2px solid #dee2e6;
          border-radius: 12px;
          padding: 12px 16px;
          background: #fff;
          width: 100%;
          max-width: 220px;
          transition: all 0.2s;
          position: relative;
        }
        .dep-node:hover {
          border-color: #0d6efd;
          box-shadow: 0 4px 12px rgba(13,110,253,0.15);
        }
        .dep-node-center {
          border-color: #0d6efd;
          background: linear-gradient(135deg, #e8f0fe 0%, #f0f4ff 100%);
          box-shadow: 0 4px 16px rgba(13,110,253,0.15);
        }
        .dep-node-required {
          border-left: 4px solid #dc3545;
        }
        .dep-node-recommended {
          border-left: 4px solid #ffc107;
        }
        .dep-node-dependent {
          border-left: 4px solid #198754;
        }
        .dep-node-name {
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dep-node-ref {
          font-size: 0.75rem;
          color: #6c757d;
        }
        .dep-node-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
        }
        .dep-node-remove {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #dc3545;
          color: #fff;
          border: 2px solid #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .dep-node:hover .dep-node-remove {
          opacity: 1;
        }
        .dep-empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #adb5bd;
        }
        .dep-empty-state i {
          font-size: 3rem;
          margin-bottom: 12px;
          display: block;
        }
        .dep-legend {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .dep-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #6c757d;
        }
        .dep-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
        }
      `}</style>

      <div class="row">
        <div class={isEdit ? 'col-lg-8' : 'col-lg-8'}>
          <div class="card">
            <div class="card-header">
              <i class="bi bi-box-seam me-2"></i>
              {isEdit ? `Modification de ${productData?.name}` : 'Creer un nouveau produit'}
            </div>
            <div class="card-body">
              <FlashMessages error={error} success={success} />

              <form method="post" action={isEdit ? `/backoffice/products/${productData?.id}` : '/backoffice/products'}>
                <div class="row g-3">
                  {/* Reference */}
                  <div class="col-md-4">
                    <label class="form-label" for="reference">
                      Reference <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="reference"
                      name="reference"
                      class="form-control"
                      value={productData?.reference || ''}
                      required
                    />
                  </div>

                  {/* Name */}
                  <div class="col-md-8">
                    <label class="form-label" for="name">
                      Nom <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      class="form-control"
                      value={productData?.name || ''}
                      required
                    />
                  </div>

                  {/* Description */}
                  <div class="col-12">
                    <label class="form-label" for="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      class="form-control"
                      rows={3}
                    >{productData?.description || ''}</textarea>
                  </div>

                  {/* Category */}
                  <div class="col-md-6">
                    <label class="form-label" for="category">
                      Categorie <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="category"
                      name="category"
                      class="form-control"
                      list="categories-list"
                      value={productData?.category || ''}
                      required
                    />
                    <datalist id="categories-list">
                      {categories.map((cat) => (
                        <option value={cat}></option>
                      ))}
                    </datalist>
                    <div class="form-text">Saisir une nouvelle categorie ou en choisir une existante</div>
                  </div>

                  {/* Brand */}
                  <div class="col-md-6">
                    <label class="form-label" for="brand">Marque</label>
                    <input
                      type="text"
                      id="brand"
                      name="brand"
                      class="form-control"
                      value={productData?.brand || ''}
                    />
                  </div>

                  <div class="col-12">
                    <hr class="my-2" />
                    <h6 class="text-muted mb-3">
                      <i class="bi bi-currency-euro me-2"></i>Tarification
                    </h6>
                  </div>

                  {/* Price HT */}
                  <div class="col-md-4">
                    <label class="form-label" for="priceHT">
                      Prix HT <span class="text-danger">*</span>
                    </label>
                    <div class="input-group">
                      <input
                        type="number"
                        id="priceHT"
                        name="priceHT"
                        class="form-control"
                        step="0.01"
                        min="0"
                        value={productData?.priceHT || ''}
                        required
                      />
                      <span class="input-group-text">EUR</span>
                    </div>
                  </div>

                  {/* TVA Rate */}
                  <div class="col-md-4">
                    <label class="form-label" for="tvaRate">Taux TVA</label>
                    <div class="input-group">
                      <input
                        type="number"
                        id="tvaRate"
                        name="tvaRate"
                        class="form-control"
                        step="0.01"
                        min="0"
                        max="100"
                        value={productData?.tvaRate || '20'}
                      />
                      <span class="input-group-text">%</span>
                    </div>
                  </div>

                  {/* Stock */}
                  <div class="col-md-4">
                    <label class="form-label" for="stock">Stock</label>
                    <input
                      type="number"
                      id="stock"
                      name="stock"
                      class="form-control"
                      min="0"
                      value={productData?.stock !== null ? productData?.stock : ''}
                    />
                  </div>

                  <div class="col-12">
                    <hr class="my-2" />
                    <h6 class="text-muted mb-3">
                      <i class="bi bi-cart me-2"></i>Achat &amp; Fournisseur
                    </h6>
                  </div>

                  {/* Purchase Price HT */}
                  <div class="col-md-4">
                    <label class="form-label" for="purchasePriceHT">Prix d'achat HT</label>
                    <div class="input-group">
                      <input
                        type="number"
                        id="purchasePriceHT"
                        name="purchasePriceHT"
                        class="form-control"
                        step="0.01"
                        min="0"
                        value={productData?.purchasePriceHT || ''}
                      />
                      <span class="input-group-text">EUR</span>
                    </div>
                    <div class="form-text">Laisser vide pour les services</div>
                  </div>

                  {/* Supplier */}
                  <div class="col-md-4">
                    <label class="form-label" for="supplierId">Fournisseur</label>
                    <select name="supplierId" id="supplierId" class="form-select">
                      <option value="">-- Aucun --</option>
                      {(suppliers || []).map((s) => (
                        <option value={s.id} selected={s.id === productData?.supplierId}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Margin indicator */}
                  <div class="col-md-4 d-flex align-items-end">
                    <div id="margin-indicator" class="w-100">
                      {productData?.purchasePriceHT && productData?.priceHT && (
                        (() => {
                          const sell = parseFloat(productData.priceHT);
                          const cost = parseFloat(productData.purchasePriceHT);
                          const margin = sell > 0 ? ((sell - cost) / sell * 100) : 0;
                          const color = margin >= 30 ? 'success' : margin >= 15 ? 'warning' : 'danger';
                          return (
                            <div class={`alert alert-${color} py-2 px-3 mb-0 small`}>
                              <i class="bi bi-graph-up me-1"></i>
                              Marge: <strong>{margin.toFixed(1)}%</strong>
                              <span class="text-muted ms-2">({(sell - cost).toFixed(2)} EUR)</span>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  {/* Supplier Product URL */}
                  <div class="col-12">
                    <label class="form-label" for="supplierProductUrl">Lien produit fournisseur</label>
                    <input
                      type="url"
                      id="supplierProductUrl"
                      name="supplierProductUrl"
                      class="form-control"
                      placeholder="https://..."
                      value={productData?.supplierProductUrl || ''}
                    />
                  </div>

                  <div class="col-12">
                    <hr class="my-2" />
                    <h6 class="text-muted mb-3">
                      <i class="bi bi-gear me-2"></i>Options
                    </h6>
                  </div>

                  {/* Image URL */}
                  <div class="col-md-8">
                    <label class="form-label" for="imageUrl">URL de l'image</label>
                    <input
                      type="url"
                      id="imageUrl"
                      name="imageUrl"
                      class="form-control"
                      value={productData?.imageUrl || ''}
                    />
                  </div>

                  {/* Active */}
                  <div class="col-md-4 d-flex align-items-end">
                    <div class="form-check form-switch">
                      <input
                        type="checkbox"
                        id="isActive"
                        name="isActive"
                        class="form-check-input"
                        checked={productData?.isActive ?? true}
                      />
                      <label class="form-check-label" for="isActive">
                        Produit actif
                      </label>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div class="d-flex gap-2 mt-4 pt-3 border-top">
                  <button type="submit" class="btn btn-primary">
                    <i class="bi bi-check-lg me-2"></i>
                    {isEdit ? 'Enregistrer' : 'Creer'}
                  </button>
                  <a href="/backoffice/products" class="btn btn-outline-secondary">
                    <i class="bi bi-x-lg me-2"></i>Annuler
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div class="col-lg-4">
          {/* Preview image */}
          {productData?.imageUrl && (
            <div class="card mb-4">
              <div class="card-header">
                <i class="bi bi-image me-2"></i>Apercu image
              </div>
              <div class="card-body text-center">
                <img
                  src={productData.imageUrl}
                  alt={productData.name}
                  class="img-fluid rounded"
                  style="max-height: 300px;"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var priceEl = document.getElementById('priceHT');
          var costEl = document.getElementById('purchasePriceHT');
          var indicator = document.getElementById('margin-indicator');
          function update() {
            var sell = parseFloat(priceEl.value) || 0;
            var cost = parseFloat(costEl.value) || 0;
            if (sell > 0 && cost > 0) {
              var margin = ((sell - cost) / sell * 100);
              var color = margin >= 30 ? 'success' : margin >= 15 ? 'warning' : 'danger';
              indicator.innerHTML = '<div class="alert alert-' + color + ' py-2 px-3 mb-0 small">' +
                '<i class="bi bi-graph-up me-1"></i>Marge: <strong>' + margin.toFixed(1) + '%</strong>' +
                '<span class="text-muted ms-2">(' + (sell - cost).toFixed(2) + ' EUR)</span></div>';
            } else {
              indicator.innerHTML = '';
            }
          }
          if (priceEl && costEl) {
            priceEl.addEventListener('input', update);
            costEl.addEventListener('input', update);
          }
        })();
      `}} />

      {/* ========== Dependencies Section - Full Width Below ========== */}
      {isEdit && (
        <div class="card mt-4" id="dependencies-card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>
              <i class="bi bi-diagram-3 me-2"></i>
              Dependances produit
              {deps.length > 0 && (
                <span class="badge bg-primary ms-2">{deps.length}</span>
              )}
            </span>
          </div>
          <div class="card-body">

            {/* ===== Visual Dependency Graph ===== */}
            {hasDeps ? (
              <>
                <div class="dep-graph">
                  {/* Left column: dependencies (products this one needs) */}
                  {deps.length > 0 && (
                    <>
                      <div class="dep-graph-col">
                        <div class="text-muted small fw-medium mb-1 text-center" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;">
                          Necessite
                        </div>
                        {deps.map((dep) => (
                          <div class={`dep-node dep-node-${dep.type === 'required' ? 'required' : 'recommended'}`} id={`dep-${dep.id}`}>
                            <button
                              class="dep-node-remove"
                              hx-delete={`/backoffice/products/${productData!.id}/dependances/${dep.id}`}
                              hx-target={`#dep-${dep.id}`}
                              hx-swap="outerHTML"
                              hx-confirm={`Retirer ${dep.requiredProduct.name} des dependances ?`}
                              title="Retirer"
                            >
                              <i class="bi bi-x"></i>
                            </button>
                            <div class="dep-node-name" title={dep.requiredProduct.name}>
                              {dep.requiredProduct.name}
                            </div>
                            <div class="dep-node-ref">
                              {dep.requiredProduct.reference}
                              {dep.requiredProduct.brand && ` · ${dep.requiredProduct.brand}`}
                            </div>
                            <div class="dep-node-meta">
                              <span class={`badge bg-${dep.type === 'required' ? 'danger' : 'warning'}`} style="font-size:0.65rem;">
                                {dep.type === 'required' ? 'Obligatoire' : 'Recommande'}
                              </span>
                            </div>
                            {dep.description && (
                              <div style="font-size:0.72rem;color:#6c757d;margin-top:4px;font-style:italic;">
                                {dep.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div class="dep-graph-arrows">
                        <i class="bi bi-arrow-right dep-arrow"></i>
                        <span class="dep-arrow-label">requis par</span>
                      </div>
                    </>
                  )}

                  {/* Center: current product */}
                  <div class="dep-graph-col dep-graph-center">
                    <div class="dep-node dep-node-center">
                      <div class="text-center">
                        <i class="bi bi-box-seam" style="font-size:1.4rem;color:#0d6efd;"></i>
                      </div>
                      <div class="dep-node-name text-center" title={productData!.name}>
                        {productData!.name}
                      </div>
                      <div class="dep-node-ref text-center">
                        {productData!.reference}
                        {productData!.brand && ` · ${productData!.brand}`}
                      </div>
                      <div class="text-center mt-1">
                        <span class="badge bg-primary" style="font-size:0.65rem;">
                          {productData!.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right column: dependents (products that need this one) */}
                  {revDeps.length > 0 && (
                    <>
                      <div class="dep-graph-arrows">
                        <i class="bi bi-arrow-right dep-arrow"></i>
                        <span class="dep-arrow-label">requis par</span>
                      </div>

                      <div class="dep-graph-col">
                        <div class="text-muted small fw-medium mb-1 text-center" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;">
                          Utilise par
                        </div>
                        {revDeps.map((rd) => (
                          <a href={`/backoffice/products/${rd.product.id}/edit`} class="text-decoration-none">
                            <div class="dep-node dep-node-dependent">
                              <div class="dep-node-name" title={rd.product.name}>
                                {rd.product.name}
                              </div>
                              <div class="dep-node-ref">
                                {rd.product.reference}
                                {rd.product.brand && ` · ${rd.product.brand}`}
                              </div>
                              <div class="dep-node-meta">
                                <span class="badge bg-success" style="font-size:0.65rem;">
                                  {rd.type === 'required' ? 'Obligatoire' : 'Recommande'}
                                </span>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Legend */}
                <div class="dep-legend">
                  <div class="dep-legend-item">
                    <div class="dep-legend-dot" style="background:#dc3545;"></div>
                    Obligatoire
                  </div>
                  <div class="dep-legend-item">
                    <div class="dep-legend-dot" style="background:#ffc107;"></div>
                    Recommande
                  </div>
                  <div class="dep-legend-item">
                    <div class="dep-legend-dot" style="background:#198754;"></div>
                    Utilise par
                  </div>
                  <div class="dep-legend-item">
                    <div class="dep-legend-dot" style="background:#0d6efd;"></div>
                    Produit courant
                  </div>
                </div>
              </>
            ) : (
              <div class="dep-empty-state">
                <i class="bi bi-diagram-3"></i>
                <div class="fw-medium text-dark mb-1">Aucune dependance</div>
                <div class="small">
                  Ajoutez les produits necessaires au fonctionnement<br/>
                  de ce produit (ex: bridge, hub, gateway...)
                </div>
              </div>
            )}

            {/* ===== Search & Add Dependency ===== */}
            {availableProducts && availableProducts.length > 0 && (
              <div class="border-top pt-3 mt-3">
                <form method="post" action={`/backoffice/products/${productData!.id}/dependances`}>
                  <div class="row g-3 align-items-end">
                    <div class="col-lg-5">
                      <label class="form-label small fw-medium" for="requiredProductId">
                        Ajouter une dependance
                      </label>
                      <select name="requiredProductId" id="requiredProductId" class="form-select" required>
                        <option value="">-- Choisir un produit --</option>
                        {availableProducts.map((p) => (
                          <option value={p.id}>
                            {p.name} ({p.reference}){p.brand ? ` - ${p.brand}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div class="col-lg-3">
                      <label class="form-label small fw-medium" for="type">Type</label>
                      <select name="type" id="type" class="form-select">
                        <option value="required">Obligatoire</option>
                        <option value="recommended">Recommande</option>
                      </select>
                    </div>
                    <div class="col-lg-3">
                      <label class="form-label small fw-medium" for="description">Note</label>
                      <input
                        type="text"
                        name="description"
                        id="description"
                        class="form-control"
                        placeholder="ex: 1 bridge pour 50 ampoules"
                      />
                    </div>
                    <div class="col-lg-1">
                      <button type="submit" class="btn btn-primary w-100" title="Ajouter la dependance">
                        <i class="bi bi-plus-lg"></i>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

    </Layout>
  );
};
