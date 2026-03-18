import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface SupplierData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
}

interface SupplierProduct {
  id: string;
  reference: string;
  name: string;
  category: string;
  priceHT: string;
  purchasePriceHT: string | null;
}

interface SupplierFormPageProps {
  supplierData?: SupplierData;
  products?: SupplierProduct[];
  error?: string;
  success?: string;
  user: AdminUser;
}

export const SupplierFormPage: FC<SupplierFormPageProps> = ({ supplierData, products, error, success, user }) => {
  const isEdit = !!supplierData;
  const title = isEdit ? `Modifier ${supplierData?.name}` : 'Nouveau fournisseur';

  return (
    <Layout title={title} currentPath="/backoffice/suppliers" user={user}>
      <div class="row">
        <div class={isEdit && products && products.length > 0 ? 'col-lg-8' : 'col-lg-8'}>
          <div class="card">
            <div class="card-header">
              <i class="bi bi-truck me-2"></i>
              {isEdit ? `Modification de ${supplierData?.name}` : 'Creer un nouveau fournisseur'}
            </div>
            <div class="card-body">
              <FlashMessages error={error} success={success} />

              <form method="post" action={isEdit ? `/backoffice/suppliers/${supplierData?.id}` : '/backoffice/suppliers'}>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label" for="name">
                      Nom <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      class="form-control"
                      value={supplierData?.name || ''}
                      required
                    />
                  </div>

                  <div class="col-md-6">
                    <label class="form-label" for="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      class="form-control"
                      value={supplierData?.email || ''}
                    />
                  </div>

                  <div class="col-md-6">
                    <label class="form-label" for="phone">Telephone</label>
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      class="form-control"
                      value={supplierData?.phone || ''}
                    />
                  </div>

                  <div class="col-md-6">
                    <label class="form-label" for="website">Site web</label>
                    <input
                      type="url"
                      id="website"
                      name="website"
                      class="form-control"
                      placeholder="https://..."
                      value={supplierData?.website || ''}
                    />
                  </div>

                  <div class="col-12">
                    <label class="form-label" for="notes">Notes</label>
                    <textarea
                      id="notes"
                      name="notes"
                      class="form-control"
                      rows={3}
                    >{supplierData?.notes || ''}</textarea>
                  </div>

                  <div class="col-md-4 d-flex align-items-end">
                    <div class="form-check form-switch">
                      <input
                        type="checkbox"
                        id="isActive"
                        name="isActive"
                        class="form-check-input"
                        checked={supplierData?.isActive ?? true}
                      />
                      <label class="form-check-label" for="isActive">
                        Fournisseur actif
                      </label>
                    </div>
                  </div>
                </div>

                <div class="d-flex gap-2 mt-4 pt-3 border-top">
                  <button type="submit" class="btn btn-primary">
                    <i class="bi bi-check-lg me-2"></i>
                    {isEdit ? 'Enregistrer' : 'Creer'}
                  </button>
                  <a href="/backoffice/suppliers" class="btn btn-outline-secondary">
                    <i class="bi bi-x-lg me-2"></i>Annuler
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>

        {isEdit && products && products.length > 0 && (
          <div class="col-lg-4">
            <div class="card">
              <div class="card-header">
                <i class="bi bi-box-seam me-2"></i>Produits ({products.length})
              </div>
              <div class="card-body p-0">
                <div class="list-group list-group-flush">
                  {products.map((p) => {
                    const margin = p.purchasePriceHT
                      ? ((parseFloat(p.priceHT) - parseFloat(p.purchasePriceHT)) / parseFloat(p.priceHT) * 100)
                      : null;
                    return (
                      <a href={`/backoffice/products/${p.id}/edit`} class="list-group-item list-group-item-action">
                        <div class="d-flex justify-content-between align-items-start">
                          <div>
                            <div class="fw-medium small">{p.name}</div>
                            <div class="text-muted" style="font-size:0.75rem;">
                              {p.reference} - {p.category}
                            </div>
                          </div>
                          <div class="text-end">
                            <div class="small">{parseFloat(p.priceHT).toFixed(2)} EUR</div>
                            {margin !== null && (
                              <span class={`badge bg-${margin >= 30 ? 'success' : margin >= 15 ? 'warning' : 'danger'}`} style="font-size:0.65rem;">
                                {margin.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
