import type { FC } from 'hono/jsx';
import { Layout, Table, TableActions, FlashMessages } from '../../backoffice/components';
import type { AdminUser } from '../../backoffice/middleware/admin-auth';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  isPublished: boolean;
  sortOrder: number;
  categoryName: string | null;
}

interface FAQListProps {
  items: FAQItem[];
  success?: string;
  error?: string;
  user: AdminUser;
}

export const FAQListPage: FC<FAQListProps> = ({ items, success, error, user }) => {
  return (
    <Layout title="FAQ" currentPath="/backoffice/support/faq" user={user}>
      <FlashMessages success={success} error={error} />

      {/* Table */}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-question-circle me-2"></i>FAQ</span>
          <a href="/backoffice/support/faq/new" class="btn btn-sm btn-primary">
            <i class="bi bi-plus-lg me-2"></i>Nouvelle FAQ
          </a>
        </div>
        <div class="card-body p-0">
          <Table
            columns={[
              {
                key: 'question',
                label: 'Question',
                render: (f: FAQItem) => (
                  <div>
                    <div class="fw-medium">
                      {f.question.length > 80 ? `${f.question.substring(0, 80)}...` : f.question}
                    </div>
                    <small class="text-muted">
                      {f.answer.length > 100 ? `${f.answer.substring(0, 100)}...` : f.answer}
                    </small>
                  </div>
                ),
              },
              {
                key: 'categoryName',
                label: 'Categorie',
                render: (f: FAQItem) => f.categoryName || '-',
              },
              {
                key: 'isPublished',
                label: 'Statut',
                render: (f: FAQItem) =>
                  f.isPublished ? (
                    <span class="badge bg-success">Publie</span>
                  ) : (
                    <span class="badge bg-secondary">Brouillon</span>
                  ),
              },
              {
                key: 'sortOrder',
                label: 'Ordre',
                render: (f: FAQItem) => (
                  <span class="badge bg-light text-dark">{f.sortOrder}</span>
                ),
              },
            ]}
            data={items}
            emptyMessage="Aucune FAQ"
            actions={(f: FAQItem) => (
              <TableActions
                editUrl={`/backoffice/support/faq/${f.id}/edit`}
                deleteUrl={`/backoffice/support/faq/${f.id}`}
                deleteConfirm={`Supprimer cette FAQ ?`}
              />
            )}
          />
        </div>
      </div>
    </Layout>
  );
};
