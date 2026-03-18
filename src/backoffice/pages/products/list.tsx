import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, Pagination, PaginationInfo, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface Product {
  id: string;
  reference: string;
  name: string;
  category: string;
  brand: string | null;
  priceHT: string;
  purchasePriceHT: string | null;
  isActive: boolean;
  stock: number | null;
  createdAt: Date;
}

interface ProductsListPageProps {
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  categories: string[];
  brands: string[];
  search?: string;
  category?: string;
  brand?: string;
  active?: string;
  success?: string;
  error?: string;
  user: AdminUser;
}

export const ProductsListPage: FC<ProductsListPageProps> = ({
  products,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  categories,
  brands,
  search,
  category,
  brand,
  active,
  success,
  error,
  user,
}) => {
  const hasFilters = search || category || brand || active;

  return (
    <Layout title="Produits" currentPath="/backoffice/products" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Actions & Filters */}
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-auto">
              <a href="/backoffice/products/new" class="btn btn-primary">
                <i class="bi bi-plus-lg me-2"></i>Nouveau produit
              </a>
              <a href="/backoffice/products/import" class="btn btn-outline-secondary ms-2">
                <i class="bi bi-upload me-2"></i>Import CSV
              </a>
            </div>
            <div class="col-12">
              <form method="get" class="row g-2">
                <div class="col-md-3">
                  <label class="form-label small text-muted">Recherche</label>
                  <input
                    type="text"
                    name="search"
                    class="form-control"
                    placeholder="Nom ou reference..."
                    value={search || ''}
                  />
                </div>
                <div class="col-md-2">
                  <label class="form-label small text-muted">Categorie</label>
                  <select name="category" class="form-select">
                    <option value="">Toutes</option>
                    {categories.map((cat) => (
                      <option value={cat} selected={cat === category}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div class="col-md-2">
                  <label class="form-label small text-muted">Marque</label>
                  <select name="brand" class="form-select">
                    <option value="">Toutes</option>
                    {brands.map((b) => (
                      <option value={b} selected={b === brand}>{b}</option>
                    ))}
                  </select>
                </div>
                <div class="col-md-2">
                  <label class="form-label small text-muted">Statut</label>
                  <select name="active" class="form-select">
                    <option value="">Tous</option>
                    <option value="true" selected={active === 'true'}>Actifs</option>
                    <option value="false" selected={active === 'false'}>Inactifs</option>
                  </select>
                </div>
                <div class="col-auto d-flex align-items-end">
                  <button type="submit" class="btn btn-outline-primary">
                    <i class="bi bi-search me-1"></i>Filtrer
                  </button>
                  {hasFilters && (
                    <a href="/backoffice/products" class="btn btn-outline-secondary ms-2">
                      <i class="bi bi-x-lg"></i>
                    </a>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div class="card">
        <div class="card-body p-0">
          <Table
            columns={[
              {
                key: 'reference',
                label: 'Reference',
                render: (p: Product) => (
                  <code class="small">{p.reference}</code>
                ),
              },
              {
                key: 'name',
                label: 'Produit',
                render: (p: Product) => (
                  <div>
                    <div class="fw-medium">{p.name}</div>
                    {p.brand && <small class="text-muted">{p.brand}</small>}
                  </div>
                ),
              },
              {
                key: 'category',
                label: 'Categorie',
                render: (p: Product) => (
                  <span class="badge bg-light text-dark">{p.category}</span>
                ),
              },
              {
                key: 'priceHT',
                label: 'Prix HT',
                class: 'text-end',
                render: (p: Product) => (
                  <span class="fw-medium">{parseFloat(p.priceHT).toFixed(2)} EUR</span>
                ),
              },
              {
                key: 'purchasePriceHT',
                label: 'Cout HT',
                class: 'text-end',
                render: (p: Product) => p.purchasePriceHT ? (
                  <span class="text-muted">{parseFloat(p.purchasePriceHT).toFixed(2)} EUR</span>
                ) : <span class="text-muted">-</span>,
              },
              {
                key: 'margin',
                label: 'Marge %',
                class: 'text-center',
                render: (p: Product) => {
                  if (!p.purchasePriceHT) return <span class="text-muted">-</span>;
                  const sell = parseFloat(p.priceHT);
                  const cost = parseFloat(p.purchasePriceHT);
                  const margin = sell > 0 ? ((sell - cost) / sell * 100) : 0;
                  const color = margin >= 30 ? 'success' : margin >= 15 ? 'warning' : 'danger';
                  return <span class={`badge bg-${color}`}>{margin.toFixed(0)}%</span>;
                },
              },
              {
                key: 'stock',
                label: 'Stock',
                class: 'text-center',
                render: (p: Product) => (
                  p.stock !== null ? (
                    <span class={`badge bg-${p.stock > 10 ? 'success' : p.stock > 0 ? 'warning' : 'danger'}`}>
                      {p.stock}
                    </span>
                  ) : '-'
                ),
              },
              {
                key: 'isActive',
                label: 'Actif',
                class: 'text-center',
                render: (p: Product) => (
                  <span class={`badge bg-${p.isActive ? 'success' : 'secondary'}`}>
                    {p.isActive ? 'Oui' : 'Non'}
                  </span>
                ),
              },
            ]}
            data={products}
            emptyMessage="Aucun produit trouve"
            actions={(p: Product) => (
              <TableActions
                editUrl={`/backoffice/products/${p.id}/edit`}
                deleteUrl={`/backoffice/products/${p.id}`}
                deleteConfirm={`Supprimer le produit ${p.name} ?`}
              />
            )}
          />
        </div>
        {totalPages > 1 && (
          <div class="card-footer d-flex justify-content-between align-items-center">
            <PaginationInfo
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              baseUrl="/backoffice/products"
              queryParams={{ search, category, brand, active }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
