import type { FC } from 'hono/jsx';

interface LoginPageProps {
  error?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error }) => {
  return (
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Connexion - Neo Backoffice</title>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css"
        />
        <style>{`
          body {
            background: linear-gradient(135deg, #1a1d21 0%, #2d3339 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .login-card {
            background: #fff;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            padding: 40px;
            width: 100%;
            max-width: 420px;
          }
          .login-header {
            text-align: center;
            margin-bottom: 30px;
          }
          .login-logo {
            font-size: 3rem;
            color: #0d6efd;
            margin-bottom: 10px;
          }
          .login-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #212529;
            margin-bottom: 5px;
          }
          .login-subtitle {
            color: #6c757d;
            font-size: 0.9rem;
          }
          .form-control:focus {
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
          }
          .btn-login {
            padding: 12px;
            font-weight: 600;
          }
          .input-group-text {
            background: #f8f9fa;
            border-right: none;
          }
          .form-control {
            border-left: none;
          }
          .form-control:focus {
            border-left: none;
          }
          .input-group:focus-within .input-group-text {
            border-color: #0d6efd;
          }
        `}</style>
      </head>
      <body>
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">
              <i class="bi bi-house-gear"></i>
            </div>
            <h1 class="login-title">Neo Backoffice</h1>
            <p class="login-subtitle">Connectez-vous pour acceder au panneau d'administration</p>
          </div>

          {error === 'invalid_credentials' && (
            <div class="alert alert-danger" role="alert">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Email ou mot de passe incorrect
            </div>
          )}

          {error === 'access_denied' && (
            <div class="alert alert-warning" role="alert">
              <i class="bi bi-shield-exclamation me-2"></i>
              Acces reserve aux administrateurs
            </div>
          )}

          <form method="post" action="/backoffice/login">
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <div class="input-group">
                <span class="input-group-text">
                  <i class="bi bi-envelope"></i>
                </span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  class="form-control"
                  placeholder="admin@neo.fr"
                  required
                  autofocus
                />
              </div>
            </div>

            <div class="mb-4">
              <label class="form-label" for="password">Mot de passe</label>
              <div class="input-group">
                <span class="input-group-text">
                  <i class="bi bi-lock"></i>
                </span>
                <input
                  type="password"
                  id="password"
                  name="password"
                  class="form-control"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button type="submit" class="btn btn-primary w-100 btn-login">
              <i class="bi bi-box-arrow-in-right me-2"></i>
              Se connecter
            </button>
          </form>
        </div>
      </body>
    </html>
  );
};
