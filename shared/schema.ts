import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  time,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const salons = pgTable("salons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  address: text("address"),
  phone: varchar("phone"),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salonId: varchar("salon_id").notNull().references(() => salons.id),
  name: varchar("name").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  tags: text("tags").array().default([]),
  requiresDeposit: boolean("requires_deposit").default(false),
  bufferBefore: integer("buffer_before").default(0),
  bufferAfter: integer("buffer_after").default(0),
  processingTime: integer("processing_time").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stylistes = pgTable("stylistes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salonId: varchar("salon_id").notNull().references(() => salons.id),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  photoUrl: varchar("photo_url"),
  specialties: text("specialties").array().default([]),
  isActive: boolean("is_active").default(true),
  color: varchar("color"), // Couleur personnalisée pour le calendrier
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  notes: text("notes"), // Notes internes (JSON pour sex, etc.)
  ownerNotes: text("owner_notes"), // Notes privées visibles uniquement par le owner (post-it)
  preferredStylistId: varchar("preferred_stylist_id").references(() => stylistes.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salonId: varchar("salon_id").notNull().references(() => salons.id),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  stylistId: varchar("stylist_id").notNull().references(() => stylistes.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, confirmed, completed, cancelled, no_show
  channel: varchar("channel").notNull().default("form"), // form, voice
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, refunded
  notes: text("notes"),
  // Champs pour intégrations externes (déprécié, conservé pour compatibilité)
  externalId: varchar("external_id").unique(), // ID de réservation externe (déprécié)
  payload: jsonb("payload"), // Payload JSON brut du webhook pour traçabilité
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const salonHours = pgTable("salon_hours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salonId: varchar("salon_id").notNull().references(() => salons.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
  openTime: time("open_time"),
  closeTime: time("close_time"),
  isClosed: boolean("is_closed").default(false),
});

export const stylistSchedule = pgTable("stylist_schedule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stylistId: varchar("stylist_id").notNull().references(() => stylistes.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  isAvailable: boolean("is_available").default(true),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  salon: one(salons, {
    fields: [users.id],
    references: [salons.userId],
  }),
}));

export const salonsRelations = relations(salons, ({ one, many }) => ({
  user: one(users, {
    fields: [salons.userId],
    references: [users.id],
  }),
  services: many(services),
  stylistes: many(stylistes),
  appointments: many(appointments),
  hours: many(salonHours),
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
  appointments: many(appointments),
  schedule: many(stylistSchedule),
  preferredClients: many(clients),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  preferredStylist: one(stylistes, {
    fields: [clients.preferredStylistId],
    references: [stylistes.id],
  }),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  salon: one(salons, {
    fields: [appointments.salonId],
    references: [salons.id],
  }),
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
  }),
  styliste: one(stylistes, {
    fields: [appointments.stylistId],
    references: [stylistes.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
}));

export const salonHoursRelations = relations(salonHours, ({ one }) => ({
  salon: one(salons, {
    fields: [salonHours.salonId],
    references: [salons.id],
  }),
}));

export const stylistScheduleRelations = relations(stylistSchedule, ({ one }) => ({
  styliste: one(stylistes, {
    fields: [stylistSchedule.stylistId],
    references: [stylistes.id],
  }),
}));

// Insert schemas
export const insertSalonSchema = createInsertSchema(salons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStylistSchema = createInsertSchema(stylistes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Créer le schéma de base avec tous les champs
const baseClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Étendre pour s'assurer que ownerNotes est inclus (même si createInsertSchema ne le reconnaît pas)
export const insertClientSchema = baseClientSchema.extend({
  ownerNotes: z.string().optional().default(""), // Permettre les chaînes vides avec valeur par défaut
}).passthrough(); // Permettre les champs supplémentaires

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Salon = typeof salons.$inferSelect;
export type InsertSalon = z.infer<typeof insertSalonSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Styliste = typeof stylistes.$inferSelect;
export type InsertStyliste = z.infer<typeof insertStylistSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type SalonHours = typeof salonHours.$inferSelect;
export type StylistSchedule = typeof stylistSchedule.$inferSelect;
