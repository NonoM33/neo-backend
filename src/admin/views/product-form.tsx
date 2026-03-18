import type { FC } from 'hono/jsx';
import { Layout } from './layout';
import type { Product } from '../../db/schema';

interface ProductFormProps {
  product?: Product;
  categories: string[];
  error?: string;
}

export const ProductForm: FC<ProductFormProps> = ({ product, categories, error }) => {
  const isEdit = !!product;

  return (
    <Layout title={isEdit ? 'Modifier produit' : 'Nouveau produit'}>
      <div class="row">
        <div class="col-md-8">
          {error && (
            <div class="alert alert-danger">{error}</div>
          )}

          <form method="post" action={isEdit ? `/admin/products/${product?.id}` : '/admin/products'}>
            <div class="row">
              <div class="col-md-4 mb-3">
                <label class="form-label">Reference</label>
                <input
                  type="text"
                  name="reference"
                  class="form-control"
                  value={product?.reference || ''}
                  required
                />
              </div>
              <div class="col-md-8 mb-3">
                <label class="form-label">Nom</label>
                <input
                  type="text"
                  name="name"
                  class="form-control"
                  value={product?.name || ''}
                  required
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">Description</label>
              <textarea
                name="description"
                class="form-control"
                rows={3}
              >{product?.description || ''}</textarea>
            </div>

            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Categorie</label>
                <input
                  type="text"
                  name="category"
                  class="form-control"
                  list="categories"
                  value={product?.category || ''}
                  required
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option value={cat}>{cat}</option>
                  ))}
                </datalist>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">Marque</label>
                <input
                  type="text"
                  name="brand"
                  class="form-control"
                  value={product?.brand || ''}
                />
              </div>
            </div>

            <div class="row">
              <div class="col-md-4 mb-3">
                <label class="form-label">Prix HT (EUR)</label>
                <input
                  type="number"
                  name="priceHT"
                  class="form-control"
                  step="0.01"
                  min="0"
                  value={product?.priceHT || ''}
                  required
                />
              </div>
              <div class="col-md-4 mb-3">
                <label class="form-label">TVA (%)</label>
                <input
                  type="number"
                  name="tvaRate"
                  class="form-control"
                  step="0.01"
                  min="0"
                  max="100"
                  value={product?.tvaRate || '20'}
                  required
                />
              </div>
              <div class="col-md-4 mb-3">
                <label class="form-label">Stock</label>
                <input
                  type="number"
                  name="stock"
                  class="form-control"
                  min="0"
                  value={product?.stock ?? ''}
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">URL Image</label>
              <input
                type="url"
                name="imageUrl"
                class="form-control"
                value={product?.imageUrl || ''}
              />
            </div>

            <div class="mb-3 form-check">
              <input
                type="checkbox"
                name="isActive"
                class="form-check-input"
                id="isActive"
                checked={product?.isActive !== false}
              />
              <label class="form-check-label" for="isActive">Actif</label>
            </div>

            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary">
                {isEdit ? 'Enregistrer' : 'Creer'}
              </button>
              <a href="/admin/products" class="btn btn-secondary">Annuler</a>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
