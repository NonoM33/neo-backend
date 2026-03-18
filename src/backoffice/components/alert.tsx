import type { FC } from 'hono/jsx';

type AlertType = 'success' | 'danger' | 'warning' | 'info';

interface AlertProps {
  type: AlertType;
  message: string;
  dismissible?: boolean;
}

const iconMap: Record<AlertType, string> = {
  success: 'bi-check-circle',
  danger: 'bi-exclamation-triangle',
  warning: 'bi-exclamation-circle',
  info: 'bi-info-circle',
};

export const Alert: FC<AlertProps> = ({ type, message, dismissible = true }) => {
  return (
    <div class={`alert alert-${type} ${dismissible ? 'alert-dismissible fade show' : ''}`} role="alert">
      <i class={`bi ${iconMap[type]} me-2`}></i>
      {message}
      {dismissible && (
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      )}
    </div>
  );
};

interface FlashMessagesProps {
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
}

export const FlashMessages: FC<FlashMessagesProps> = ({ success, error, warning, info }) => {
  return (
    <>
      {success && <Alert type="success" message={success} />}
      {error && <Alert type="danger" message={error} />}
      {warning && <Alert type="warning" message={warning} />}
      {info && <Alert type="info" message={info} />}
    </>
  );
};
