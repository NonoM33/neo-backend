# Neo Domotique Backend

Backend API pour l'application Neo Domotique - solution de domotique white-label.

## Stack technique

- **Runtime**: Bun
- **Framework**: Hono
- **ORM**: Drizzle
- **Database**: PostgreSQL
- **Storage**: MinIO (S3-compatible)
- **Auth**: JWT + refresh tokens (staff) / JWT separe (clients)
- **Validation**: Zod
- **Back-office**: JSX servies par Hono (HTMX pour interactivite)
- **IA**: Anthropic Claude API (chat support)

## Commandes

```bash
# Developpement
bun run dev          # Demarre le serveur en mode watch

# Base de donnees
bun run db:generate  # Genere les migrations
bun run db:push      # Applique les migrations
bun run db:studio    # Interface Drizzle Studio

# Production
bun run start        # Demarre le serveur
bun run typecheck    # Verifie les types
```

## Structure

```
src/
├── index.ts           # Point d'entree
├── app.ts             # Config Hono + routes
├── config/            # Configuration (env, database, s3)
├── db/schema/         # Schemas Drizzle (users, projects, rooms, devices, products, quotes, crm, support)
├── middleware/        # Middlewares (auth, rbac, error, client-auth)
├── modules/           # Modules metier (auth, users, projects, rooms, devices, products, quotes, leads, activities, kpis, sync, photos)
├── support/           # Projet dedie support & ticketing IA
│   ├── auth/          # Auth client (login, refresh, comptes)
│   ├── tickets/       # CRUD tickets, workflow statuts, SLA, assignment
│   ├── kb/            # Base de connaissances, articles, FAQ
│   ├── chat/          # Chat IA (Claude API, SSE streaming, sessions)
│   ├── mcp/           # Outils IA securises (MCP tools)
│   │   └── tools/     # 6 outils (devices, rooms, projects, KB, tickets, diagnostics)
│   ├── middleware/     # Auth JWT client
│   └── backoffice/    # Pages JSX support (dashboard, tickets, KB, FAQ, settings)
├── backoffice/        # Back-office JSX + HTMX
│   ├── components/    # Composants reutilisables (Layout, Table, Pagination, Alert, Modal, Sidebar)
│   ├── pages/         # Pages par section (users, clients, products, projects, crm, activities, objectives, support)
│   └── middleware/     # Auth session backoffice
├── admin/             # Admin panel legacy
└── lib/               # Utilitaires (errors, pagination)
```

## Design System Backoffice

Tous les outils et pages du backoffice DOIVENT respecter cette charte graphique.

### Couleurs

```css
:root {
  --sidebar-width: 260px;
  --sidebar-bg: #1a1d21;        /* Sidebar fond sombre */
  --sidebar-hover: #2d3339;     /* Sidebar hover */
  --primary-color: #0d6efd;     /* Bleu Bootstrap primary */
}
body { background-color: #f5f7fa; }  /* Fond page gris clair */
```

### Palette de badges par statut

| Contexte | Valeur | Couleur Bootstrap |
|----------|--------|-------------------|
| Projet | brouillon | `secondary` |
| Projet | en_cours | `primary` |
| Projet | termine | `success` |
| Projet | archive | `dark` |
| Devis | envoye | `info` |
| Devis | accepte | `success` |
| Devis | refuse | `danger` |
| Devis | expire | `warning` |
| Lead | prospect | `secondary` |
| Lead | qualifie | `info` |
| Lead | proposition | `primary` |
| Lead | negociation | `warning` |
| Lead | gagne | `success` |
| Lead | perdu | `danger` |
| Ticket | nouveau | `info` |
| Ticket | ouvert | `primary` |
| Ticket | en_attente_client | `warning` |
| Ticket | escalade | `danger` |
| Ticket | resolu | `success` |
| Ticket | ferme | `dark` |
| Appareil | planifie | `secondary` |
| Appareil | installe | `info` |
| Appareil | configure | `warning` |
| Appareil | operationnel | `success` |
| Appareil | en_panne | `danger` |
| Marge | >= 30% | `success` |
| Marge | >= 15% | `warning` |
| Marge | < 15% | `danger` |

### Composants UI (conventions)

- **Cards** : `border: none`, `box-shadow: 0 0 10px rgba(0,0,0,0.05)`, `border-radius: 10px`
- **Card headers** : fond blanc `#fff`, `border-bottom: 1px solid #e9ecef`, `font-weight: 600`
- **Stat cards** : fond colore, texte blanc, `border-radius: 10px`, icone grande (2.5rem, opacity 0.8), valeur grande (2rem, fw-700)
- **Tables** : `table-hover`, headers `fw-600 color:#495057`, sans bordure superieure epaisse
- **Boutons actions** : `btn-sm btn-outline-*`, padding reduit (0.25rem 0.5rem)
- **Sidebar** : fond `#1a1d21`, liens `color:#adb5bd`, hover blanc + fond `#2d3339`, actif = border-left bleu primary
- **Sections nav** : titre uppercase, `font-size:0.75rem`, `letter-spacing:0.5px`, `color:#6c757d`
- **Headers de page sombres** (detail projet) : `background: linear-gradient(135deg, #1a1d21 0%, #2d3339 100%)`, texte blanc, border-radius 12px
- **Stat mini** (resume) : fond `#f8f9fa`, border-radius 10px, valeur 1.5rem fw-700, label 0.75rem text-muted
- **Photos** : border-radius 8px, border 2px solid #e9ecef, hover border-color bleu, cursor pointer
- **Lightbox photo** : overlay noir 85% opacity, image max 90vw/90vh
- **Devis accordeon** : card avec header cliquable (chevron), corps deroulant avec lignes detail
- **Pipeline kanban** : colonnes flex, min-width 220px, cards avec border-left coloree (3px), hover translateY(-2px)
- **Indicateurs en ligne** : point 8px rond, vert (#198754 + box-shadow glow) ou rouge (#dc3545)
- **Barres de progression** : height 6px, border-radius 3px, fond #e9ecef, barre coloree (vert/orange/rouge selon %)
- **Formulaire recherche live** : border 2px dashed #dee2e6, border-radius 12px, fond #f8f9fa, focus = solid bleu + shadow
- **Dependances produit** : graph horizontal flex avec noeuds (border-radius 12px, border 2px), fleches entre colonnes, legende en bas

### Librairies externes

- **CSS** : Bootstrap 5.3.2 (CDN)
- **Icones** : Bootstrap Icons 1.11.1 (CDN)
- **Interactivite** : HTMX 1.9.10 (CDN)
- **JS Bootstrap** : bootstrap.bundle.min.js (CDN) — pour dropdowns, modals, collapse

### Patterns de code backoffice

- Chaque page recoit `user: AdminUser` pour le header
- `currentPath` pour la sidebar active
- `FlashMessages` component pour success/error (via query params)
- Tables via composant `<Table>` avec `columns`, `data`, `actions`
- Pagination via `<Pagination>` + `<PaginationInfo>`
- Suppression HTMX inline : `hx-delete`, `hx-target="closest tr"`, `hx-swap="outerHTML"`, `hx-confirm`
- Formulaires POST classiques avec redirect + query param `?success=...`
- Donnees chargees en parallele avec `Promise.all()`
- Formats monnaie : `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`
- Dates : `toLocaleDateString('fr-FR')`

## Demarrage

1. Lancer PostgreSQL et MinIO:
   ```bash
   docker compose up -d
   ```

2. Configurer .env (copier depuis .env.example)

3. Appliquer les migrations:
   ```bash
   bun run db:push
   ```

4. Demarrer le serveur:
   ```bash
   bun run dev
   ```

## Endpoints principaux

### API Staff (JWT staff)
- `GET /health` - Health check
- `POST /api/auth/login` - Connexion staff
- `GET /api/auth/me` - Utilisateur courant
- `/api/users` - CRUD utilisateurs (admin)
- `/api/projets` - CRUD projets + clients
- `/api/produits` - Catalogue produits
- `/api/tickets` - CRUD tickets support
- `/api/kb` - Base de connaissances (articles, FAQ, categories)
- `/api/leads` - Pipeline CRM
- `/api/sync` - Synchronisation offline

### API Client (JWT client)
- `POST /api/client/auth/login` - Connexion client
- `GET /api/client/tickets` - Mes tickets
- `GET /api/client/kb/search` - Recherche KB
- `POST /api/client/chat/sessions` - Chat IA
- `POST /api/client/chat/sessions/:id/messages` - Envoyer message (reponse SSE)

### Back-office
- `/backoffice` - Dashboard
- `/backoffice/crm/pipeline` - Pipeline unifiee (leads + projets)
- `/backoffice/support` - Dashboard support
- `/backoffice/support/tickets` - Gestion tickets
- `/backoffice/support/kb` - Articles KB
- `/backoffice/support/settings` - SLA, categories, reponses types

## Notes Bun

- Bun charge automatiquement .env
- Utiliser `bun run` au lieu de `npm run`
- Utiliser `bunx` au lieu de `npx`
