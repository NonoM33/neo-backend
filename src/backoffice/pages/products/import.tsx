import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface ImportResult {
  imported: number;
  errors: string[];
}

interface ImportProductsPageProps {
  result?: ImportResult;
  user: AdminUser;
}

export const ImportProductsPage: FC<ImportProductsPageProps> = ({ result, user }) => {
  return (
    <Layout title="Import CSV" currentPath="/backoffice/products" user={user}>
      <div class="row">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">
              <i class="bi bi-upload me-2"></i>Importer des produits depuis un fichier CSV
            </div>
            <div class="card-body">
              {result && (
                <div class={`alert alert-${result.errors.length > 0 ? 'warning' : 'success'}`}>
                  <i class={`bi bi-${result.errors.length > 0 ? 'exclamation-triangle' : 'check-circle'} me-2`}></i>
                  <strong>{result.imported} produit(s) importe(s)</strong>
                  {result.errors.length > 0 && (
                    <div class="mt-2">
                      <strong>Erreurs:</strong>
                      <ul class="mb-0 mt-1">
                        {result.errors.map((error) => (
                          <li>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <form method="post" enctype="multipart/form-data" action="/backoffice/products/import">
                <div class="mb-4">
                  <label class="form-label" for="file">
                    Fichier CSV <span class="text-danger">*</span>
                  </label>
                  <input
                    type="file"
                    id="file"
                    name="file"
                    class="form-control"
                    accept=".csv"
                    required
                  />
                </div>

                <div class="d-flex gap-2">
                  <button type="submit" class="btn btn-primary">
                    <i class="bi bi-upload me-2"></i>Importer
                  </button>
                  <a href="/backoffice/products" class="btn btn-outline-secondary">
                    <i class="bi bi-x-lg me-2"></i>Annuler
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card">
            <div class="card-header">
              <i class="bi bi-info-circle me-2"></i>Format du fichier
            </div>
            <div class="card-body">
              <p class="mb-3">Le fichier CSV doit contenir les colonnes suivantes :</p>
              <ul class="list-unstyled mb-3">
                <li><code>reference</code> <span class="text-danger">*</span></li>
                <li><code>name</code> <span class="text-danger">*</span></li>
                <li><code>description</code></li>
                <li><code>category</code> <span class="text-danger">*</span></li>
                <li><code>brand</code></li>
                <li><code>priceHT</code> <span class="text-danger">*</span></li>
                <li><code>tvaRate</code> (defaut: 20)</li>
                <li><code>stock</code></li>
                <li><code>imageUrl</code></li>
                <li><code>isActive</code> (true/false)</li>
              </ul>
              <div class="alert alert-light mb-0">
                <small>
                  <strong>Exemple:</strong><br />
                  reference,name,category,priceHT<br />
                  REF001,Produit Test,Eclairage,150.00
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
