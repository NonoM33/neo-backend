import type { FC } from 'hono/jsx';
import { Layout } from './layout';

interface ImportProductsProps {
  result?: {
    imported: number;
    errors: string[];
  };
}

export const ImportProducts: FC<ImportProductsProps> = ({ result }) => {
  return (
    <Layout title="Importer produits">
      <div class="row">
        <div class="col-md-6">
          {result && (
            <div class={`alert alert-${result.errors.length > 0 ? 'warning' : 'success'}`}>
              <strong>{result.imported} produits importes.</strong>
              {result.errors.length > 0 && (
                <div class="mt-2">
                  <strong>Erreurs ({result.errors.length}):</strong>
                  <ul class="mb-0">
                    {result.errors.slice(0, 10).map((err) => (
                      <li>{err}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>...et {result.errors.length - 10} autres erreurs</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div class="card">
            <div class="card-body">
              <h5 class="card-title">Format CSV attendu</h5>
              <p class="card-text">
                Le fichier CSV doit utiliser le point-virgule (;) comme separateur et contenir les colonnes suivantes:
              </p>
              <ul>
                <li><strong>reference</strong> (requis)</li>
                <li><strong>name</strong> (requis)</li>
                <li><strong>category</strong> (requis)</li>
                <li><strong>priceHT</strong> (requis)</li>
                <li>description (optionnel)</li>
                <li>brand (optionnel)</li>
                <li>tvaRate (optionnel, defaut: 20)</li>
              </ul>
            </div>
          </div>

          <form method="post" enctype="multipart/form-data" class="mt-4">
            <div class="mb-3">
              <label class="form-label">Fichier CSV</label>
              <input
                type="file"
                name="file"
                class="form-control"
                accept=".csv"
                required
              />
            </div>

            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary">Importer</button>
              <a href="/admin/products" class="btn btn-secondary">Annuler</a>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
