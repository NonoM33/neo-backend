import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../backoffice/components';
import type { AdminUser } from '../../backoffice/middleware/admin-auth';

interface FAQFormProps {
  faq?: {
    id: string;
    question: string;
    answer: string;
    categoryId: string | null;
    sortOrder: number;
    isPublished: boolean;
  };
  categories: Array<{ id: string; name: string }>;
  error?: string;
  user: AdminUser;
}

export const FAQFormPage: FC<FAQFormProps> = ({ faq, categories, error, user }) => {
  const isEdit = !!faq;
  const title = isEdit ? 'Modifier la FAQ' : 'Nouvelle FAQ';

  return (
    <Layout title={title} currentPath="/backoffice/support/faq" user={user}>
      <div class="row">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">
              <i class="bi bi-question-circle me-2"></i>
              {isEdit ? 'Modification de la FAQ' : 'Creer une nouvelle FAQ'}
            </div>
            <div class="card-body">
              <FlashMessages error={error} />

              <form
                method="post"
                action={
                  isEdit
                    ? `/backoffice/support/faq/${faq?.id}`
                    : '/backoffice/support/faq'
                }
              >
                <div class="row g-3">
                  {/* Question */}
                  <div class="col-12">
                    <label class="form-label" for="question">
                      Question <span class="text-danger">*</span>
                    </label>
                    <textarea
                      id="question"
                      name="question"
                      class="form-control"
                      rows={2}
                      required
                      placeholder="Quelle est la question ?"
                    >{faq?.question || ''}</textarea>
                  </div>

                  {/* Answer */}
                  <div class="col-12">
                    <label class="form-label" for="answer">
                      Reponse <span class="text-danger">*</span>
                    </label>
                    <textarea
                      id="answer"
                      name="answer"
                      class="form-control"
                      rows={6}
                      required
                      placeholder="Redigez la reponse..."
                    >{faq?.answer || ''}</textarea>
                  </div>

                  {/* Category */}
                  <div class="col-md-4">
                    <label class="form-label" for="categoryId">Categorie</label>
                    <select id="categoryId" name="categoryId" class="form-select">
                      <option value="">Aucune categorie</option>
                      {categories.map((cat) => (
                        <option value={cat.id} selected={cat.id === faq?.categoryId}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Order */}
                  <div class="col-md-4">
                    <label class="form-label" for="sortOrder">Ordre d'affichage</label>
                    <input
                      type="number"
                      id="sortOrder"
                      name="sortOrder"
                      class="form-control"
                      value={faq?.sortOrder?.toString() || '0'}
                      min="0"
                    />
                  </div>

                  {/* Published */}
                  <div class="col-md-4">
                    <label class="form-label d-block">&nbsp;</label>
                    <div class="form-check form-switch mt-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        name="isPublished"
                        value="true"
                        id="isPublished"
                        checked={faq?.isPublished ?? false}
                      />
                      <label class="form-check-label" for="isPublished">
                        Publie
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
                  <a href="/backoffice/support/faq" class="btn btn-outline-secondary">
                    <i class="bi bi-x-lg me-2"></i>Annuler
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
