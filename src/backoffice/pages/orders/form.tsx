import type { FC } from 'hono/jsx';
import { Layout, FlashMessages } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface OrderFormData {
  id: string;
  number: string;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingNotes: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  notes: string | null;
  internalNotes: string | null;
}

interface OrderFormPageProps {
  order: OrderFormData;
  success?: string;
  error?: string;
  user: AdminUser;
}

export const OrderFormPage: FC<OrderFormPageProps> = ({
  order,
  success,
  error,
  user,
}) => {
  return (
    <Layout title={`Modifier ${order.number}`} currentPath="/backoffice/orders" user={user}>
      <FlashMessages success={success} error={error} />

      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0">Modifier la commande {order.number}</h4>
        <a href={`/backoffice/orders/${order.id}`} class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1"></i>Retour
        </a>
      </div>

      <form method="post" action={`/backoffice/orders/${order.id}`}>
        <div class="row">
          <div class="col-md-8">
            {/* Livraison */}
            <div class="card mb-4">
              <div class="card-header">
                <h6 class="mb-0">Adresse de livraison</h6>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">Adresse</label>
                  <input
                    type="text"
                    name="shippingAddress"
                    class="form-control"
                    value={order.shippingAddress || ''}
                  />
                </div>
                <div class="row">
                  <div class="col-md-4">
                    <div class="mb-3">
                      <label class="form-label">Code postal</label>
                      <input
                        type="text"
                        name="shippingPostalCode"
                        class="form-control"
                        value={order.shippingPostalCode || ''}
                      />
                    </div>
                  </div>
                  <div class="col-md-8">
                    <div class="mb-3">
                      <label class="form-label">Ville</label>
                      <input
                        type="text"
                        name="shippingCity"
                        class="form-control"
                        value={order.shippingCity || ''}
                      />
                    </div>
                  </div>
                </div>
                <div class="mb-0">
                  <label class="form-label">Instructions de livraison</label>
                  <textarea
                    name="shippingNotes"
                    class="form-control"
                    rows={2}
                  >{order.shippingNotes || ''}</textarea>
                </div>
              </div>
            </div>

            {/* Suivi */}
            <div class="card mb-4">
              <div class="card-header">
                <h6 class="mb-0">Suivi expedition</h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Transporteur</label>
                      <input
                        type="text"
                        name="carrier"
                        class="form-control"
                        value={order.carrier || ''}
                        placeholder="Ex: Chronopost, DHL..."
                      />
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Numero de suivi</label>
                      <input
                        type="text"
                        name="trackingNumber"
                        class="form-control"
                        value={order.trackingNumber || ''}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div class="card">
              <div class="card-header">
                <h6 class="mb-0">Notes</h6>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">Notes client</label>
                  <textarea
                    name="notes"
                    class="form-control"
                    rows={3}
                    placeholder="Notes visibles par le client..."
                  >{order.notes || ''}</textarea>
                </div>
                <div class="mb-0">
                  <label class="form-label">Notes internes</label>
                  <textarea
                    name="internalNotes"
                    class="form-control"
                    rows={3}
                    placeholder="Notes internes uniquement..."
                  >{order.internalNotes || ''}</textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-4">
            <div class="card">
              <div class="card-body">
                <button type="submit" class="btn btn-primary w-100">
                  <i class="bi bi-check-lg me-2"></i>Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
};
