import type { FC } from 'hono/jsx';

interface ModalProps {
  id: string;
  title: string;
  children: any;
  size?: 'sm' | 'lg' | 'xl';
  footer?: any;
}

export const Modal: FC<ModalProps> = ({ id, title, children, size, footer }) => {
  const sizeClass = size ? `modal-${size}` : '';

  return (
    <div class="modal fade" id={id} tabindex={-1} aria-labelledby={`${id}Label`} aria-hidden="true">
      <div class={`modal-dialog ${sizeClass}`}>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id={`${id}Label`}>{title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            {children}
          </div>
          {footer && (
            <div class="modal-footer">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  id: string;
  title: string;
  message: string;
  confirmText?: string;
  confirmClass?: string;
  hxDelete?: string;
  hxPost?: string;
  hxTarget?: string;
}

export const ConfirmModal: FC<ConfirmModalProps> = ({
  id,
  title,
  message,
  confirmText = 'Confirmer',
  confirmClass = 'btn-danger',
  hxDelete,
  hxPost,
  hxTarget,
}) => {
  return (
    <Modal
      id={id}
      title={title}
      footer={
        <>
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
          <button
            type="button"
            class={`btn ${confirmClass}`}
            hx-delete={hxDelete}
            hx-post={hxPost}
            hx-target={hxTarget}
            data-bs-dismiss="modal"
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
};
