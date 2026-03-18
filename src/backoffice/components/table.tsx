import type { FC } from 'hono/jsx';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => any;
  class?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  actions?: (item: T) => any;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  emptyMessage = 'Aucune donnee',
  actions,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div class="text-center text-muted py-5">
        <i class="bi bi-inbox display-4 d-block mb-3"></i>
        <p class="mb-0">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead>
          <tr>
            {columns.map((col) => (
              <th class={col.class}>{col.label}</th>
            ))}
            {actions && <th style="width: 150px;">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr id={`row-${item.id}`}>
              {columns.map((col) => (
                <td class={col.class}>
                  {col.render
                    ? col.render(item)
                    : (item as any)[col.key]?.toString() || '-'}
                </td>
              ))}
              {actions && <td>{actions(item)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TableActionsProps {
  editUrl?: string;
  deleteUrl?: string;
  viewUrl?: string;
  deleteConfirm?: string;
}

export const TableActions: FC<TableActionsProps> = ({
  editUrl,
  deleteUrl,
  viewUrl,
  deleteConfirm = 'Confirmer la suppression ?',
}) => {
  return (
    <div class="d-flex gap-1">
      {viewUrl && (
        <a href={viewUrl} class="btn btn-sm btn-outline-info btn-action" title="Voir">
          <i class="bi bi-eye"></i>
        </a>
      )}
      {editUrl && (
        <a href={editUrl} class="btn btn-sm btn-outline-primary btn-action" title="Modifier">
          <i class="bi bi-pencil"></i>
        </a>
      )}
      {deleteUrl && (
        <button
          class="btn btn-sm btn-outline-danger btn-action"
          title="Supprimer"
          hx-delete={deleteUrl}
          hx-confirm={deleteConfirm}
          hx-target="closest tr"
          hx-swap="outerHTML"
        >
          <i class="bi bi-trash"></i>
        </button>
      )}
    </div>
  );
};
