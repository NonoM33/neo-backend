import type { FC } from 'hono/jsx';
import { Layout } from '../../components';
import type { AdminUser } from '../../middleware/admin-auth';

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  surface: string | null;
  roomCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

interface Integrateur {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  roomId: string;
}

interface Device {
  id: string;
  name: string;
  status: string;
  isOnline: boolean | null;
  location: string | null;
  notes: string | null;
  productName: string | null;
  productCategory: string | null;
  roomId: string;
}

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  checked: boolean;
  notes: string | null;
  roomId: string;
}

interface Room {
  id: string;
  name: string;
  type: string;
  floor: number | null;
  notes: string | null;
}

interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceHT: string;
  tvaRate: string;
  totalHT: string;
  unitCostHT: string | null;
  clientOwned: boolean;
  productName: string | null;
}

interface Quote {
  id: string;
  number: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  totalCostHT: string | null;
  totalMarginHT: string | null;
  marginPercent: string | null;
  validUntil: Date | null;
  notes: string | null;
  pdfUrl: string | null;
  createdAt: Date;
  lines: QuoteLine[];
}

interface ProjectDetailPageProps {
  project: ProjectDetail;
  client: Client;
  integrateur: Integrateur;
  rooms: Room[];
  photos: Photo[];
  devices: Device[];
  checklist: ChecklistItem[];
  quotes: Quote[];
  user: AdminUser;
}

const statusColors: Record<string, string> = {
  brouillon: 'secondary',
  en_cours: 'primary',
  termine: 'success',
  archive: 'dark',
  envoye: 'info',
  accepte: 'success',
  refuse: 'danger',
  expire: 'warning',
};

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  termine: 'Termine',
  archive: 'Archive',
  envoye: 'Envoye',
  accepte: 'Accepte',
  refuse: 'Refuse',
  expire: 'Expire',
};

const deviceStatusColors: Record<string, string> = {
  planifie: 'secondary',
  installe: 'info',
  configure: 'warning',
  operationnel: 'success',
  en_panne: 'danger',
};

const deviceStatusLabels: Record<string, string> = {
  planifie: 'Planifie',
  installe: 'Installe',
  configure: 'Configure',
  operationnel: 'Operationnel',
  en_panne: 'En panne',
};

const roomTypeIcons: Record<string, string> = {
  salon: 'bi-lamp',
  cuisine: 'bi-cup-hot',
  chambre: 'bi-moon',
  salle_de_bain: 'bi-droplet',
  bureau: 'bi-pc-display',
  garage: 'bi-car-front',
  exterieur: 'bi-tree',
  autre: 'bi-square',
};

const roomTypeLabels: Record<string, string> = {
  salon: 'Salon',
  cuisine: 'Cuisine',
  chambre: 'Chambre',
  salle_de_bain: 'Salle de bain',
  bureau: 'Bureau',
  garage: 'Garage',
  exterieur: 'Exterieur',
  autre: 'Autre',
};

export const ProjectDetailPage: FC<ProjectDetailPageProps> = ({
  project,
  client,
  integrateur,
  rooms,
  photos,
  devices,
  checklist,
  quotes,
  user,
}) => {
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.isOnline).length;
  const faultyDevices = devices.filter(d => d.status === 'en_panne').length;
  const totalChecked = checklist.filter(c => c.checked).length;
  const totalChecklist = checklist.length;
  const checklistPercent = totalChecklist > 0 ? Math.round((totalChecked / totalChecklist) * 100) : 0;
  const acceptedQuotes = quotes.filter(q => q.status === 'accepte');
  const totalAcceptedTTC = acceptedQuotes.reduce((s, q) => s + parseFloat(q.totalTTC), 0);

  function getRoomPhotos(roomId: string) { return photos.filter(p => p.roomId === roomId); }
  function getRoomDevices(roomId: string) { return devices.filter(d => d.roomId === roomId); }
  function getRoomChecklist(roomId: string) { return checklist.filter(c => c.roomId === roomId); }

  return (
    <Layout title={project.name} currentPath="/backoffice/projects" user={user}>
      <style>{`
        .project-header {
          background: linear-gradient(135deg, #1a1d21 0%, #2d3339 100%);
          border-radius: 12px;
          padding: 24px 28px;
          color: #fff;
          margin-bottom: 24px;
        }
        .project-header .badge { font-size: 0.8rem; }
        .stat-mini {
          text-align: center;
          padding: 16px;
          border-radius: 10px;
          background: #f8f9fa;
        }
        .stat-mini-value { font-size: 1.5rem; font-weight: 700; }
        .stat-mini-label { font-size: 0.75rem; color: #6c757d; }
        .room-card {
          border: 1px solid #e9ecef;
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.2s;
          margin-bottom: 20px;
        }
        .room-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .room-card-header {
          padding: 14px 18px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .room-card-body { padding: 16px 18px; }
        .room-photos {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 8px;
        }
        .room-photo {
          width: 100px;
          height: 75px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          border: 2px solid #e9ecef;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .room-photo:hover { border-color: #0d6efd; }
        .device-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .device-row:last-child { border-bottom: none; }
        .device-online { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .device-online.on { background: #198754; box-shadow: 0 0 6px rgba(25,135,84,0.5); }
        .device-online.off { background: #dc3545; }
        .checklist-progress {
          height: 6px;
          border-radius: 3px;
          background: #e9ecef;
          overflow: hidden;
        }
        .checklist-progress-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s;
        }
        .photo-modal-overlay {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          z-index: 9999;
          justify-content: center;
          align-items: center;
          cursor: pointer;
        }
        .photo-modal-overlay.show { display: flex; }
        .photo-modal-overlay img {
          max-width: 90vw;
          max-height: 90vh;
          border-radius: 8px;
        }
      `}</style>

      {/* Photo modal */}
      <div id="photo-modal" class="photo-modal-overlay" onclick="this.classList.remove('show')">
        <img id="photo-modal-img" src="" alt="" />
      </div>

      {/* Project Header */}
      <div class="project-header">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="d-flex align-items-center gap-3 mb-2">
              <h2 class="mb-0">{project.name}</h2>
              <span class={`badge bg-${statusColors[project.status] || 'secondary'}`}>
                {statusLabels[project.status] || project.status}
              </span>
            </div>
            {project.description && (
              <p class="mb-2 opacity-75">{project.description}</p>
            )}
            <div class="d-flex gap-4 small opacity-75">
              {project.address && (
                <span><i class="bi bi-geo-alt me-1"></i>{project.address}{project.city ? `, ${project.city}` : ''}</span>
              )}
              {project.surface && (
                <span><i class="bi bi-arrows-fullscreen me-1"></i>{parseFloat(project.surface).toFixed(0)} m²</span>
              )}
              <span><i class="bi bi-calendar me-1"></i>{new Date(project.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
          <a href="/backoffice/projects" class="btn btn-outline-light btn-sm">
            <i class="bi bi-arrow-left me-1"></i>Retour
          </a>
        </div>
      </div>

      {/* Stats Row */}
      <div class="row g-3 mb-4">
        <div class="col-md-2">
          <div class="stat-mini">
            <div class="stat-mini-value">{rooms.length}</div>
            <div class="stat-mini-label">Pieces</div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-mini">
            <div class="stat-mini-value">{totalDevices}</div>
            <div class="stat-mini-label">Appareils</div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-mini">
            <div class={`stat-mini-value ${faultyDevices > 0 ? 'text-danger' : 'text-success'}`}>
              {totalDevices > 0 ? `${onlineDevices}/${totalDevices}` : '-'}
            </div>
            <div class="stat-mini-label">En ligne</div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-mini">
            <div class="stat-mini-value">{photos.length}</div>
            <div class="stat-mini-label">Photos</div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-mini">
            <div class="stat-mini-value">{checklistPercent}%</div>
            <div class="stat-mini-label">Checklist</div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-mini">
            <div class="stat-mini-value text-primary">
              {totalAcceptedTTC > 0
                ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalAcceptedTTC)
                : '-'}
            </div>
            <div class="stat-mini-label">Devis accepte TTC</div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        {/* Main Content */}
        <div class="col-lg-8">

          {/* Rooms with details */}
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0"><i class="bi bi-door-open me-2"></i>Pieces</h5>
          </div>

          {rooms.length === 0 ? (
            <div class="card">
              <div class="card-body text-center text-muted py-5">
                <i class="bi bi-door-open" style="font-size:3rem;"></i>
                <p class="mt-2 mb-0">Aucune piece configuree</p>
              </div>
            </div>
          ) : (
            rooms.map(room => {
              const rPhotos = getRoomPhotos(room.id);
              const rDevices = getRoomDevices(room.id);
              const rChecklist = getRoomChecklist(room.id);
              const rChecked = rChecklist.filter(c => c.checked).length;
              const rTotal = rChecklist.length;
              const rPercent = rTotal > 0 ? Math.round((rChecked / rTotal) * 100) : -1;

              return (
                <div class="room-card">
                  <div class="room-card-header">
                    <div class="d-flex align-items-center gap-2">
                      <i class={`bi ${roomTypeIcons[room.type] || 'bi-square'} fs-5`}></i>
                      <div>
                        <div class="fw-bold">{room.name}</div>
                        <div class="small text-muted">
                          {roomTypeLabels[room.type] || room.type}
                          {room.floor !== null && room.floor !== 0 && ` · Etage ${room.floor}`}
                        </div>
                      </div>
                    </div>
                    <div class="d-flex gap-3 align-items-center">
                      {rDevices.length > 0 && (
                        <span class="badge bg-primary bg-opacity-10 text-primary">
                          <i class="bi bi-cpu me-1"></i>{rDevices.length}
                        </span>
                      )}
                      {rPhotos.length > 0 && (
                        <span class="badge bg-info bg-opacity-10 text-info">
                          <i class="bi bi-camera me-1"></i>{rPhotos.length}
                        </span>
                      )}
                      {rPercent >= 0 && (
                        <span class={`badge bg-${rPercent === 100 ? 'success' : 'warning'} bg-opacity-10 text-${rPercent === 100 ? 'success' : 'warning'}`}>
                          <i class="bi bi-check2-square me-1"></i>{rPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div class="room-card-body">
                    {room.notes && (
                      <p class="text-muted small mb-3 fst-italic">{room.notes}</p>
                    )}

                    {/* Photos */}
                    {rPhotos.length > 0 && (
                      <div class="mb-3">
                        <div class="small fw-medium text-muted mb-2">
                          <i class="bi bi-camera me-1"></i>Photos
                        </div>
                        <div class="room-photos">
                          {rPhotos.map(photo => (
                            <img
                              src={photo.url}
                              alt={photo.caption || room.name}
                              class="room-photo"
                              title={photo.caption || ''}
                              onclick={`document.getElementById('photo-modal-img').src='${photo.url}';document.getElementById('photo-modal').classList.add('show');event.stopPropagation();`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Devices */}
                    {rDevices.length > 0 && (
                      <div class="mb-3">
                        <div class="small fw-medium text-muted mb-2">
                          <i class="bi bi-cpu me-1"></i>Appareils
                        </div>
                        {rDevices.map(device => (
                          <div class="device-row">
                            <div class={`device-online ${device.isOnline ? 'on' : 'off'}`}
                                 title={device.isOnline ? 'En ligne' : 'Hors ligne'}></div>
                            <div style="flex:1;min-width:0;">
                              <div class="fw-medium" style="font-size:0.85rem;">{device.name}</div>
                              {device.productName && (
                                <div class="text-muted" style="font-size:0.75rem;">
                                  {device.productName}
                                  {device.productCategory && ` · ${device.productCategory}`}
                                </div>
                              )}
                            </div>
                            <span class={`badge bg-${deviceStatusColors[device.status] || 'secondary'}`} style="font-size:0.65rem;">
                              {deviceStatusLabels[device.status] || device.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Checklist */}
                    {rChecklist.length > 0 && (
                      <div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                          <div class="small fw-medium text-muted">
                            <i class="bi bi-check2-square me-1"></i>Checklist
                          </div>
                          <span class="small text-muted">{rChecked}/{rTotal}</span>
                        </div>
                        <div class="checklist-progress mb-2">
                          <div
                            class="checklist-progress-bar"
                            style={`width:${rPercent}%;background:${rPercent === 100 ? '#198754' : rPercent > 50 ? '#ffc107' : '#dc3545'};`}
                          ></div>
                        </div>
                        <div style="max-height:150px;overflow-y:auto;">
                          {rChecklist.map(item => (
                            <div class="d-flex align-items-start gap-2 py-1" style="font-size:0.8rem;">
                              <i class={`bi ${item.checked ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'}`} style="margin-top:2px;"></i>
                              <div style="flex:1;">
                                <span class={item.checked ? 'text-decoration-line-through text-muted' : ''}>{item.label}</span>
                                {item.notes && <span class="text-muted fst-italic ms-1">— {item.notes}</span>}
                              </div>
                              <span class="badge bg-light text-muted" style="font-size:0.6rem;">{item.category}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rPhotos.length === 0 && rDevices.length === 0 && rChecklist.length === 0 && !room.notes && (
                      <p class="text-muted small mb-0 text-center py-2">Aucun contenu pour cette piece</p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* All Photos Gallery */}
          {photos.length > 0 && (
            <div class="card mt-4">
              <div class="card-header">
                <i class="bi bi-images me-2"></i>Toutes les photos ({photos.length})
              </div>
              <div class="card-body">
                <div class="row g-2">
                  {photos.map(photo => (
                    <div class="col-4 col-md-3 col-lg-2">
                      <img
                        src={photo.url}
                        alt={photo.caption || ''}
                        class="w-100 rounded"
                        style="height:100px;object-fit:cover;cursor:pointer;border:2px solid #e9ecef;"
                        title={photo.caption || ''}
                        onclick={`document.getElementById('photo-modal-img').src='${photo.url}';document.getElementById('photo-modal').classList.add('show');event.stopPropagation();`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quotes */}
          <div class="mt-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0"><i class="bi bi-file-text me-2"></i>Devis ({quotes.length})</h5>
            </div>

            {quotes.length === 0 ? (
              <div class="card">
                <div class="card-body text-center text-muted py-5">
                  <i class="bi bi-file-text" style="font-size:3rem;"></i>
                  <p class="mt-2 mb-0">Aucun devis</p>
                </div>
              </div>
            ) : (
              quotes.map((quote) => {
                const mp = quote.marginPercent ? parseFloat(quote.marginPercent) : null;
                const marginColor = mp !== null ? (mp >= 30 ? 'success' : mp >= 15 ? 'warning' : 'danger') : 'secondary';
                const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date() && quote.status === 'envoye';
                return (
                  <div class="card mb-3" id={`quote-${quote.id}`}>
                    <div
                      class="card-header"
                      style="cursor:pointer;"
                      onclick={`var el=document.getElementById('quote-body-${quote.id}');el.style.display=el.style.display==='none'?'block':'none';var icon=document.getElementById('quote-icon-${quote.id}');icon.classList.toggle('bi-chevron-down');icon.classList.toggle('bi-chevron-up');`}
                    >
                      <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-3">
                          <i id={`quote-icon-${quote.id}`} class="bi bi-chevron-down text-muted"></i>
                          <div>
                            <span class="fw-bold">{quote.number}</span>
                            <span class="text-muted ms-2 small">
                              {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <span class={`badge bg-${statusColors[quote.status] || 'secondary'}`}>
                            {statusLabels[quote.status] || quote.status}
                          </span>
                          {isExpired && (
                            <span class="badge bg-danger bg-opacity-10 text-danger">
                              <i class="bi bi-exclamation-triangle me-1"></i>Expire
                            </span>
                          )}
                        </div>
                        <div class="d-flex align-items-center gap-3">
                          {mp !== null && (
                            <span class={`badge bg-${marginColor}`}>Marge {mp.toFixed(1)}%</span>
                          )}
                          <span class="fw-bold fs-6">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(quote.totalTTC))}
                          </span>
                          {quote.pdfUrl && (
                            <a href={quote.pdfUrl} target="_blank" class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation();" title="Telecharger PDF">
                              <i class="bi bi-file-pdf"></i>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div id={`quote-body-${quote.id}`} style="display:none;">
                      <div class="card-body p-0">
                        {/* Summary row */}
                        <div class="d-flex gap-4 px-3 py-2 bg-light border-bottom" style="font-size:0.8rem;">
                          <span>
                            <span class="text-muted">HT:</span>{' '}
                            <strong>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(quote.totalHT))}</strong>
                          </span>
                          {quote.totalCostHT && parseFloat(quote.totalCostHT) > 0 && (
                            <span>
                              <span class="text-muted">Cout:</span>{' '}
                              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(quote.totalCostHT))}
                            </span>
                          )}
                          {quote.totalMarginHT && parseFloat(quote.totalMarginHT) > 0 && (
                            <span>
                              <span class="text-muted">Marge:</span>{' '}
                              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(quote.totalMarginHT))}
                            </span>
                          )}
                          {quote.validUntil && (
                            <span>
                              <span class="text-muted">Valide jusqu'au:</span>{' '}
                              <span class={isExpired ? 'text-danger fw-bold' : ''}>
                                {new Date(quote.validUntil).toLocaleDateString('fr-FR')}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Quote lines */}
                        {quote.lines.length > 0 ? (
                          <table class="table table-sm mb-0" style="font-size:0.85rem;">
                            <thead>
                              <tr class="text-muted">
                                <th style="padding-left:16px;">Produit / Description</th>
                                <th class="text-center">Qte</th>
                                <th class="text-end">P.U. HT</th>
                                <th class="text-end">TVA</th>
                                <th class="text-end">Total HT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {quote.lines.map(line => (
                                <tr class={line.clientOwned ? 'bg-success bg-opacity-10' : ''}>
                                  <td style="padding-left:16px;">
                                    <div class="fw-medium">{line.description}</div>
                                    {line.productName && (
                                      <div class="text-muted" style="font-size:0.75rem;">
                                        <i class="bi bi-box-seam me-1"></i>{line.productName}
                                      </div>
                                    )}
                                    {line.clientOwned && (
                                      <span class="badge bg-success bg-opacity-10 text-success" style="font-size:0.6rem;">
                                        <i class="bi bi-check me-1"></i>Fourni par le client
                                      </span>
                                    )}
                                  </td>
                                  <td class="text-center">{line.quantity}</td>
                                  <td class="text-end">
                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(line.unitPriceHT))}
                                  </td>
                                  <td class="text-end text-muted">{parseFloat(line.tvaRate).toFixed(0)}%</td>
                                  <td class="text-end fw-medium">
                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(line.totalHT))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div class="p-3 text-center text-muted small">Aucune ligne dans ce devis</div>
                        )}

                        {/* Notes */}
                        {quote.notes && (
                          <div class="px-3 py-2 border-top bg-light">
                            <span class="text-muted small"><i class="bi bi-sticky me-1"></i>{quote.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div class="col-lg-4">
          {/* Client */}
          <div class="card mb-3">
            <div class="card-header">
              <i class="bi bi-person-badge me-2"></i>Client
            </div>
            <div class="card-body">
              <h6 class="mb-1">{client.firstName} {client.lastName}</h6>
              {client.email && (
                <p class="mb-1 small">
                  <i class="bi bi-envelope me-2 text-muted"></i>
                  <a href={`mailto:${client.email}`}>{client.email}</a>
                </p>
              )}
              {client.phone && (
                <p class="mb-1 small">
                  <i class="bi bi-telephone me-2 text-muted"></i>{client.phone}
                </p>
              )}
              {(client.address || client.city) && (
                <p class="mb-0 text-muted small">
                  <i class="bi bi-geo-alt me-2"></i>
                  {client.address}{client.city && `, ${client.city}`}
                </p>
              )}
              <a href={`/backoffice/clients/${client.id}`} class="btn btn-sm btn-outline-primary mt-2">
                <i class="bi bi-eye me-1"></i>Voir fiche
              </a>
            </div>
          </div>

          {/* Integrateur */}
          <div class="card mb-3">
            <div class="card-header">
              <i class="bi bi-person-gear me-2"></i>Integrateur
            </div>
            <div class="card-body">
              <h6 class="mb-1">{integrateur.firstName} {integrateur.lastName}</h6>
              <p class="mb-0 small">
                <i class="bi bi-envelope me-2 text-muted"></i>
                <a href={`mailto:${integrateur.email}`}>{integrateur.email}</a>
              </p>
            </div>
          </div>

          {/* Devices Summary */}
          {totalDevices > 0 && (
            <div class="card mb-3">
              <div class="card-header">
                <i class="bi bi-cpu me-2"></i>Appareils
              </div>
              <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                  <span class="text-muted small">Total</span>
                  <span class="fw-medium">{totalDevices}</span>
                </div>
                <div class="d-flex justify-content-between mb-2">
                  <span class="text-muted small">En ligne</span>
                  <span class="fw-medium text-success">{onlineDevices}</span>
                </div>
                {faultyDevices > 0 && (
                  <div class="d-flex justify-content-between mb-2">
                    <span class="text-muted small">En panne</span>
                    <span class="fw-bold text-danger">{faultyDevices}</span>
                  </div>
                )}
                <hr class="my-2" />
                <div class="small text-muted">Par statut :</div>
                {Object.entries(deviceStatusLabels).map(([key, label]) => {
                  const cnt = devices.filter(d => d.status === key).length;
                  if (cnt === 0) return null;
                  return (
                    <div class="d-flex justify-content-between" style="font-size:0.8rem;">
                      <span>
                        <span class={`badge bg-${deviceStatusColors[key]}`} style="font-size:0.6rem;width:8px;height:8px;padding:0;border-radius:50;display:inline-block;margin-right:6px;"></span>
                        {label}
                      </span>
                      <span>{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist Global */}
          {totalChecklist > 0 && (
            <div class="card mb-3">
              <div class="card-header">
                <i class="bi bi-check2-square me-2"></i>Progression checklist
              </div>
              <div class="card-body">
                <div class="d-flex justify-content-between mb-2">
                  <span class="fw-bold" style="font-size:1.5rem;">{checklistPercent}%</span>
                  <span class="text-muted align-self-end">{totalChecked}/{totalChecklist}</span>
                </div>
                <div class="checklist-progress" style="height:10px;">
                  <div
                    class="checklist-progress-bar"
                    style={`width:${checklistPercent}%;background:${checklistPercent === 100 ? '#198754' : checklistPercent > 50 ? '#ffc107' : '#dc3545'};`}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
