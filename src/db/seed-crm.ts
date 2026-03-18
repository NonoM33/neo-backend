/**
 * Seed CRM data: commercial users, leads, activities, availability, appointment type configs
 * Usage: bun run src/db/seed-crm.ts
 */

import { hash } from 'argon2';
import { db } from '../config/database';
import { users } from './schema/users';
import { leads, activities, leadStageHistory } from './schema/crm';
import { availabilitySlots, appointmentTypeConfigs } from './schema/appointments';
import { eq } from 'drizzle-orm';

async function seedCRM() {
  console.log('🌱 Seed CRM data...\n');

  const hashedPassword = await hash('password123');

  // ========================================
  // COMMERCIAL USERS
  // ========================================
  console.log('👤 Création des commerciaux...');

  // Check if commercials already exist
  const existingUsers = await db.select({ email: users.email }).from(users);
  const existingEmails = new Set(existingUsers.map(u => u.email));

  const commercialData = [
    { email: 'sophie.bernard@neo-domotique.fr', firstName: 'Sophie', lastName: 'Bernard', phone: '0656789012' },
    { email: 'thomas.leroy@neo-domotique.fr', firstName: 'Thomas', lastName: 'Leroy', phone: '0667890123' },
  ];

  const newCommercials = commercialData.filter(c => !existingEmails.has(c.email));
  let commercialUsers: { id: string; email: string; firstName: string; lastName: string }[] = [];

  if (newCommercials.length > 0) {
    // Legacy role enum only has admin/integrateur/auditeur - use 'admin' as base, commercial role via userRoles table
    const inserted = await db.insert(users).values(
      newCommercials.map(c => ({
        email: c.email,
        password: hashedPassword,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        role: 'admin' as const,
        isActive: true,
      }))
    ).returning({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName });
    commercialUsers = inserted;
    console.log(`   ✓ ${inserted.length} commerciaux créés (role: admin, fonctionnent comme commerciaux)`);
  } else {
    // Get existing commercial user IDs
    const existing = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.email, 'sophie.bernard@neo-domotique.fr'));
    commercialUsers = existing;
    console.log(`   ✓ ${existing.length} commerciaux existants`);
  }

  // Get admin user as fallback owner
  const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@neo-domotique.fr')).limit(1);
  const ownerId = commercialUsers[0]?.id || adminUser?.id;

  if (!ownerId) {
    console.error('❌ Aucun utilisateur trouvé pour assigner les leads');
    process.exit(1);
  }

  const ownerId2 = commercialUsers[1]?.id || ownerId;

  // ========================================
  // LEADS
  // ========================================
  console.log('📋 Création des leads...');

  const existingLeads = await db.select({ id: leads.id }).from(leads).limit(1);
  if (existingLeads.length > 0) {
    console.log('   ⏭️ Leads déjà présents, skip');
  } else {
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);
    const daysAhead = (days: number) => new Date(now.getTime() + days * 86400000);

    const leadsData = [
      // Hot leads
      { firstName: 'Laurent', lastName: 'Moreau', email: 'laurent.moreau@gmail.com', phone: '0612345678', title: 'Domotique maison neuve Vincennes', description: 'Construction neuve 180m², souhaite installation complète domotique. Budget confortable.', status: 'negociation' as const, source: 'site_web' as const, estimatedValue: '25000', probability: 75, ownerId, city: 'Vincennes', postalCode: '94300', surface: '180', expectedCloseDate: daysAhead(14), createdAt: daysAgo(20), updatedAt: daysAgo(1) },
      { firstName: 'Isabelle', lastName: 'Petit', email: 'isabelle.petit@outlook.fr', phone: '0623456789', title: 'Rénovation sécurité appartement Paris 16', description: 'Veut alarme Ajax + caméras Ring. Appartement 90m² haussmannien.', status: 'proposition' as const, source: 'recommandation' as const, estimatedValue: '8500', probability: 60, ownerId, city: 'Paris', postalCode: '75016', surface: '90', expectedCloseDate: daysAhead(7), createdAt: daysAgo(15), updatedAt: daysAgo(2) },
      { firstName: 'Marc', lastName: 'Dubois', email: 'marc.dubois@free.fr', phone: '0634567890', title: 'Chauffage connecté maison Boulogne', description: 'Maison 150m², veut Tado pour économies énergie. Facture gaz trop élevée.', status: 'qualifie' as const, source: 'salon' as const, estimatedValue: '12000', probability: 40, ownerId: ownerId2, city: 'Boulogne-Billancourt', postalCode: '92100', surface: '150', expectedCloseDate: daysAhead(21), createdAt: daysAgo(10), updatedAt: daysAgo(3) },
      // Warm leads
      { firstName: 'Claire', lastName: 'Lefebvre', email: 'claire.lefebvre@yahoo.fr', phone: '0645678901', title: 'Éclairage connecté maison Neuilly', description: 'Maison 200m², veut Philips Hue dans toutes les pièces + volets Somfy.', status: 'qualifie' as const, source: 'site_web' as const, estimatedValue: '15000', probability: 35, ownerId, city: 'Neuilly-sur-Seine', postalCode: '92200', surface: '200', expectedCloseDate: daysAhead(30), createdAt: daysAgo(8), updatedAt: daysAgo(4) },
      { firstName: 'Philippe', lastName: 'Garcia', email: 'p.garcia@gmail.com', phone: '0656789012', title: 'Installation multimédia Sonos', description: 'Villa 250m², veut Sonos multi-room + réseau Ubiquiti. Client exigeant.', status: 'proposition' as const, source: 'partenaire' as const, estimatedValue: '18000', probability: 50, ownerId: ownerId2, city: 'Saint-Cloud', postalCode: '92210', surface: '250', expectedCloseDate: daysAhead(10), createdAt: daysAgo(25), updatedAt: daysAgo(5) },
      { firstName: 'Nathalie', lastName: 'Roux', email: 'nathalie.roux@hotmail.fr', phone: '0667890123', title: 'Audit domotique appartement', description: 'Appartement 65m², curieuse de la domotique. Budget serré.', status: 'prospect' as const, source: 'publicite' as const, estimatedValue: '3000', probability: 15, ownerId, city: 'Paris', postalCode: '75011', surface: '65', createdAt: daysAgo(3), updatedAt: daysAgo(1) },
      // Cold leads
      { firstName: 'Frédéric', lastName: 'Simon', email: 'fred.simon@wanadoo.fr', phone: '0678901234', title: 'Sécurité résidence secondaire', description: 'Maison campagne 120m², veut sécurité à distance. Pas urgent.', status: 'prospect' as const, source: 'appel_entrant' as const, estimatedValue: '6000', probability: 10, ownerId: ownerId2, city: 'Fontainebleau', postalCode: '77300', surface: '120', createdAt: daysAgo(30), updatedAt: daysAgo(20) },
      { firstName: 'Émilie', lastName: 'Laurent', email: 'emilie.l@gmail.com', phone: '0689012345', title: 'Volets connectés Somfy', description: 'Maison 100m², veut motoriser 8 volets. A déjà un devis concurrent.', status: 'prospect' as const, source: 'site_web' as const, estimatedValue: '5500', probability: 20, ownerId, city: 'Créteil', postalCode: '94000', surface: '100', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
      // Won/Lost
      { firstName: 'Alain', lastName: 'Dupuis', email: 'alain.dupuis@gmail.com', phone: '0690123456', title: 'Pack Premium domotique villa', description: 'Villa 300m², installation complète. Très satisfait.', status: 'gagne' as const, source: 'recommandation' as const, estimatedValue: '35000', probability: 100, ownerId, city: 'Versailles', postalCode: '78000', surface: '300', convertedAt: daysAgo(5), createdAt: daysAgo(45), updatedAt: daysAgo(5) },
      { firstName: 'Christine', lastName: 'Martin', email: 'c.martin@orange.fr', phone: '0601234567', title: 'Installation chauffage connecté', description: 'A choisi un concurrent moins cher.', status: 'perdu' as const, source: 'salon' as const, estimatedValue: '7000', probability: 0, ownerId: ownerId2, city: 'Nanterre', postalCode: '92000', surface: '80', lostReason: 'Prix concurrent inférieur de 30%', createdAt: daysAgo(40), updatedAt: daysAgo(10) },
      // More prospects for volume
      { firstName: 'David', lastName: 'Bonnet', email: 'david.b@proton.me', phone: '0611223344', title: 'Smart home appartement Paris 5', description: 'Jeune couple, premier achat. Veut tout connecter.', status: 'qualifie' as const, source: 'site_web' as const, estimatedValue: '9000', probability: 30, ownerId, city: 'Paris', postalCode: '75005', surface: '75', expectedCloseDate: daysAhead(21), createdAt: daysAgo(7), updatedAt: daysAgo(2) },
      { firstName: 'Sylvie', lastName: 'Blanc', email: 'sylvie.blanc@gmail.com', phone: '0622334455', title: 'Éclairage + sécurité maison Rueil', description: 'Maison de ville 130m². Travaux de rénovation en cours.', status: 'prospect' as const, source: 'partenaire' as const, estimatedValue: '11000', probability: 20, ownerId: ownerId2, city: 'Rueil-Malmaison', postalCode: '92500', surface: '130', createdAt: daysAgo(2), updatedAt: daysAgo(1) },
    ];

    const insertedLeads = await db.insert(leads).values(leadsData).returning();
    console.log(`   ✓ ${insertedLeads.length} leads créés`);

    // Stage history
    for (const lead of insertedLeads) {
      await db.insert(leadStageHistory).values({
        leadId: lead.id,
        fromStatus: null,
        toStatus: lead.status,
        changedBy: lead.ownerId,
        notes: 'Lead créé',
      });
    }

    // ========================================
    // ACTIVITIES
    // ========================================
    console.log('📞 Création des activités...');

    const activitiesData: any[] = [];
    for (const lead of insertedLeads) {
      // First call for everyone
      activitiesData.push({
        leadId: lead.id,
        type: 'appel',
        subject: `Appel de prise de contact - ${lead.firstName} ${lead.lastName}`,
        description: 'Premier appel pour qualifier le besoin.',
        status: lead.status === 'prospect' ? 'planifie' : 'termine',
        scheduledAt: new Date(lead.createdAt.getTime() + 86400000),
        completedAt: lead.status !== 'prospect' ? new Date(lead.createdAt.getTime() + 86400000) : null,
        duration: 15,
        ownerId: lead.ownerId,
        createdAt: lead.createdAt,
        updatedAt: lead.createdAt,
      });

      // Follow-up for qualified+
      if (['qualifie', 'proposition', 'negociation', 'gagne'].includes(lead.status)) {
        activitiesData.push({
          leadId: lead.id,
          type: 'email',
          subject: `Email récap besoins - ${lead.firstName} ${lead.lastName}`,
          status: 'termine',
          scheduledAt: new Date(lead.createdAt.getTime() + 2 * 86400000),
          completedAt: new Date(lead.createdAt.getTime() + 2 * 86400000),
          duration: 10,
          ownerId: lead.ownerId,
          createdAt: new Date(lead.createdAt.getTime() + 2 * 86400000),
          updatedAt: new Date(lead.createdAt.getTime() + 2 * 86400000),
        });
      }

      // Visit for proposition+
      if (['proposition', 'negociation', 'gagne'].includes(lead.status)) {
        activitiesData.push({
          leadId: lead.id,
          type: 'visite',
          subject: `Visite technique - ${lead.firstName} ${lead.lastName}`,
          description: `Visite à ${lead.city} pour audit technique.`,
          status: 'termine',
          scheduledAt: new Date(lead.createdAt.getTime() + 5 * 86400000),
          completedAt: new Date(lead.createdAt.getTime() + 5 * 86400000),
          duration: 90,
          ownerId: lead.ownerId,
          createdAt: new Date(lead.createdAt.getTime() + 5 * 86400000),
          updatedAt: new Date(lead.createdAt.getTime() + 5 * 86400000),
        });
      }

      // Reunion for negociation+
      if (['negociation', 'gagne'].includes(lead.status)) {
        activitiesData.push({
          leadId: lead.id,
          type: 'reunion',
          subject: `Présentation devis - ${lead.firstName} ${lead.lastName}`,
          status: 'termine',
          scheduledAt: new Date(lead.createdAt.getTime() + 8 * 86400000),
          completedAt: new Date(lead.createdAt.getTime() + 8 * 86400000),
          duration: 60,
          ownerId: lead.ownerId,
          createdAt: new Date(lead.createdAt.getTime() + 8 * 86400000),
          updatedAt: new Date(lead.createdAt.getTime() + 8 * 86400000),
        });
      }

      // Upcoming activities for active leads
      if (['prospect', 'qualifie', 'proposition', 'negociation'].includes(lead.status)) {
        activitiesData.push({
          leadId: lead.id,
          type: lead.status === 'prospect' ? 'appel' : lead.status === 'qualifie' ? 'visite' : 'appel',
          subject: `Relance ${lead.firstName} ${lead.lastName}`,
          status: 'planifie',
          scheduledAt: daysAhead(Math.floor(Math.random() * 5) + 1),
          ownerId: lead.ownerId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const insertedActivities = await db.insert(activities).values(activitiesData).returning();
    console.log(`   ✓ ${insertedActivities.length} activités créées`);
  }

  // ========================================
  // AVAILABILITY SLOTS
  // ========================================
  console.log('📅 Création des disponibilités...');

  const existingSlots = await db.select({ id: availabilitySlots.id }).from(availabilitySlots).limit(1);
  if (existingSlots.length > 0) {
    console.log('   ⏭️ Disponibilités déjà présentes, skip');
  } else {
    const allUserIds = [ownerId, ownerId2].filter((v, i, a) => a.indexOf(v) === i);
    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] as const;

    const slotsData: any[] = [];
    for (const userId of allUserIds) {
      for (const day of days) {
        slotsData.push({ userId, dayOfWeek: day, startTime: '09:00', endTime: '12:00', isActive: true });
        slotsData.push({ userId, dayOfWeek: day, startTime: '14:00', endTime: '18:00', isActive: true });
      }
    }

    await db.insert(availabilitySlots).values(slotsData);
    console.log(`   ✓ ${slotsData.length} créneaux de disponibilité`);
  }

  // ========================================
  // APPOINTMENT TYPE CONFIGS
  // ========================================
  console.log('📋 Création des configs types de RDV...');

  const existingConfigs = await db.select({ id: appointmentTypeConfigs.id }).from(appointmentTypeConfigs).limit(1);
  if (existingConfigs.length > 0) {
    console.log('   ⏭️ Configs déjà présentes, skip');
  } else {
    await db.insert(appointmentTypeConfigs).values([
      { type: 'visite_technique', label: 'Visite technique', defaultDuration: 90, color: '#0d6efd', icon: 'bi-tools', allowedRoles: ['integrateur', 'auditeur', 'commercial'], requiresClient: false, requiresLocation: true },
      { type: 'audit', label: 'Audit', defaultDuration: 120, color: '#6f42c1', icon: 'bi-clipboard-check', allowedRoles: ['auditeur', 'commercial'], requiresClient: false, requiresLocation: true },
      { type: 'rdv_commercial', label: 'RDV Commercial', defaultDuration: 60, color: '#198754', icon: 'bi-briefcase', allowedRoles: ['commercial'], requiresClient: false, requiresLocation: true },
      { type: 'installation', label: 'Installation', defaultDuration: 240, color: '#fd7e14', icon: 'bi-wrench', allowedRoles: ['integrateur'], requiresClient: true, requiresLocation: true },
      { type: 'sav', label: 'SAV', defaultDuration: 60, color: '#dc3545', icon: 'bi-exclamation-triangle', allowedRoles: ['integrateur'], requiresClient: true, requiresLocation: true },
      { type: 'reunion_interne', label: 'Réunion interne', defaultDuration: 45, color: '#6c757d', icon: 'bi-people', allowedRoles: ['admin', 'integrateur', 'auditeur', 'commercial'], requiresClient: false, requiresLocation: false },
      { type: 'autre', label: 'Autre', defaultDuration: 30, color: '#adb5bd', icon: 'bi-calendar', allowedRoles: ['admin', 'integrateur', 'auditeur', 'commercial'], requiresClient: false, requiresLocation: false },
    ]);
    console.log('   ✓ 7 types de RDV configurés');
  }

  console.log('\n✅ Seed CRM terminé !');
  console.log('   Connexion CRM: sophie.bernard@neo-domotique.fr / password123 (commercial)');
  console.log('   Ou: admin@neo-domotique.fr / password123 (admin)');
  process.exit(0);
}

seedCRM().catch((e) => {
  console.error('❌ Erreur seed CRM:', e);
  process.exit(1);
});
