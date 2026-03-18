import { html } from 'hono/html';
import type { FC } from 'hono/jsx';

interface LayoutProps {
  title: string;
  children: any;
}

export const Layout: FC<LayoutProps> = ({ title, children }) => {
  return (
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - Neo Admin</title>
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <style>{`
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 250px;
            background: #212529;
            padding-top: 20px;
          }
          .sidebar a {
            color: #adb5bd;
            padding: 12px 20px;
            display: block;
            text-decoration: none;
          }
          .sidebar a:hover, .sidebar a.active {
            color: #fff;
            background: #343a40;
          }
          .main-content {
            margin-left: 250px;
            padding: 20px;
          }
          .brand {
            color: #fff;
            font-size: 1.5rem;
            padding: 0 20px 20px;
            border-bottom: 1px solid #343a40;
            margin-bottom: 20px;
          }
        `}</style>
      </head>
      <body>
        <div class="sidebar">
          <div class="brand">Neo Admin</div>
          <nav>
            <a href="/admin">Dashboard</a>
            <a href="/admin/users">Utilisateurs</a>
            <a href="/admin/products">Produits</a>
            <a href="/admin/projects">Projets</a>
          </nav>
        </div>
        <div class="main-content">
          <h1 class="mb-4">{title}</h1>
          {children}
        </div>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
      </body>
    </html>
  );
};
