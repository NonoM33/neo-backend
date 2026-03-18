import { Hono } from 'hono';
import { html } from 'hono/html';
import {
  createSession,
  getSession,
  updateSessionStatus,
  uploadSessionResult,
} from './scan-sessions.service';

const app = new Hono();

// ─── API Routes (used by Flutter app) ───────────────────────────────

/** Create a new scan session (from iPad) */
app.post('/api/scan-sessions', async (c) => {
  const body = await c.req.json();
  const session = createSession({
    id: body.id,
    roomId: body.roomId,
    projectId: body.projectId,
    roomName: body.roomName,
  });
  return c.json(session, 201);
});

/** Get session status (polled by iPad) */
app.get('/api/scan-sessions/:id', (c) => {
  const session = getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json(session);
});

/** Upload scan result (from iPhone web page) */
app.put('/api/scan-sessions/:id/result', async (c) => {
  const body = await c.req.json();
  const session = uploadSessionResult(c.req.param('id'), body.plan);
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json(session);
});

/** Update session status */
app.patch('/api/scan-sessions/:id', async (c) => {
  const body = await c.req.json();
  const session = updateSessionStatus(c.req.param('id'), body.status);
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json(session);
});

// ─── Web Page (opened by iPhone via QR code) ────────────────────────

app.get('/scan/:id', (c) => {
  const sessionId = c.req.param('id');
  const session = getSession(sessionId);

  if (!session) {
    return c.html(html`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Neo - Session expirée</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="icon error">✕</div>
    <h1>Session expirée</h1>
    <p>Ce lien de scan n'est plus valide. Générez un nouveau QR code depuis l'iPad.</p>
  </div>
</body>
</html>`);
  }

  // Mark session as scanning
  updateSessionStatus(sessionId, 'scanning');

  const apiBase = new URL(c.req.url).origin;

  return c.html(html`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Neo - Scanner ${session.roomName || 'la pièce'}</title>
  <style>${baseStyles()}${scanPageStyles()}</style>
</head>
<body>
  <div class="header">
    <div class="logo">Neo</div>
    <div class="room-name">${session.roomName || 'Pièce'}</div>
  </div>

  <div class="container" id="app">
    <!-- Step 0: LiDAR detection (shown first on capable devices) -->
    <div id="step0" class="step">
      <div class="lidar-card">
        <div class="lidar-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h2 style="margin:12px 0 4px;font-size:18px">Scan LiDAR disponible</h2>
        <p style="font-size:13px;color:#666;margin-bottom:16px">
          Votre appareil supporte le scan 3D automatique.<br>
          Ouvrez l'app Neo pour un scan instantané.
        </p>
        <a href="neo://scan?session=${sessionId}&room=${session.roomId}&project=${session.projectId}&name=${encodeURIComponent(session.roomName)}"
           class="btn-primary" id="lidar-btn"
           style="display:block;text-align:center;text-decoration:none;color:white">
          Ouvrir Neo — Scan LiDAR
        </a>
        <p style="font-size:11px;color:#999;margin-top:8px;text-align:center" id="lidar-fallback-text"></p>
      </div>

      <div style="display:flex;align-items:center;gap:12px;margin:20px 0">
        <div style="flex:1;height:1px;background:#ddd"></div>
        <span style="font-size:13px;color:#999;font-weight:600">OU MANUELLEMENT</span>
        <div style="flex:1;height:1px;background:#ddd"></div>
      </div>

      <button class="btn-secondary" onclick="goToStep1()" style="width:100%">
        Entrer les mesures à la main →
      </button>
    </div>

    <!-- Step 1: Room dimensions -->
    <div id="step1" class="step">
      <div class="icon">📐</div>
      <h1>Mesures de la pièce</h1>
      <p>Entrez les dimensions ou mesurez avec votre appareil</p>

      <div class="form-section">
        <h2>Forme de la pièce</h2>
        <div class="shape-selector">
          <button class="shape-btn active" onclick="selectShape('rectangle')">
            <svg width="40" height="30" viewBox="0 0 40 30"><rect x="2" y="2" width="36" height="26" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            <span>Rectangle</span>
          </button>
          <button class="shape-btn" onclick="selectShape('l-shape')">
            <svg width="40" height="30" viewBox="0 0 40 30"><path d="M2 2h36v26h-20v-14h-16z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            <span>L</span>
          </button>
        </div>
      </div>

      <div class="form-section" id="rect-form">
        <h2>Dimensions</h2>
        <div class="input-row">
          <div class="input-group">
            <label>Largeur</label>
            <div class="input-with-unit">
              <input type="number" id="width" value="4" step="0.1" min="0.5" max="30" inputmode="decimal">
              <span class="unit">m</span>
            </div>
          </div>
          <div class="input-group">
            <label>Profondeur</label>
            <div class="input-with-unit">
              <input type="number" id="depth" value="3" step="0.1" min="0.5" max="30" inputmode="decimal">
              <span class="unit">m</span>
            </div>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h2>Ouvertures</h2>
        <div id="openings-list"></div>
        <button class="btn-secondary" onclick="addOpening()">+ Ajouter une ouverture</button>
      </div>

      <button class="btn-primary" onclick="goToStep2()">
        Visualiser le plan →
      </button>
    </div>

    <!-- Step 2: Preview & Send -->
    <div id="step2" class="step">
      <canvas id="preview-canvas" width="350" height="300"></canvas>
      <div class="preview-info">
        <span id="preview-dims"></span>
        <span id="preview-surface"></span>
      </div>

      <div class="actions">
        <button class="btn-secondary" onclick="goToStep1()">← Modifier</button>
        <button class="btn-primary" id="send-btn" onclick="sendToIPad()">
          Envoyer vers l'iPad ✓
        </button>
      </div>
    </div>

    <!-- Step 3: Done -->
    <div id="step3" class="step">
      <div class="icon success">✓</div>
      <h1>Plan envoyé !</h1>
      <p>Le plan apparaît maintenant sur l'iPad.<br>Vous pouvez fermer cette page.</p>
    </div>
  </div>

  <script>
    const SESSION_ID = '${sessionId}';
    const API_BASE = '${apiBase}';
    let currentShape = 'rectangle';
    let openings = [];

    // ─── LiDAR detection & deep link ──────────────────────────
    (function detectLiDAR() {
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad/.test(ua);
      // iPhone 12 Pro+, 13 Pro+, 14 Pro+, 15 Pro+, 16+ have LiDAR
      const proModels = /iPhone1[3-9],\d|iPhone[2-9]\d/.test(ua);
      // iPad Pro 2020+ has LiDAR
      const iPadPro = /iPad/.test(ua) && /iPad[1-9]\d/.test(ua);
      const hasLiDAR = isIOS && (proModels || iPadPro);

      if (hasLiDAR || isIOS) {
        // Show LiDAR step first (even on non-Pro, let user try the deep link)
        document.getElementById('step0').classList.add('active');

        if (!hasLiDAR) {
          // Non-Pro device: adjust messaging
          document.querySelector('#step0 h2').textContent = 'App Neo disponible';
          document.querySelector('#step0 h2 + p').textContent =
            'Ouvrez l\\'app Neo pour scanner ou mesurer la pièce.';
        }

        // Deep link fallback: if app is not installed, redirect to manual after 2s
        const lidarBtn = document.getElementById('lidar-btn');
        lidarBtn.addEventListener('click', function(e) {
          const fallbackText = document.getElementById('lidar-fallback-text');
          setTimeout(function() {
            // If we're still on this page after 2s, app is not installed
            fallbackText.textContent = 'App non installée ? Utilisez les mesures manuelles ci-dessous.';
          }, 2000);
        });
      } else {
        // Non-iOS: go straight to manual measurements
        document.getElementById('step1').classList.add('active');
      }
    })();

    function goToStep1() {
      document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
      document.getElementById('step1').classList.add('active');
    }

    function selectShape(shape) {
      currentShape = shape;
      document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      event.currentTarget.classList.add('active');
    }

    function addOpening() {
      const id = Date.now();
      openings.push({ id, type: 'door', wall: 'north', offset: 1, width: 0.9 });
      renderOpenings();
    }

    function removeOpening(id) {
      openings = openings.filter(o => o.id !== id);
      renderOpenings();
    }

    function renderOpenings() {
      const list = document.getElementById('openings-list');
      list.innerHTML = openings.map(o =>
        '<div class="opening-row">' +
          '<select onchange="openings.find(x=>x.id==' + o.id + ').type=this.value">' +
            '<option value="door"' + (o.type==='door'?' selected':'') + '>Porte</option>' +
            '<option value="window"' + (o.type==='window'?' selected':'') + '>Fenêtre</option>' +
          '</select>' +
          '<select onchange="openings.find(x=>x.id==' + o.id + ').wall=this.value">' +
            '<option value="north">Mur Nord</option>' +
            '<option value="east">Mur Est</option>' +
            '<option value="south">Mur Sud</option>' +
            '<option value="west">Mur Ouest</option>' +
          '</select>' +
          '<button class="btn-icon" onclick="removeOpening(' + o.id + ')">✕</button>' +
        '</div>'
      ).join('');
    }

    function buildFloorPlan() {
      const w = parseFloat(document.getElementById('width').value) || 4;
      const d = parseFloat(document.getElementById('depth').value) || 3;
      const margin = 0.5;

      const uuid = () => 'xxxxxxxx-xxxx-4xxx'.replace(/x/g, () => Math.floor(Math.random()*16).toString(16));

      // Create 4 walls
      const walls = [
        { id: uuid(), startPoint: {x: margin, y: margin}, endPoint: {x: w+margin, y: margin}, thickness: 0.15, type: 'exterior' },
        { id: uuid(), startPoint: {x: w+margin, y: margin}, endPoint: {x: w+margin, y: d+margin}, thickness: 0.15, type: 'exterior' },
        { id: uuid(), startPoint: {x: w+margin, y: d+margin}, endPoint: {x: margin, y: d+margin}, thickness: 0.15, type: 'exterior' },
        { id: uuid(), startPoint: {x: margin, y: d+margin}, endPoint: {x: margin, y: margin}, thickness: 0.15, type: 'exterior' },
      ];

      // Map openings to walls
      const wallMap = { north: 0, east: 1, south: 2, west: 3 };
      const planOpenings = openings.map(o => ({
        id: uuid(),
        wallId: walls[wallMap[o.wall] || 0].id,
        type: o.type,
        offsetOnWall: 1.0,
        widthMeters: o.type === 'window' ? 1.2 : 0.9,
        openingSide: 'left',
      }));

      return {
        id: uuid(),
        roomId: '${session.roomId}',
        projectId: '${session.projectId}',
        widthMeters: w + margin * 2,
        heightMeters: d + margin * 2,
        pixelsPerMeter: 100,
        walls: walls,
        openings: planOpenings,
        equipment: [],
        annotations: [],
        version: 1,
        createdAt: new Date().toISOString(),
      };
    }

    function drawPreview() {
      const plan = buildFloorPlan();
      const canvas = document.getElementById('preview-canvas');
      const ctx = canvas.getContext('2d');
      const scale = Math.min(
        (canvas.width - 40) / plan.widthMeters,
        (canvas.height - 40) / plan.heightMeters
      );
      const ox = 20, oy = 20;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= plan.widthMeters; x += 0.5) {
        ctx.beginPath();
        ctx.moveTo(ox + x * scale, oy);
        ctx.lineTo(ox + x * scale, oy + plan.heightMeters * scale);
        ctx.stroke();
      }
      for (let y = 0; y <= plan.heightMeters; y += 0.5) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + y * scale);
        ctx.lineTo(ox + plan.widthMeters * scale, oy + y * scale);
        ctx.stroke();
      }

      // Walls
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.lineCap = 'square';
      plan.walls.forEach(wall => {
        ctx.beginPath();
        ctx.moveTo(ox + wall.startPoint.x * scale, oy + wall.startPoint.y * scale);
        ctx.lineTo(ox + wall.endPoint.x * scale, oy + wall.endPoint.y * scale);
        ctx.stroke();
      });

      // Dimensions
      const w = parseFloat(document.getElementById('width').value);
      const d = parseFloat(document.getElementById('depth').value);
      document.getElementById('preview-dims').textContent = w.toFixed(1) + ' × ' + d.toFixed(1) + ' m';
      document.getElementById('preview-surface').textContent = (w * d).toFixed(1) + ' m²';
    }

    function goToStep2() {
      document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
      document.getElementById('step2').classList.add('active');
      drawPreview();
    }

    async function sendToIPad() {
      const btn = document.getElementById('send-btn');
      btn.disabled = true;
      btn.textContent = 'Envoi en cours...';

      try {
        const plan = buildFloorPlan();
        const res = await fetch(API_BASE + '/api/scan-sessions/' + SESSION_ID + '/result', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });

        if (res.ok) {
          document.getElementById('step2').classList.remove('active');
          document.getElementById('step3').classList.add('active');
          // Vibrate if supported
          if (navigator.vibrate) navigator.vibrate(200);
        } else {
          btn.textContent = 'Erreur — Réessayer';
          btn.disabled = false;
        }
      } catch (e) {
        btn.textContent = 'Erreur réseau — Réessayer';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`);
});

// ─── Styles ─────────────────────────────────────────────────────────

function baseStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Inter', sans-serif; background: #f5f7fa; color: #1a1a2e; -webkit-text-size-adjust: 100%; }
    .container { max-width: 420px; margin: 0 auto; padding: 20px; }
    .icon { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 16px; }
    .icon.error { background: #fce4ec; color: #c62828; }
    .icon.success { background: #e8f5e9; color: #2e7d32; }
    h1 { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 8px; }
    p { font-size: 15px; color: #666; text-align: center; line-height: 1.5; }
  `;
}

function scanPageStyles() {
  return `
    .header { background: #1565C0; color: white; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
    .logo { font-weight: 800; font-size: 18px; }
    .room-name { font-size: 14px; opacity: 0.85; }
    .step { display: none; } .step.active { display: block; }
    .form-section { background: white; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .form-section h2 { font-size: 14px; font-weight: 600; color: #666; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .input-row { display: flex; gap: 12px; }
    .input-group { flex: 1; }
    .input-group label { display: block; font-size: 13px; color: #888; margin-bottom: 4px; }
    .input-with-unit { display: flex; align-items: center; background: #f5f7fa; border-radius: 8px; border: 1.5px solid #e0e0e0; overflow: hidden; }
    .input-with-unit input { flex: 1; border: none; background: none; padding: 12px; font-size: 18px; font-weight: 600; outline: none; width: 100%; }
    .input-with-unit .unit { padding: 0 12px; color: #888; font-weight: 500; }
    .shape-selector { display: flex; gap: 8px; }
    .shape-btn { flex: 1; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; background: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: #666; }
    .shape-btn.active { border-color: #1565C0; color: #1565C0; background: #e3f2fd; }
    .btn-primary { width: 100%; padding: 16px; background: #1565C0; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 16px; }
    .btn-primary:disabled { opacity: 0.5; }
    .btn-secondary { width: 100%; padding: 12px; background: white; color: #1565C0; border: 1.5px solid #1565C0; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-icon { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e0e0e0; background: white; cursor: pointer; font-size: 16px; color: #c62828; }
    .opening-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .opening-row select { flex: 1; padding: 10px; border-radius: 8px; border: 1.5px solid #e0e0e0; font-size: 14px; background: white; }
    .preview-info { display: flex; justify-content: center; gap: 20px; margin: 8px 0; font-size: 14px; font-weight: 600; color: #1565C0; }
    .actions { display: flex; gap: 12px; margin-top: 16px; }
    .actions .btn-secondary { flex: 1; }
    .actions .btn-primary { flex: 2; margin-top: 0; }
    canvas { width: 100%; border-radius: 12px; background: white; display: block; }
    .lidar-card { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 16px; padding: 24px; text-align: center; border: 2px solid #90caf9; }
    .lidar-icon { width: 72px; height: 72px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; margin: 0 auto; box-shadow: 0 2px 12px rgba(21,101,192,0.15); }
  `;
}

export { app as scanSessionsRoutes };
