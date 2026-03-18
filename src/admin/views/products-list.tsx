import type { FC } from 'hono/jsx';
import { Layout } from './layout';
import type { Product } from '../../db/schema';

interface ProductsListProps {
  products: Product[];
  categories: string[];
  currentCategory?: string;
}

export const ProductsList: FC<ProductsListProps> = ({ products, categories, currentCategory }) => {
  return (
    <Layout title="Produits">
      <div class="d-flex justify-content-between mb-3">
        <div>
          <a href="/admin/products/new" class="btn btn-primary me-2">Nouveau produit</a>
          <a href="/admin/products/import" class="btn btn-outline-secondary">Importer CSV</a>
        </div>

        <form method="get" class="d-flex gap-2">
          <select name="category" class="form-select" style="width: auto;">
            <option value="">Toutes categories</option>
            {categories.map((cat) => (
              <option value={cat} selected={cat === currentCategory}>{cat}</option>
            ))}
          </select>
          <button type="submit" class="btn btn-outline-primary">Filtrer</button>
        </form>
      </div>

      <table class="table table-striped">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Nom</th>
            <th>Categorie</th>
            <th>Marque</th>
            <th>Prix HT</th>
            <th>Actif</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr>
              <td>{product.reference}</td>
              <td>{product.name}</td>
              <td>{product.category}</td>
              <td>{product.brand || '-'}</td>
              <td>{parseFloat(product.priceHT).toFixed(2)} EUR</td>
              <td>
                <span class={`badge bg-${product.isActive ? 'success' : 'secondary'}`}>
                  {product.isActive ? 'Oui' : 'Non'}
                </span>
              </td>
              <td>
                <a href={`/admin/products/${product.id}/edit`} class="btn btn-sm btn-outline-primary">Modifier</a>
                <button
                  class="btn btn-sm btn-outline-danger ms-1"
                  hx-delete={`/admin/products/${product.id}`}
                  hx-confirm="Supprimer ce produit ?"
                  hx-target="closest tr"
                  hx-swap="outerHTML"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
};
