// Neo Domotique - Support & Ticketing IA
// Projet dédié regroupant tout le système de support client

export { clientAuthRoutes } from './auth';
export { ticketsRoutes } from './tickets';
export { kbRoutes } from './kb';
export { chatRoutes } from './chat';
export { toolRegistry, executeTool } from './mcp';
export type { ClientContext, MCPToolDefinition, MCPToolResult } from './mcp';

// Backoffice pages
export {
  SupportDashboardPage,
  TicketsListPage,
  TicketDetailPage,
  KBListPage,
  KBFormPage,
  FAQListPage,
  FAQFormPage,
  SupportSettingsPage,
} from './backoffice';
