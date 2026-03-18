import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { rateLimit } from '../../middleware/rate-limit.middleware';
import * as trackingService from './tracking.service';

const publicTrackingRouter = new Hono();

// Rate limiting for public endpoints
publicTrackingRouter.use('*', rateLimit({ maxRequests: 60, windowMs: 60000 }));

// ─── GET /tracking/:token ───────────────────────────────────────────────────
// Public tracking page with map
publicTrackingRouter.get('/:token', async (c) => {
  const token = c.req.param('token');
  const data = await trackingService.getSessionByToken(token);

  if (!data) {
    return c.html(renderNotFoundPage(), 404);
  }

  const { session, auditorName, appointmentTime } = data;

  // Check if expired
  if (session.status === 'expired' || (session.expiresAt && new Date(session.expiresAt) < new Date())) {
    return c.html(renderExpiredPage());
  }

  // Check if cancelled
  if (session.status === 'cancelled') {
    return c.html(renderCancelledPage());
  }

  return c.html(renderTrackingPage(token, session, auditorName, appointmentTime));
});

// ─── GET /tracking/:token/status ────────────────────────────────────────────
// JSON status (fallback for polling)
publicTrackingRouter.get('/:token/status', async (c) => {
  const token = c.req.param('token');
  const data = await trackingService.getSessionByToken(token);

  if (!data) {
    return c.json({ error: 'Session introuvable' }, 404);
  }

  const { session } = data;

  return c.json({
    status: session.status,
    lat: session.currentLat ? parseFloat(session.currentLat) : null,
    lng: session.currentLng ? parseFloat(session.currentLng) : null,
    eta: session.etaMinutes,
    updatedAt: session.currentLocationUpdatedAt,
  });
});

// ─── GET /tracking/:token/sse ───────────────────────────────────────────────
// Server-Sent Events stream for real-time updates
publicTrackingRouter.get('/:token/sse', async (c) => {
  const token = c.req.param('token');

  return streamSSE(c, async (stream) => {
    let lastUpdate = '';

    const sendUpdate = async () => {
      const data = await trackingService.getSessionByToken(token);

      if (!data) {
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: 'Session introuvable' }) });
        return false;
      }

      const { session } = data;

      // Calculate progress (0-100) based on ETA reduction
      const progress = session.status === 'arrived' ? 100 : (session.etaMinutes ? Math.max(0, 100 - session.etaMinutes * 2) : 50);

      const update = JSON.stringify({
        status: session.status,
        lat: session.currentLat ? parseFloat(session.currentLat) : null,
        lng: session.currentLng ? parseFloat(session.currentLng) : null,
        eta: session.etaMinutes,
        progress,
        updatedAt: session.currentLocationUpdatedAt?.toISOString(),
      });

      // Only send if changed
      if (update !== lastUpdate) {
        lastUpdate = update;
        await stream.writeSSE({ event: 'update', data: update });
      }

      // Stop streaming if arrived, expired, or cancelled
      if (session.status === 'arrived' || session.status === 'expired' || session.status === 'cancelled') {
        return false;
      }

      return true;
    };

    // Send initial update
    const shouldContinue = await sendUpdate();
    if (!shouldContinue) return;

    // Send updates every 3 seconds
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        const shouldContinue = await sendUpdate();
        if (!shouldContinue) break;
      } catch (error) {
        console.error('[SSE] Error:', error);
        break;
      }
    }
  });
});

// ─── GET /tracking/:token/route ─────────────────────────────────────────────
// Get location history for drawing the route
publicTrackingRouter.get('/:token/route', async (c) => {
  const token = c.req.param('token');
  const data = await trackingService.getSessionByToken(token);

  if (!data) {
    return c.json({ error: 'Session introuvable' }, 404);
  }

  const history = await trackingService.getLocationHistory(data.session.id);

  return c.json({ route: history });
});

// ─── HTML Templates ─────────────────────────────────────────────────────────

function renderNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page introuvable - Neo Domotique</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Neo</div>
      <div class="status-text error">Lien invalide</div>
    </div>
    <div class="message-box">
      <div class="icon">🔗</div>
      <h2>Lien de suivi introuvable</h2>
      <p>Ce lien de suivi n'existe pas ou a été supprimé.</p>
    </div>
  </div>
</body>
</html>`;
}

function renderExpiredPage(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session expirée - Neo Domotique</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Neo</div>
      <div class="status-text warning">Session expirée</div>
    </div>
    <div class="message-box">
      <div class="icon">⏰</div>
      <h2>Session de suivi expirée</h2>
      <p>Cette session de suivi a expiré. Les sessions sont valides pendant 4 heures.</p>
    </div>
  </div>
</body>
</html>`;
}

function renderCancelledPage(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Suivi annulé - Neo Domotique</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Neo</div>
      <div class="status-text warning">Annulé</div>
    </div>
    <div class="message-box">
      <div class="icon">❌</div>
      <h2>Suivi annulé</h2>
      <p>Le suivi en temps réel a été annulé par l'auditeur.</p>
    </div>
  </div>
</body>
</html>`;
}

function renderTrackingPage(
  token: string,
  session: any,
  auditorName: string,
  appointmentTime: Date
): string {
  const destLat = session.destinationLat ? parseFloat(session.destinationLat) : null;
  const destLng = session.destinationLng ? parseFloat(session.destinationLng) : null;
  const currentLat = session.currentLat ? parseFloat(session.currentLat) : null;
  const currentLng = session.currentLng ? parseFloat(session.currentLng) : null;
  const eta = session.etaMinutes ?? '--';
  const isArrived = session.status === 'arrived';
  const appointmentTimeStr = new Date(appointmentTime).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Suivi en temps réel - Neo Domotique</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    ${getBaseStyles()}

    #map {
      width: 100%;
      height: 50vh;
      min-height: 300px;
      border-radius: 12px;
      margin-bottom: 16px;
    }

    .info-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    }

    .eta-section {
      text-align: center;
      margin-bottom: 20px;
    }

    .eta-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 4px;
    }

    .eta-value {
      font-size: 48px;
      font-weight: 700;
      color: #1a1d21;
    }

    .eta-unit {
      font-size: 18px;
      color: #666;
      margin-left: 4px;
    }

    .eta-arrived {
      color: #198754;
      font-size: 32px;
    }

    .progress-bar {
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 20px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #0d6efd, #198754);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .auditor-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid #e9ecef;
    }

    .auditor-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #0d6efd;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 18px;
    }

    .auditor-details {
      flex: 1;
    }

    .auditor-name {
      font-weight: 600;
      color: #1a1d21;
    }

    .auditor-role {
      font-size: 13px;
      color: #666;
    }

    .appointment-time {
      text-align: center;
      font-size: 13px;
      color: #666;
      margin-top: 16px;
    }

    .pulse-marker {
      width: 20px;
      height: 20px;
      background: #0d6efd;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      position: relative;
    }

    .pulse-marker::after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #0d6efd;
      animation: pulse 2s infinite;
      left: 0;
      top: 0;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }

    .destination-marker {
      width: 32px;
      height: 32px;
      background: #dc3545;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }

    .destination-marker::after {
      content: '';
      position: absolute;
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .connection-status {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      display: none;
    }

    .connection-status.show {
      display: block;
    }

    .connection-status.error {
      background: #dc3545;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Neo</div>
      <div class="status-text ${isArrived ? 'success' : ''}" id="status-text">
        ${isArrived ? 'Arrivé !' : 'En route...'}
      </div>
    </div>

    <div id="map"></div>

    <div class="info-card">
      <div class="eta-section">
        <div class="eta-label">Arrivée estimée</div>
        <div id="eta-display" class="${isArrived ? 'eta-arrived' : ''}">
          ${isArrived ? 'Arrivé !' : `<span class="eta-value" id="eta-value">${eta}</span><span class="eta-unit">min</span>`}
        </div>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill" style="width: ${isArrived ? 100 : Math.min(90, 100 - (session.etaMinutes || 0) * 2)}%"></div>
      </div>

      <div class="auditor-info">
        <div class="auditor-avatar">${auditorName.split(' ').map(n => n[0]).join('')}</div>
        <div class="auditor-details">
          <div class="auditor-name">${auditorName}</div>
          <div class="auditor-role">Auditeur Neo Domotique</div>
        </div>
      </div>

      <div class="appointment-time">
        RDV prévu à ${appointmentTimeStr}
      </div>
    </div>
  </div>

  <div class="connection-status" id="connection-status">Reconnexion...</div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const TOKEN = '${token}';
    const DEST_LAT = ${destLat ?? 'null'};
    const DEST_LNG = ${destLng ?? 'null'};
    let currentLat = ${currentLat ?? 'null'};
    let currentLng = ${currentLng ?? 'null'};
    let isArrived = ${isArrived};

    // Initialize map
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Custom markers
    const auditorIcon = L.divIcon({
      className: 'auditor-marker',
      html: '<div class="pulse-marker"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const destIcon = L.divIcon({
      className: 'dest-marker',
      html: '<div class="destination-marker"></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    let auditorMarker = null;
    let destMarker = null;
    let routeLine = null;

    // Add destination marker
    if (DEST_LAT && DEST_LNG) {
      destMarker = L.marker([DEST_LAT, DEST_LNG], { icon: destIcon }).addTo(map);
    }

    // Add auditor marker
    if (currentLat && currentLng) {
      auditorMarker = L.marker([currentLat, currentLng], { icon: auditorIcon }).addTo(map);
    }

    // Fit bounds
    function fitBounds() {
      const bounds = [];
      if (currentLat && currentLng) bounds.push([currentLat, currentLng]);
      if (DEST_LAT && DEST_LNG) bounds.push([DEST_LAT, DEST_LNG]);

      if (bounds.length === 2) {
        map.fitBounds(bounds, { padding: [50, 50] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else {
        map.setView([46.603354, 1.888334], 6); // France center
      }
    }
    fitBounds();

    // Update UI
    function updateUI(data) {
      if (data.status === 'arrived' && !isArrived) {
        isArrived = true;
        document.getElementById('status-text').textContent = 'Arrivé !';
        document.getElementById('status-text').classList.add('success');
        document.getElementById('eta-display').innerHTML = '<span class="eta-arrived">Arrivé !</span>';
        document.getElementById('progress-fill').style.width = '100%';
      }

      if (data.lat && data.lng && !isArrived) {
        currentLat = data.lat;
        currentLng = data.lng;

        if (auditorMarker) {
          auditorMarker.setLatLng([data.lat, data.lng]);
        } else {
          auditorMarker = L.marker([data.lat, data.lng], { icon: auditorIcon }).addTo(map);
        }

        if (data.eta !== null && data.eta !== undefined) {
          document.getElementById('eta-value').textContent = data.eta;
        }

        if (data.progress !== undefined) {
          document.getElementById('progress-fill').style.width = Math.min(95, data.progress) + '%';
        }
      }
    }

    // SSE connection
    let eventSource = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    function connectSSE() {
      if (isArrived) return;

      eventSource = new EventSource('/tracking/' + TOKEN + '/sse');

      eventSource.addEventListener('update', (e) => {
        reconnectAttempts = 0;
        hideConnectionStatus();
        try {
          const data = JSON.parse(e.data);
          updateUI(data);
        } catch (err) {
          console.error('Parse error:', err);
        }
      });

      eventSource.addEventListener('error', (e) => {
        eventSource.close();
        if (reconnectAttempts < maxReconnectAttempts && !isArrived) {
          reconnectAttempts++;
          showConnectionStatus('Reconnexion...', false);
          setTimeout(connectSSE, 3000 * reconnectAttempts);
        } else if (!isArrived) {
          showConnectionStatus('Connexion perdue', true);
          startPolling();
        }
      });
    }

    // Fallback polling
    let pollingInterval = null;

    function startPolling() {
      if (pollingInterval || isArrived) return;

      pollingInterval = setInterval(async () => {
        if (isArrived) {
          clearInterval(pollingInterval);
          return;
        }

        try {
          const res = await fetch('/tracking/' + TOKEN + '/status');
          if (res.ok) {
            const data = await res.json();
            updateUI(data);
            hideConnectionStatus();
          }
        } catch (err) {
          showConnectionStatus('Connexion perdue', true);
        }
      }, 5000);
    }

    function showConnectionStatus(msg, isError) {
      const el = document.getElementById('connection-status');
      el.textContent = msg;
      el.classList.add('show');
      if (isError) el.classList.add('error');
      else el.classList.remove('error');
    }

    function hideConnectionStatus() {
      document.getElementById('connection-status').classList.remove('show');
    }

    // Start SSE connection
    if (!isArrived) {
      connectSSE();
    }
  </script>
</body>
</html>`;
}

function getBaseStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
      min-height: 100vh;
    }

    .container {
      max-width: 480px;
      margin: 0 auto;
      padding: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #1a1d21;
    }

    .status-text {
      font-size: 14px;
      font-weight: 500;
      color: #666;
    }

    .status-text.success {
      color: #198754;
    }

    .status-text.warning {
      color: #ffc107;
    }

    .status-text.error {
      color: #dc3545;
    }

    .message-box {
      background: white;
      border-radius: 12px;
      padding: 40px 20px;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    }

    .message-box .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .message-box h2 {
      font-size: 20px;
      color: #1a1d21;
      margin-bottom: 8px;
    }

    .message-box p {
      color: #666;
      font-size: 14px;
    }
  `;
}

export default publicTrackingRouter;
