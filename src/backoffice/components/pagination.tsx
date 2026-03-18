import type { FC } from 'hono/jsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  queryParams?: Record<string, string | undefined>;
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  baseUrl,
  queryParams = {},
}) => {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  // Show ellipsis if current page is far from start
  if (currentPage > 3) {
    pages.push('ellipsis');
  }

  // Show pages around current
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  // Show ellipsis if current page is far from end
  if (currentPage < totalPages - 2) {
    pages.push('ellipsis');
  }

  // Always show last page
  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return (
    <nav aria-label="Pagination">
      <ul class="pagination mb-0">
        <li class={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
          <a class="page-link" href={buildUrl(currentPage - 1)}>
            <i class="bi bi-chevron-left"></i>
          </a>
        </li>

        {pages.map((page, index) => (
          page === 'ellipsis' ? (
            <li class="page-item disabled" key={`ellipsis-${index}`}>
              <span class="page-link">...</span>
            </li>
          ) : (
            <li class={`page-item ${page === currentPage ? 'active' : ''}`} key={page}>
              <a class="page-link" href={buildUrl(page)}>{page}</a>
            </li>
          )
        ))}

        <li class={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
          <a class="page-link" href={buildUrl(currentPage + 1)}>
            <i class="bi bi-chevron-right"></i>
          </a>
        </li>
      </ul>
    </nav>
  );
};

interface PaginationInfoProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export const PaginationInfo: FC<PaginationInfoProps> = ({
  currentPage,
  pageSize,
  totalItems,
}) => {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <span class="text-muted">
      Affichage {start}-{end} sur {totalItems}
    </span>
  );
};
