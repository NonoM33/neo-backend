import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface KBFormProps {
  article?: {
    id: string;
    title: string;
    slug: string;
    categoryId: string | null;
    content: string;
    excerpt: string | null;
    tags: string[] | null;
    status: string;
  };
  categories: Array<{ id: string; name: string }>;
  error?: string;
  user: AdminUser;
}

const statusOptions = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'publie', label: 'Publie' },
  { value: 'archive', label: 'Archive' },
];

export const KBFormPage: FC<KBFormProps> = ({ article, categories, error, user }) => {
  const isEdit = !!article;
  const title = isEdit ? 'Modifier l\'article' : 'Nouvel article';

  return (
    <Layout title={title} currentPath="/backoffice/support/kb" user={user}>
      <div class="row">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">
              <i class="bi bi-book me-2"></i>
              {isEdit ? `Modification de "${article?.title}"` : 'Creer un nouvel article'}
            </div>
            <div class="card-body">
              <FlashMessages error={error} />

              <form
                method="post"
                action={
                  isEdit
                    ? `/backoffice/support/kb/articles/${article?.id}`
                    : '/backoffice/support/kb/articles'
                }
              >
                <div class="row g-3">
                  {/* Title */}
                  <div class="col-12">
                    <label class="form-label" for="title">
                      Titre <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      class="form-control"
                      value={article?.title || ''}
                      required
                    />
                  </div>

                  {/* Slug */}
                  <div class="col-12">
                    <label class="form-label" for="slug">
                      Slug <span class="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="slug"
                      name="slug"
                      class="form-control"
                      value={article?.slug || ''}
                      required
                      placeholder="mon-article"
                    />
                    <div class="form-text">Identifiant URL de l'article. Auto-genere depuis le titre.</div>
                  </div>

                  {/* Category */}
                  <div class="col-md-6">
                    <label class="form-label" for="categoryId">Categorie</label>
                    <select id="categoryId" name="categoryId" class="form-select">
                      <option value="">Aucune categorie</option>
                      {categories.map((cat) => (
                        <option value={cat.id} selected={cat.id === article?.categoryId}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div class="col-md-6">
                    <label class="form-label" for="status">
                      Statut <span class="text-danger">*</span>
                    </label>
                    <select id="status" name="status" class="form-select" required>
                      {statusOptions.map((opt) => (
                        <option value={opt.value} selected={opt.value === (article?.status || 'brouillon')}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Excerpt */}
                  <div class="col-12">
                    <label class="form-label" for="excerpt">Resume</label>
                    <textarea
                      id="excerpt"
                      name="excerpt"
                      class="form-control"
                      rows={2}
                      placeholder="Bref resume de l'article..."
                    >{article?.excerpt || ''}</textarea>
                  </div>

                  {/* Content */}
                  <div class="col-12">
                    <label class="form-label" for="content">
                      Contenu (Markdown) <span class="text-danger">*</span>
                    </label>
                    <textarea
                      id="content"
                      name="content"
                      class="form-control font-monospace"
                      rows={15}
                      required
                      placeholder="Redigez le contenu de l'article en Markdown..."
                    >{article?.content || ''}</textarea>
                  </div>

                  {/* Tags */}
                  <div class="col-12">
                    <label class="form-label" for="tags">Tags</label>
                    <input
                      type="text"
                      id="tags"
                      name="tags"
                      class="form-control"
                      value={article?.tags?.join(', ') || ''}
                      placeholder="tag1, tag2, tag3"
                    />
                    <div class="form-text">Separez les tags par des virgules</div>
                  </div>
                </div>

                {/* Actions */}
                <div class="d-flex gap-2 mt-4 pt-3 border-top">
                  <button type="submit" class="btn btn-primary">
                    <i class="bi bi-check-lg me-2"></i>
                    {isEdit ? 'Enregistrer' : 'Creer'}
                  </button>
                  <a href="/backoffice/support/kb" class="btn btn-outline-secondary">
                    <i class="bi bi-x-lg me-2"></i>Annuler
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-generate slug from title */}
      <script>{`
        document.addEventListener('DOMContentLoaded', function() {
          var titleInput = document.getElementById('title');
          var slugInput = document.getElementById('slug');
          var slugModified = ${isEdit ? 'true' : 'false'};

          slugInput.addEventListener('input', function() {
            slugModified = true;
          });

          titleInput.addEventListener('input', function() {
            if (!slugModified) {
              slugInput.value = this.value
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\\u0300-\\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            }
          });
        });
      `}</script>
    </Layout>
  );
};
