/**
 * Script de seed pour Neo Domotique
 * Usage: bun run src/db/seed.ts
 */

import { hash } from 'argon2';
import { db } from '../config/database';
import {
  users,
  clients,
  projects,
  rooms,
  checklistItems,
  suppliers,
  products,
  productDependencies,
  projectProducts,
  devices,
  quotes,
  quoteLines,
} from './schema';

const DEFAULT_PASSWORD = 'password123';

async function seed() {
  console.log('🌱 Démarrage du seed...\n');

  // ========================================
  // UTILISATEURS
  // ========================================
  console.log('👤 Création des utilisateurs...');
  const hashedPassword = await hash(DEFAULT_PASSWORD);

  const insertedUsers = await db.insert(users).values([
    { email: 'admin@neo-domotique.fr', password: hashedPassword, firstName: 'Admin', lastName: 'Neo', phone: '0612345678', role: 'admin' as const },
    { email: 'jean.dupont@neo-domotique.fr', password: hashedPassword, firstName: 'Jean', lastName: 'Dupont', phone: '0623456789', role: 'integrateur' as const },
    { email: 'marie.martin@neo-domotique.fr', password: hashedPassword, firstName: 'Marie', lastName: 'Martin', phone: '0634567890', role: 'integrateur' as const },
    { email: 'pierre.durand@neo-domotique.fr', password: hashedPassword, firstName: 'Pierre', lastName: 'Durand', phone: '0645678901', role: 'auditeur' as const },
  ]).returning();
  console.log(`   ✓ ${insertedUsers.length} utilisateurs`);

  const jean = insertedUsers.find(u => u.email === 'jean.dupont@neo-domotique.fr')!;
  const marie = insertedUsers.find(u => u.email === 'marie.martin@neo-domotique.fr')!;

  // ========================================
  // CLIENTS
  // ========================================
  console.log('🏠 Création des clients...');
  const insertedClients = await db.insert(clients).values([
    { firstName: 'François', lastName: 'Leroy', email: 'f.leroy@gmail.com', phone: '0678901234', address: '15 rue de la Paix', city: 'Paris', postalCode: '75002', notes: 'Client VIP' },
    { firstName: 'Sophie', lastName: 'Bernard', email: 'sophie.bernard@outlook.fr', phone: '0689012345', address: '28 avenue des Champs', city: 'Lyon', postalCode: '69003', notes: 'Rénovation complète' },
    { firstName: 'Michel', lastName: 'Petit', email: 'michel.petit@free.fr', phone: '0690123456', address: '5 impasse du Château', city: 'Bordeaux', postalCode: '33000', notes: null },
    { firstName: 'Isabelle', lastName: 'Moreau', email: 'i.moreau@orange.fr', phone: '0601234567', address: '42 boulevard Victor Hugo', city: 'Marseille', postalCode: '13008', notes: 'Contact le matin' },
    { firstName: 'Alain', lastName: 'Roux', email: 'alain.roux@laposte.net', phone: '0712345678', address: '8 rue des Lilas', city: 'Toulouse', postalCode: '31000', notes: 'Construction neuve' },
    { firstName: 'Catherine', lastName: 'Simon', email: 'c.simon@sfr.fr', phone: '0723456789', address: '17 place de la République', city: 'Nantes', postalCode: '44000', notes: 'Appartement standing' },
  ]).returning();
  console.log(`   ✓ ${insertedClients.length} clients`);

  // ========================================
  // FOURNISSEURS
  // ========================================
  console.log('🚚 Création des fournisseurs...');
  const insertedSuppliers = await db.insert(suppliers).values([
    { name: 'Philips', email: 'pro@philips-hue.com', phone: '0800 200 014', website: 'https://www.philips-hue.com/fr-fr/products/all-products', notes: 'Gamme Hue - tarif pro via portail revendeur' },
    { name: 'Somfy', email: 'contact.pro@somfy.com', phone: '04 50 96 70 00', website: 'https://www.somfypro.fr', notes: 'Partenaire Expert Somfy - remise 35%' },
    { name: 'Google', email: 'nest-partners@google.com', phone: null, website: 'https://store.google.com/fr/category/connected_home', notes: 'Distribution via grossiste ADI' },
    { name: 'Tado', email: 'partners@tado.com', phone: null, website: 'https://www.tado.com/fr-fr/produits', notes: 'Programme partenaire installateur' },
    { name: 'Ajax Systems', email: 'sales@ajax.systems', phone: '+380 44 334 79 52', website: 'https://ajax.systems/fr/products/', notes: 'Distribution via Risco France' },
    { name: 'Ring', email: 'ring-pro@amazon.com', phone: null, website: 'https://fr-fr.ring.com/collections/all', notes: 'Tarif pro Amazon Business' },
    { name: 'Sonos', email: 'trade@sonos.com', phone: '0800 916 192', website: 'https://www.sonos.com/fr-fr/shop', notes: 'Programme Sonos Architectural - remise 30%' },
    { name: 'Ubiquiti', email: 'sales@ui.com', phone: null, website: 'https://eu.store.ui.com', notes: 'Achat direct EU Store ou distributeur IT' },
  ]).returning();
  console.log(`   ✓ ${insertedSuppliers.length} fournisseurs`);

  const getSupplier = (name: string) => insertedSuppliers.find(s => s.name === name)!;

  // ========================================
  // PRODUITS
  // ========================================
  console.log('📦 Création des produits...');
  const insertedProducts = await db.insert(products).values([
    // Éclairage (Philips) - ~30% marge
    { reference: 'PHI-HUE-E27', name: 'Philips Hue White & Color E27', category: 'Éclairage', brand: 'Philips', priceHT: '41.58', purchasePriceHT: '28.50', supplierId: getSupplier('Philips').id, stock: 50 },
    { reference: 'PHI-HUE-GU10', name: 'Philips Hue White GU10', category: 'Éclairage', brand: 'Philips', priceHT: '29.08', purchasePriceHT: '19.90', supplierId: getSupplier('Philips').id, stock: 80 },
    { reference: 'PHI-HUE-BRIDGE', name: 'Philips Hue Bridge', category: 'Éclairage', brand: 'Philips', priceHT: '49.92', purchasePriceHT: '32.50', supplierId: getSupplier('Philips').id, stock: 25 },
    { reference: 'PHI-HUE-DIM', name: 'Philips Hue Dimmer Switch', category: 'Éclairage', brand: 'Philips', priceHT: '24.92', purchasePriceHT: '16.20', supplierId: getSupplier('Philips').id, stock: 40 },
    { reference: 'PHI-HUE-STRIP', name: 'Philips Hue Lightstrip 2m', category: 'Éclairage', brand: 'Philips', priceHT: '69.92', purchasePriceHT: '47.50', supplierId: getSupplier('Philips').id, stock: 30 },
    // Volets (Somfy) - ~35% marge
    { reference: 'SOM-IO-RS100', name: 'Somfy RS100 IO', description: 'Moteur volet 10Nm', category: 'Volets', brand: 'Somfy', priceHT: '189.00', purchasePriceHT: '122.85', supplierId: getSupplier('Somfy').id, stock: 30 },
    { reference: 'SOM-TAHOMA', name: 'Somfy TaHoma Switch', category: 'Volets', brand: 'Somfy', priceHT: '199.00', purchasePriceHT: '129.35', supplierId: getSupplier('Somfy').id, stock: 15 },
    { reference: 'SOM-SITUO-5', name: 'Somfy Situo 5 IO', category: 'Volets', brand: 'Somfy', priceHT: '69.00', purchasePriceHT: '44.85', supplierId: getSupplier('Somfy').id, stock: 35 },
    // Chauffage - ~30% marge
    { reference: 'NEST-THERM-3', name: 'Google Nest Thermostat', category: 'Chauffage', brand: 'Google', priceHT: '219.00', purchasePriceHT: '153.30', supplierId: getSupplier('Google').id, stock: 20 },
    { reference: 'TADO-STARTER', name: 'Tado Kit V3+', category: 'Chauffage', brand: 'Tado', priceHT: '179.00', purchasePriceHT: '125.30', supplierId: getSupplier('Tado').id, stock: 15 },
    { reference: 'TADO-TRV', name: 'Tado Tête thermostatique', category: 'Chauffage', brand: 'Tado', priceHT: '69.00', purchasePriceHT: '48.30', supplierId: getSupplier('Tado').id, stock: 60 },
    // Sécurité (Ajax/Ring) - ~35% marge
    { reference: 'AJAX-HUB2', name: 'Ajax Hub 2 Plus', category: 'Sécurité', brand: 'Ajax', priceHT: '349.00', purchasePriceHT: '226.85', supplierId: getSupplier('Ajax Systems').id, stock: 10 },
    { reference: 'AJAX-MOTION', name: 'Ajax MotionProtect', category: 'Sécurité', brand: 'Ajax', priceHT: '79.00', purchasePriceHT: '51.35', supplierId: getSupplier('Ajax Systems').id, stock: 45 },
    { reference: 'AJAX-DOOR', name: 'Ajax DoorProtect', category: 'Sécurité', brand: 'Ajax', priceHT: '49.00', purchasePriceHT: '31.85', supplierId: getSupplier('Ajax Systems').id, stock: 50 },
    { reference: 'AJAX-KEYPAD', name: 'Ajax KeyPad', category: 'Sécurité', brand: 'Ajax', priceHT: '119.00', purchasePriceHT: '77.35', supplierId: getSupplier('Ajax Systems').id, stock: 20 },
    { reference: 'RING-DOORBELL', name: 'Ring Video Doorbell 4', category: 'Sécurité', brand: 'Ring', priceHT: '179.00', purchasePriceHT: '120.00', supplierId: getSupplier('Ring').id, stock: 18 },
    // Audio (Sonos) - ~30% marge
    { reference: 'SONOS-ONE', name: 'Sonos One SL', category: 'Audio', brand: 'Sonos', priceHT: '179.00', purchasePriceHT: '125.30', supplierId: getSupplier('Sonos').id, stock: 25 },
    { reference: 'SONOS-ARC', name: 'Sonos Arc', category: 'Audio', brand: 'Sonos', priceHT: '899.00', purchasePriceHT: '629.30', supplierId: getSupplier('Sonos').id, stock: 8 },
    { reference: 'SONOS-SUB', name: 'Sonos Sub Mini', category: 'Audio', brand: 'Sonos', priceHT: '429.00', purchasePriceHT: '300.30', supplierId: getSupplier('Sonos').id, stock: 10 },
    // Réseau (Ubiquiti) - ~35% marge
    { reference: 'UBNT-U6-PRO', name: 'Ubiquiti U6 Pro', category: 'Réseau', brand: 'Ubiquiti', priceHT: '159.00', purchasePriceHT: '103.35', supplierId: getSupplier('Ubiquiti').id, stock: 20 },
    { reference: 'UBNT-DREAM', name: 'Ubiquiti Dream Machine Pro', category: 'Réseau', brand: 'Ubiquiti', priceHT: '379.00', purchasePriceHT: '246.35', supplierId: getSupplier('Ubiquiti').id, stock: 6 },
    { reference: 'UBNT-SW-8', name: 'Ubiquiti Switch 8 PoE', category: 'Réseau', brand: 'Ubiquiti', priceHT: '109.00', purchasePriceHT: '70.85', supplierId: getSupplier('Ubiquiti').id, stock: 15 },
    // Services (pas de prix d'achat - marge = 100%)
    { reference: 'MO-INSTALL-H', name: "Main d'oeuvre installation", description: 'Heure technicien', category: 'Services', brand: 'Neo', priceHT: '55.00', stock: null },
    { reference: 'MO-CONFIG', name: 'Configuration système', category: 'Services', brand: 'Neo', priceHT: '150.00', stock: null },
    { reference: 'MO-AUDIT', name: 'Audit technique', category: 'Services', brand: 'Neo', priceHT: '250.00', stock: null },
  ]).returning();
  console.log(`   ✓ ${insertedProducts.length} produits`);

  const getProduct = (ref: string) => insertedProducts.find(p => p.reference === ref)!;

  // ========================================
  // DÉPENDANCES PRODUITS
  // ========================================
  console.log('🔗 Création des dépendances produits...');
  await db.insert(productDependencies).values([
    // Ampoules Philips Hue → Bridge obligatoire
    { productId: getProduct('PHI-HUE-E27').id, requiredProductId: getProduct('PHI-HUE-BRIDGE').id, type: 'required' as const, description: '1 bridge pour jusqu\'à 50 ampoules Hue' },
    { productId: getProduct('PHI-HUE-GU10').id, requiredProductId: getProduct('PHI-HUE-BRIDGE').id, type: 'required' as const, description: '1 bridge pour jusqu\'à 50 ampoules Hue' },
    { productId: getProduct('PHI-HUE-DIM').id, requiredProductId: getProduct('PHI-HUE-BRIDGE').id, type: 'required' as const, description: '1 bridge pour jusqu\'à 50 ampoules Hue' },
    { productId: getProduct('PHI-HUE-STRIP').id, requiredProductId: getProduct('PHI-HUE-BRIDGE').id, type: 'required' as const, description: '1 bridge pour jusqu\'à 50 ampoules Hue' },
    // Détecteurs Ajax → Hub obligatoire
    { productId: getProduct('AJAX-MOTION').id, requiredProductId: getProduct('AJAX-HUB2').id, type: 'required' as const, description: 'Centrale Ajax obligatoire pour tous les périphériques' },
    { productId: getProduct('AJAX-DOOR').id, requiredProductId: getProduct('AJAX-HUB2').id, type: 'required' as const, description: 'Centrale Ajax obligatoire pour tous les périphériques' },
    { productId: getProduct('AJAX-KEYPAD').id, requiredProductId: getProduct('AJAX-HUB2').id, type: 'required' as const, description: 'Centrale Ajax obligatoire pour tous les périphériques' },
    // Tado TRV → Kit Tado Starter
    { productId: getProduct('TADO-TRV').id, requiredProductId: getProduct('TADO-STARTER').id, type: 'required' as const, description: 'Kit Tado V3+ requis pour les têtes thermostatiques' },
    // Moteurs Somfy → TaHoma recommandé
    { productId: getProduct('SOM-IO-RS100').id, requiredProductId: getProduct('SOM-TAHOMA').id, type: 'recommended' as const, description: 'TaHoma recommandé pour la gestion centralisée des volets' },
    // Ubiquiti AP → Switch PoE recommandé
    { productId: getProduct('UBNT-U6-PRO').id, requiredProductId: getProduct('UBNT-SW-8').id, type: 'recommended' as const, description: 'Switch PoE recommandé pour alimenter les bornes WiFi' },
    // Sonos Sub → Sonos Arc recommandé
    { productId: getProduct('SONOS-SUB').id, requiredProductId: getProduct('SONOS-ARC').id, type: 'recommended' as const, description: 'Sub conçu pour fonctionner avec la barre de son Arc' },
  ]);
  console.log('   ✓ 11 dépendances produits');

  // ========================================
  // PROJETS + PIÈCES + DEVICES + DEVIS
  // ========================================
  console.log('📋 Création des projets complets...');

  // PROJET 1: Villa Leroy
  const [projet1] = await db.insert(projects).values({
    clientId: insertedClients[0]!.id, userId: jean.id, name: 'Villa Leroy - Domotique complète',
    description: 'Installation complète', status: 'en_cours', address: '15 rue de la Paix',
    city: 'Paris', postalCode: '75002', surface: '185.50', roomCount: 8,
  }).returning();

  const roomsP1 = await db.insert(rooms).values([
    { projectId: projet1.id, name: 'Salon', type: 'salon' as const, floor: 0 },
    { projectId: projet1.id, name: 'Cuisine', type: 'cuisine' as const, floor: 0 },
    { projectId: projet1.id, name: 'Chambre parentale', type: 'chambre' as const, floor: 1 },
    { projectId: projet1.id, name: 'Chambre enfant 1', type: 'chambre' as const, floor: 1 },
    { projectId: projet1.id, name: 'Chambre enfant 2', type: 'chambre' as const, floor: 1 },
    { projectId: projet1.id, name: 'SDB principale', type: 'salle_de_bain' as const, floor: 1 },
    { projectId: projet1.id, name: 'Bureau', type: 'bureau' as const, floor: 0 },
    { projectId: projet1.id, name: 'Garage', type: 'garage' as const, floor: 0 },
  ]).returning();

  await db.insert(projectProducts).values([
    { projectId: projet1.id, productId: getProduct('PHI-HUE-E27').id, quantity: 12 },
    { projectId: projet1.id, productId: getProduct('PHI-HUE-GU10').id, quantity: 8 },
    { projectId: projet1.id, productId: getProduct('PHI-HUE-BRIDGE').id, quantity: 1 },
    { projectId: projet1.id, productId: getProduct('SOM-IO-RS100').id, quantity: 5 },
    { projectId: projet1.id, productId: getProduct('SOM-TAHOMA').id, quantity: 1 },
    { projectId: projet1.id, productId: getProduct('NEST-THERM-3').id, quantity: 1 },
    { projectId: projet1.id, productId: getProduct('AJAX-HUB2').id, quantity: 1 },
    { projectId: projet1.id, productId: getProduct('AJAX-MOTION').id, quantity: 6 },
    { projectId: projet1.id, productId: getProduct('AJAX-DOOR').id, quantity: 8 },
    { projectId: projet1.id, productId: getProduct('UBNT-U6-PRO').id, quantity: 2 },
  ]);

  await db.insert(devices).values([
    { roomId: roomsP1[0]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Plafonnier salon 1', status: 'operationnel' as const, macAddress: 'AA:BB:CC:11:22:01', isOnline: true },
    { roomId: roomsP1[0]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Plafonnier salon 2', status: 'operationnel' as const, macAddress: 'AA:BB:CC:11:22:02', isOnline: true },
    { roomId: roomsP1[0]!.id, productId: getProduct('SOM-IO-RS100').id, name: 'Volet baie vitrée', status: 'installe' as const, serialNumber: 'SOM-2024-001' },
    { roomId: roomsP1[0]!.id, productId: getProduct('AJAX-MOTION').id, name: 'Détecteur salon', status: 'operationnel' as const, serialNumber: 'AJAX-M-001', isOnline: true },
    { roomId: roomsP1[1]!.id, productId: getProduct('PHI-HUE-GU10').id, name: 'Spot cuisine 1', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP1[1]!.id, productId: getProduct('PHI-HUE-GU10').id, name: 'Spot cuisine 2', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP1[2]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Plafonnier chambre', status: 'configure' as const },
    { roomId: roomsP1[2]!.id, productId: getProduct('SOM-IO-RS100').id, name: 'Volet chambre', status: 'planifie' as const },
    { roomId: roomsP1[6]!.id, productId: getProduct('UBNT-U6-PRO').id, name: 'AP WiFi bureau', status: 'operationnel' as const, ipAddress: '192.168.1.10', isOnline: true },
    { roomId: roomsP1[7]!.id, productId: getProduct('AJAX-DOOR').id, name: 'Détecteur porte garage', status: 'operationnel' as const, isOnline: true },
  ]);

  // Quote 1: totalHT=4825.52 (after 5% discount), costHT= (12*28.50 + 5*122.85 + 1*226.85 + 0)*0.95 = (342+614.25+226.85)*0.95 = 1183.10*0.95 = 1123.95
  const [quote1] = await db.insert(quotes).values({
    projectId: projet1.id, number: 'DEV-2024-001', status: 'accepte' as const,
    validUntil: new Date('2024-04-15'), totalHT: '4825.52', totalTVA: '965.10', totalTTC: '5790.62',
    discount: '5.00', totalCostHT: '1123.95', totalMarginHT: '3701.57', marginPercent: '76.71',
    sentAt: new Date('2024-03-01'),
  }).returning();

  await db.insert(quoteLines).values([
    { quoteId: quote1.id, productId: getProduct('PHI-HUE-E27').id, description: 'Ampoule Hue E27', quantity: 12, unitPriceHT: '41.58', unitCostHT: '28.50', totalHT: '498.96', sortOrder: 1 },
    { quoteId: quote1.id, productId: getProduct('SOM-IO-RS100').id, description: 'Moteur volet Somfy', quantity: 5, unitPriceHT: '189.00', unitCostHT: '122.85', totalHT: '945.00', sortOrder: 2 },
    { quoteId: quote1.id, productId: getProduct('AJAX-HUB2').id, description: 'Centrale Ajax', quantity: 1, unitPriceHT: '349.00', unitCostHT: '226.85', totalHT: '349.00', sortOrder: 3 },
    { quoteId: quote1.id, productId: getProduct('MO-INSTALL-H').id, description: 'Installation 24h', quantity: 24, unitPriceHT: '55.00', totalHT: '1320.00', sortOrder: 4 },
  ]);

  // PROJET 2: Appart Bernard
  const [projet2] = await db.insert(projects).values({
    clientId: insertedClients[1]!.id, userId: marie.id, name: 'Appart Bernard - Audio multiroom',
    description: 'Système audio Sonos + éclairage', status: 'en_cours', address: '28 avenue des Champs',
    city: 'Lyon', postalCode: '69003', surface: '95.00', roomCount: 4,
  }).returning();

  const roomsP2 = await db.insert(rooms).values([
    { projectId: projet2.id, name: 'Séjour', type: 'salon' as const, floor: 3 },
    { projectId: projet2.id, name: 'Cuisine', type: 'cuisine' as const, floor: 3 },
    { projectId: projet2.id, name: 'Chambre', type: 'chambre' as const, floor: 3 },
    { projectId: projet2.id, name: 'Salle de bain', type: 'salle_de_bain' as const, floor: 3 },
  ]).returning();

  await db.insert(projectProducts).values([
    { projectId: projet2.id, productId: getProduct('SONOS-ARC').id, quantity: 1 },
    { projectId: projet2.id, productId: getProduct('SONOS-SUB').id, quantity: 1 },
    { projectId: projet2.id, productId: getProduct('SONOS-ONE').id, quantity: 3 },
    { projectId: projet2.id, productId: getProduct('PHI-HUE-E27').id, quantity: 6 },
    { projectId: projet2.id, productId: getProduct('PHI-HUE-BRIDGE').id, quantity: 1 },
  ]);

  await db.insert(devices).values([
    { roomId: roomsP2[0]!.id, productId: getProduct('SONOS-ARC').id, name: 'Barre de son Arc', status: 'operationnel' as const, ipAddress: '192.168.1.50', isOnline: true },
    { roomId: roomsP2[0]!.id, productId: getProduct('SONOS-SUB').id, name: 'Caisson Sub', status: 'operationnel' as const, ipAddress: '192.168.1.51', isOnline: true },
    { roomId: roomsP2[0]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Lampe séjour', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP2[1]!.id, productId: getProduct('SONOS-ONE').id, name: 'Enceinte cuisine', status: 'operationnel' as const, ipAddress: '192.168.1.52', isOnline: true },
    { roomId: roomsP2[2]!.id, productId: getProduct('SONOS-ONE').id, name: 'Enceinte chambre', status: 'configure' as const },
  ]);

  // Quote 2: cost = 629.30 + 3*125.30 = 629.30+375.90 = 1005.20, margin = 2180 - 1005.20 = 1174.80
  const [quote2] = await db.insert(quotes).values({
    projectId: projet2.id, number: 'DEV-2024-002', status: 'envoye' as const,
    validUntil: new Date('2024-05-01'), totalHT: '2180.00', totalTVA: '436.00', totalTTC: '2616.00',
    totalCostHT: '1005.20', totalMarginHT: '1174.80', marginPercent: '53.89',
  }).returning();

  await db.insert(quoteLines).values([
    { quoteId: quote2.id, productId: getProduct('SONOS-ARC').id, description: 'Sonos Arc', quantity: 1, unitPriceHT: '899.00', unitCostHT: '629.30', totalHT: '899.00', sortOrder: 1 },
    { quoteId: quote2.id, productId: getProduct('SONOS-ONE').id, description: 'Sonos One', quantity: 3, unitPriceHT: '179.00', unitCostHT: '125.30', totalHT: '537.00', sortOrder: 2 },
    { quoteId: quote2.id, productId: getProduct('MO-INSTALL-H').id, description: 'Installation', quantity: 8, unitPriceHT: '55.00', totalHT: '440.00', sortOrder: 3 },
  ]);

  // PROJET 3: Maison Petit (terminé)
  const [projet3] = await db.insert(projects).values({
    clientId: insertedClients[2]!.id, userId: jean.id, name: 'Maison Petit - Éclairage',
    description: 'Éclairage connecté complet', status: 'termine', address: '5 impasse du Château',
    city: 'Bordeaux', postalCode: '33000', surface: '120.00', roomCount: 6,
  }).returning();

  const roomsP3 = await db.insert(rooms).values([
    { projectId: projet3.id, name: 'Salon', type: 'salon' as const, floor: 0 },
    { projectId: projet3.id, name: 'Cuisine', type: 'cuisine' as const, floor: 0 },
    { projectId: projet3.id, name: 'Chambre 1', type: 'chambre' as const, floor: 1 },
    { projectId: projet3.id, name: 'Chambre 2', type: 'chambre' as const, floor: 1 },
    { projectId: projet3.id, name: 'SDB', type: 'salle_de_bain' as const, floor: 1 },
    { projectId: projet3.id, name: 'Entrée', type: 'autre' as const, floor: 0 },
  ]).returning();

  await db.insert(projectProducts).values([
    { projectId: projet3.id, productId: getProduct('PHI-HUE-E27').id, quantity: 10 },
    { projectId: projet3.id, productId: getProduct('PHI-HUE-GU10').id, quantity: 6 },
    { projectId: projet3.id, productId: getProduct('PHI-HUE-BRIDGE').id, quantity: 1 },
    { projectId: projet3.id, productId: getProduct('PHI-HUE-DIM').id, quantity: 4 },
    { projectId: projet3.id, productId: getProduct('PHI-HUE-STRIP').id, quantity: 2 },
  ]);

  await db.insert(devices).values([
    { roomId: roomsP3[0]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Plafonnier salon', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP3[0]!.id, productId: getProduct('PHI-HUE-STRIP').id, name: 'Bandeau TV', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP3[1]!.id, productId: getProduct('PHI-HUE-GU10').id, name: 'Spots cuisine', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP3[2]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Plafonnier ch1', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP3[3]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Plafonnier ch2', status: 'operationnel' as const, isOnline: true },
  ]);

  // Quote 3: cost = 10*28.50 + 6*19.90 + 1*32.50 = 285+119.40+32.50 = 436.90, margin = 1250-436.90 = 813.10
  const [quote3] = await db.insert(quotes).values({
    projectId: projet3.id, number: 'DEV-2024-003', status: 'accepte' as const,
    validUntil: new Date('2024-02-15'), totalHT: '1250.00', totalTVA: '250.00', totalTTC: '1500.00',
    totalCostHT: '436.90', totalMarginHT: '813.10', marginPercent: '65.05',
    sentAt: new Date('2024-01-20'),
  }).returning();

  await db.insert(quoteLines).values([
    { quoteId: quote3.id, productId: getProduct('PHI-HUE-E27').id, description: 'Ampoules E27', quantity: 10, unitPriceHT: '41.58', unitCostHT: '28.50', totalHT: '415.80', sortOrder: 1 },
    { quoteId: quote3.id, productId: getProduct('PHI-HUE-GU10').id, description: 'Spots GU10', quantity: 6, unitPriceHT: '29.08', unitCostHT: '19.90', totalHT: '174.48', sortOrder: 2 },
    { quoteId: quote3.id, productId: getProduct('PHI-HUE-BRIDGE').id, description: 'Bridge', quantity: 1, unitPriceHT: '49.92', unitCostHT: '32.50', totalHT: '49.92', sortOrder: 3 },
    { quoteId: quote3.id, productId: getProduct('MO-INSTALL-H').id, description: 'Installation', quantity: 8, unitPriceHT: '55.00', totalHT: '440.00', sortOrder: 4 },
  ]);

  // PROJET 4: Villa Moreau - Sécurité
  const [projet4] = await db.insert(projects).values({
    clientId: insertedClients[3]!.id, userId: marie.id, name: 'Villa Moreau - Sécurité',
    description: 'Alarme + vidéosurveillance', status: 'en_cours', address: '42 boulevard Victor Hugo',
    city: 'Marseille', postalCode: '13008', surface: '210.00', roomCount: 9,
  }).returning();

  const roomsP4 = await db.insert(rooms).values([
    { projectId: projet4.id, name: 'Entrée', type: 'autre' as const, floor: 0 },
    { projectId: projet4.id, name: 'Salon', type: 'salon' as const, floor: 0 },
    { projectId: projet4.id, name: 'Cuisine', type: 'cuisine' as const, floor: 0 },
    { projectId: projet4.id, name: 'Garage', type: 'garage' as const, floor: 0 },
    { projectId: projet4.id, name: 'Chambre 1', type: 'chambre' as const, floor: 1 },
    { projectId: projet4.id, name: 'Chambre 2', type: 'chambre' as const, floor: 1 },
    { projectId: projet4.id, name: 'Bureau', type: 'bureau' as const, floor: 1 },
    { projectId: projet4.id, name: 'Jardin', type: 'exterieur' as const, floor: 0 },
    { projectId: projet4.id, name: 'Terrasse', type: 'exterieur' as const, floor: 0 },
  ]).returning();

  await db.insert(projectProducts).values([
    { projectId: projet4.id, productId: getProduct('AJAX-HUB2').id, quantity: 1 },
    { projectId: projet4.id, productId: getProduct('AJAX-MOTION').id, quantity: 8 },
    { projectId: projet4.id, productId: getProduct('AJAX-DOOR').id, quantity: 10 },
    { projectId: projet4.id, productId: getProduct('AJAX-KEYPAD').id, quantity: 2 },
    { projectId: projet4.id, productId: getProduct('RING-DOORBELL').id, quantity: 1 },
  ]);

  await db.insert(devices).values([
    { roomId: roomsP4[0]!.id, productId: getProduct('AJAX-HUB2').id, name: 'Centrale Ajax', status: 'operationnel' as const, serialNumber: 'AJAX-HUB-004', isOnline: true },
    { roomId: roomsP4[0]!.id, productId: getProduct('AJAX-KEYPAD').id, name: 'Clavier entrée', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP4[0]!.id, productId: getProduct('RING-DOORBELL').id, name: 'Sonnette vidéo', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP4[1]!.id, productId: getProduct('AJAX-MOTION').id, name: 'Détecteur salon', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP4[2]!.id, productId: getProduct('AJAX-MOTION').id, name: 'Détecteur cuisine', status: 'installe' as const },
    { roomId: roomsP4[3]!.id, productId: getProduct('AJAX-DOOR').id, name: 'Contact porte garage', status: 'operationnel' as const, isOnline: true },
    { roomId: roomsP4[7]!.id, productId: getProduct('AJAX-MOTION').id, name: 'Détecteur jardin', status: 'planifie' as const },
  ]);

  // Quote 4: cost = 226.85 + 8*51.35 + 10*31.85 = 226.85+410.80+318.50 = 956.15, margin = 2890-956.15 = 1933.85
  const [quote4] = await db.insert(quotes).values({
    projectId: projet4.id, number: 'DEV-2024-004', status: 'envoye' as const,
    validUntil: new Date('2024-04-30'), totalHT: '2890.00', totalTVA: '578.00', totalTTC: '3468.00',
    totalCostHT: '956.15', totalMarginHT: '1933.85', marginPercent: '66.91',
    sentAt: new Date('2024-03-15'),
  }).returning();

  await db.insert(quoteLines).values([
    { quoteId: quote4.id, productId: getProduct('AJAX-HUB2').id, description: 'Centrale Ajax Hub 2', quantity: 1, unitPriceHT: '349.00', unitCostHT: '226.85', totalHT: '349.00', sortOrder: 1 },
    { quoteId: quote4.id, productId: getProduct('AJAX-MOTION').id, description: 'Détecteurs mouvement', quantity: 8, unitPriceHT: '79.00', unitCostHT: '51.35', totalHT: '632.00', sortOrder: 2 },
    { quoteId: quote4.id, productId: getProduct('AJAX-DOOR').id, description: 'Détecteurs ouverture', quantity: 10, unitPriceHT: '49.00', unitCostHT: '31.85', totalHT: '490.00', sortOrder: 3 },
    { quoteId: quote4.id, productId: getProduct('MO-INSTALL-H').id, description: 'Installation', quantity: 16, unitPriceHT: '55.00', totalHT: '880.00', sortOrder: 4 },
  ]);

  // PROJET 5: Maison Roux (brouillon)
  const [projet5] = await db.insert(projects).values({
    clientId: insertedClients[4]!.id, userId: jean.id, name: 'Maison Roux - Neuf RT2020',
    description: 'Installation domotique construction neuve', status: 'brouillon',
    address: '8 rue des Lilas', city: 'Toulouse', postalCode: '31000', surface: '145.00', roomCount: 7,
  }).returning();

  await db.insert(rooms).values([
    { projectId: projet5.id, name: 'Salon/Séjour', type: 'salon' as const, floor: 0 },
    { projectId: projet5.id, name: 'Cuisine', type: 'cuisine' as const, floor: 0 },
    { projectId: projet5.id, name: 'Suite parentale', type: 'chambre' as const, floor: 1 },
    { projectId: projet5.id, name: 'Chambre 1', type: 'chambre' as const, floor: 1 },
    { projectId: projet5.id, name: 'Chambre 2', type: 'chambre' as const, floor: 1 },
    { projectId: projet5.id, name: 'SDB étage', type: 'salle_de_bain' as const, floor: 1 },
    { projectId: projet5.id, name: 'Garage', type: 'garage' as const, floor: 0 },
  ]);

  await db.insert(projectProducts).values([
    { projectId: projet5.id, productId: getProduct('PHI-HUE-E27').id, quantity: 15 },
    { projectId: projet5.id, productId: getProduct('SOM-IO-RS100').id, quantity: 8 },
    { projectId: projet5.id, productId: getProduct('SOM-TAHOMA').id, quantity: 1 },
    { projectId: projet5.id, productId: getProduct('TADO-STARTER').id, quantity: 1 },
    { projectId: projet5.id, productId: getProduct('TADO-TRV').id, quantity: 6 },
    { projectId: projet5.id, productId: getProduct('UBNT-DREAM').id, quantity: 1 },
    { projectId: projet5.id, productId: getProduct('UBNT-U6-PRO').id, quantity: 3 },
  ]);

  await db.insert(quotes).values({
    projectId: projet5.id, number: 'DEV-2024-005', status: 'brouillon' as const,
    validUntil: new Date('2024-06-01'), totalHT: '4500.00', totalTVA: '900.00', totalTTC: '5400.00',
  });

  // PROJET 6: Appart Simon (archivé)
  const [projet6] = await db.insert(projects).values({
    clientId: insertedClients[5]!.id, userId: marie.id, name: 'Appart Simon - Smart Home',
    description: 'Solution clé en main', status: 'archive', address: '17 place de la République',
    city: 'Nantes', postalCode: '44000', surface: '78.00', roomCount: 3,
  }).returning();

  const roomsP6 = await db.insert(rooms).values([
    { projectId: projet6.id, name: 'Pièce de vie', type: 'salon' as const, floor: 2 },
    { projectId: projet6.id, name: 'Chambre', type: 'chambre' as const, floor: 2 },
    { projectId: projet6.id, name: 'SDB', type: 'salle_de_bain' as const, floor: 2 },
  ]).returning();

  await db.insert(devices).values([
    { roomId: roomsP6[0]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Éclairage salon', status: 'operationnel' as const, isOnline: false },
    { roomId: roomsP6[0]!.id, productId: getProduct('NEST-THERM-3').id, name: 'Thermostat', status: 'operationnel' as const, isOnline: false },
    { roomId: roomsP6[1]!.id, productId: getProduct('PHI-HUE-E27').id, name: 'Éclairage chambre', status: 'operationnel' as const, isOnline: false },
  ]);

  await db.insert(quotes).values({
    projectId: projet6.id, number: 'DEV-2023-012', status: 'accepte' as const,
    validUntil: new Date('2023-12-15'), totalHT: '1800.00', totalTVA: '360.00', totalTTC: '2160.00',
    sentAt: new Date('2023-11-01'),
  });

  // ========================================
  // CHECKLIST ITEMS
  // ========================================
  console.log('✅ Création des checklists...');
  await db.insert(checklistItems).values([
    { roomId: roomsP1[0]!.id, category: 'Éclairage', label: 'Points lumineux identifiés', checked: true },
    { roomId: roomsP1[0]!.id, category: 'Éclairage', label: 'Interrupteurs localisés', checked: true },
    { roomId: roomsP1[0]!.id, category: 'Volets', label: 'Motorisation possible', checked: true },
    { roomId: roomsP1[0]!.id, category: 'Réseau', label: 'Couverture WiFi OK', checked: false },
    { roomId: roomsP1[1]!.id, category: 'Éclairage', label: 'Spots existants', checked: true },
    { roomId: roomsP1[6]!.id, category: 'Réseau', label: 'Prise RJ45 présente', checked: true },
    { roomId: roomsP4[0]!.id, category: 'Sécurité', label: 'Emplacement centrale', checked: true },
    { roomId: roomsP4[0]!.id, category: 'Sécurité', label: 'Alimentation secours', checked: true },
    { roomId: roomsP4[3]!.id, category: 'Sécurité', label: 'Contact porte possible', checked: true },
  ]);

  // ========================================
  // RÉSUMÉ
  // ========================================
  console.log('\n✨ Seed terminé !\n');
  console.log('📊 Données créées :');
  console.log('   • 4 utilisateurs');
  console.log('   • 6 clients');
  console.log('   • 8 fournisseurs');
  console.log('   • 6 projets (avec pièces, produits, devices, devis)');
  console.log('   • 25 produits au catalogue (avec prix d\'achat et marges)');
  console.log('   • 30+ devices installés');
  console.log('   • 6 devis avec lignes et marges calculées');
  console.log('\n🔐 Connexion : email + password123');

  process.exit(0);
}

seed().catch(e => { console.error('❌ Erreur:', e); process.exit(1); });
