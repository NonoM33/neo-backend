import type { FC } from 'hono/jsx';

interface SidebarProps {
  currentPath?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'General',
    items: [
      { path: '/backoffice', label: 'Dashboard', icon: 'bi-grid-1x2' },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { path: '/backoffice/orders', label: 'Commandes', icon: 'bi-bag-check' },
      { path: '/backoffice/invoices', label: 'Factures', icon: 'bi-receipt' },
      { path: '/backoffice/stock', label: 'Stock', icon: 'bi-boxes' },
      { path: '/backoffice/supplier-orders', label: 'Achats', icon: 'bi-truck' },
    ],
  },
  {
    title: 'CRM Commercial',
    items: [
      { path: '/backoffice/crm/pipeline', label: 'Pipeline', icon: 'bi-funnel' },
      { path: '/backoffice/activities', label: 'Activites', icon: 'bi-calendar-event' },
      { path: '/backoffice/crm/kpis', label: 'KPIs', icon: 'bi-graph-up' },
      { path: '/backoffice/objectives', label: 'Objectifs', icon: 'bi-bullseye' },
    ],
  },
  {
    title: 'Support',
    items: [
      { path: '/backoffice/support', label: 'Dashboard Support', icon: 'bi-headset' },
      { path: '/backoffice/support/tickets', label: 'Tickets', icon: 'bi-ticket-detailed' },
      { path: '/backoffice/support/kb', label: 'Base de connaissances', icon: 'bi-book' },
      { path: '/backoffice/support/faq', label: 'FAQ', icon: 'bi-question-circle' },
      { path: '/backoffice/support/settings', label: 'Parametres Support', icon: 'bi-gear' },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { path: '/backoffice/users', label: 'Utilisateurs', icon: 'bi-people' },
      { path: '/backoffice/clients', label: 'Clients', icon: 'bi-person-badge' },
      { path: '/backoffice/products', label: 'Produits', icon: 'bi-box-seam' },
      { path: '/backoffice/suppliers', label: 'Fournisseurs', icon: 'bi-building' },
      { path: '/backoffice/projects', label: 'Projets', icon: 'bi-folder' },
    ],
  },
];

export const Sidebar: FC<SidebarProps> = ({ currentPath }) => {
  const isActive = (path: string) => {
    if (path === '/backoffice') {
      return currentPath === '/backoffice' || currentPath === '/backoffice/';
    }
    return currentPath?.startsWith(path);
  };

  return (
    <div class="sidebar">
      <div class="sidebar-header">
        <a href="/backoffice" class="sidebar-brand">
          <i class="bi bi-house-gear"></i>
          Neo Backoffice
        </a>
      </div>
      <nav class="sidebar-nav">
        {navSections.map((section) => (
          <div class="mb-3">
            <div class="nav-section">{section.title}</div>
            {section.items.map((item) => (
              <a
                href={item.path}
                class={`nav-link ${isActive(item.path) ? 'active' : ''}`}
              >
                <i class={`bi ${item.icon}`}></i>
                {item.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
};
