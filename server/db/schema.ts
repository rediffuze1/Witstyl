import { pgTable, text, timestamp, boolean, decimal, integer, uuid, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Table des utilisateurs (propriétaires de salon)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des sessions (pour l'authentification)
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des salons
export const salons = pgTable('salons', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des services
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  duration: integer('duration').notNull(), // en minutes
  tags: text('tags').array(), // tableau de tags/catégories
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des stylistes
export const stylistes = pgTable('stylistes', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  specialties: text('specialties').array(), // tableau de spécialités
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des clients
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  preferredStylistId: uuid('preferred_stylist_id').references(() => stylistes.id, { onDelete: 'set null' }),
  notes: text('notes'), // Notes internes (JSON pour sex, etc.)
  ownerNotes: text('owner_notes'), // Notes privées visibles uniquement par le owner (post-it)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des rendez-vous
export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  stylistId: uuid('stylist_id').notNull().references(() => stylistes.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  appointmentDate: timestamp('appointment_date').notNull(),
  duration: integer('duration').notNull(), // en minutes
  status: text('status').default('scheduled').notNull(), // scheduled, confirmed, completed, cancelled
  notes: text('notes'),
  // Colonnes pour intégrations externes (déprécié, conservé pour compatibilité)
  externalId: text('external_id').unique(), // ID de réservation externe (déprécié)
  payload: jsonb('payload'), // Payload complet pour traçabilité
  // Colonnes pour tracking des notifications (Option B & C)
  emailSentAt: timestamp('email_sent_at'), // Date d'envoi de l'email de confirmation
  emailOpenedAt: timestamp('email_opened_at'), // Date d'ouverture de l'email (via webhook Resend)
  smsConfirmationSent: boolean('sms_confirmation_sent').default(false).notNull(), // SMS de confirmation envoyé
  smsReminderSent: boolean('sms_reminder_sent').default(false).notNull(), // SMS de rappel envoyé
  smsConfirmationType: text('sms_confirmation_type'), // Type de SMS: "immediate_less_24h", "confirmation_missing_email_open", etc.
  skipReminderSms: boolean('skip_reminder_sms').default(false).notNull(), // true si RDV pris < 24h avant (pas de rappel)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des horaires d'ouverture
export const openingHours = pgTable('opening_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = dimanche, 1 = lundi, etc.
  openTime: text('open_time').notNull(), // format HH:MM
  closeTime: text('close_time').notNull(), // format HH:MM
  isClosed: boolean('is_closed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des paramètres
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table des notifications client
export const clientNotifications = pgTable('client_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'appointment', 'reminder', 'promotion', 'system'
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  priority: text('priority').default('medium').notNull(), // 'low', 'medium', 'high'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  salons: many(salons),
  sessions: many(sessions),
}));

export const salonsRelations = relations(salons, ({ one, many }) => ({
  user: one(users, {
    fields: [salons.userId],
    references: [users.id],
  }),
  services: many(services),
  stylistes: many(stylistes),
  clients: many(clients),
  appointments: many(appointments),
  openingHours: many(openingHours),
  settings: many(settings),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  salon: one(salons, {
    fields: [services.salonId],
    references: [salons.id],
  }),
  appointments: many(appointments),
}));

export const stylistesRelations = relations(stylistes, ({ one, many }) => ({
  salon: one(salons, {
    fields: [stylistes.salonId],
    references: [salons.id],
  }),
  clients: many(clients),
  appointments: many(appointments),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  salon: one(salons, {
    fields: [clients.salonId],
    references: [salons.id],
  }),
  preferredStylist: one(stylistes, {
    fields: [clients.preferredStylistId],
    references: [stylistes.id],
  }),
  appointments: many(appointments),
  notifications: many(clientNotifications),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  salon: one(salons, {
    fields: [appointments.salonId],
    references: [salons.id],
  }),
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
  }),
  stylist: one(stylistes, {
    fields: [appointments.stylistId],
    references: [stylistes.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  notifications: many(clientNotifications),
}));

export const clientNotificationsRelations = relations(clientNotifications, ({ one }) => ({
  client: one(clients, {
    fields: [clientNotifications.clientId],
    references: [clients.id],
  }),
  appointment: one(appointments, {
    fields: [clientNotifications.appointmentId],
    references: [appointments.id],
  }),
}));

// Table des événements email (pour tracking Resend webhooks)
// Note: appointment_id est TEXT pour correspondre au type de appointments.id dans Supabase
export const emailEvents = pgTable('email_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: text('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'delivered', 'opened', 'bounced', 'complained', etc.
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  provider: text('provider').default('Resend').notNull(), // 'Resend', 'SendGrid', etc.
  providerEventId: text('provider_event_id'), // ID de l'événement côté provider
  metadata: jsonb('metadata'), // Métadonnées supplémentaires (IP, user-agent, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  appointment: one(appointments, {
    fields: [emailEvents.appointmentId],
    references: [appointments.id],
  }),
}));

export const appointmentsRelationsWithEmailEvents = relations(appointments, ({ many }) => ({
  emailEvents: many(emailEvents),
}));

export const openingHoursRelations = relations(openingHours, ({ one }) => ({
  salon: one(salons, {
    fields: [openingHours.salonId],
    references: [salons.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  salon: one(salons, {
    fields: [settings.salonId],
    references: [salons.id],
  }),
}));

// Types TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Salon = typeof salons.$inferSelect;
export type NewSalon = typeof salons.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type Styliste = typeof stylistes.$inferSelect;
export type NewStyliste = typeof stylistes.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

export type OpeningHour = typeof openingHours.$inferSelect;
export type NewOpeningHour = typeof openingHours.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type ClientNotification = typeof clientNotifications.$inferSelect;
export type NewClientNotification = typeof clientNotifications.$inferInsert;

export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;
