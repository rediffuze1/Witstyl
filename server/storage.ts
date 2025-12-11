import {
  users,
  salons,
  services,
  stylistes,
  clients,
  appointments,
  salonHours,
  stylistSchedule,
  type User,
  type UpsertUser,
  type Salon,
  type InsertSalon,
  type Service,
  type InsertService,
  type Styliste,
  type InsertStyliste,
  type Client,
  type InsertClient,
  type Appointment,
  type InsertAppointment,
  type SalonHours,
  type StylistSchedule,
} from "@shared/schema";
import { db } from "./db.js";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  
  // Salon operations
  getSalonByUserId(userId: string): Promise<Salon | undefined>;
  createSalon(salon: InsertSalon): Promise<Salon>;
  updateSalon(id: string, salon: Partial<InsertSalon>): Promise<Salon>;
  
  // Service operations
  getServicesBySalonId(salonId: string): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: string): Promise<void>;
  
  // Stylist operations
  getStylistsBySalonId(salonId: string): Promise<Styliste[]>;
  getStylist(id: string): Promise<Styliste | undefined>;
  createStylist(stylist: InsertStyliste): Promise<Styliste>;
  updateStylist(id: string, stylist: Partial<InsertStyliste>): Promise<Styliste>;
  deleteStylist(id: string): Promise<void>;
  
  // Client operations
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  
  // Appointment operations
  getAppointmentsBySalonId(salonId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;
  getAppointmentsByStylistId(stylistId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  getAppointmentsByClientId(clientId: string): Promise<Appointment[]>;
  
  // Availability checking
  checkStylistAvailability(stylistId: string, startTime: Date, endTime: Date): Promise<boolean>;
  getAvailableSlots(salonId: string, stylistId: string, date: Date, serviceDuration: number): Promise<Date[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Salon operations
  async getSalonByUserId(userId: string): Promise<Salon | undefined> {
    const [salon] = await db.select().from(salons).where(eq(salons.userId, userId));
    return salon;
  }

  async createSalon(salon: InsertSalon): Promise<Salon> {
    const [newSalon] = await db.insert(salons).values(salon).returning();
    return newSalon;
  }

  async updateSalon(id: string, salon: Partial<InsertSalon>): Promise<Salon> {
    const [updatedSalon] = await db
      .update(salons)
      .set({ ...salon, updatedAt: new Date() })
      .where(eq(salons.id, id))
      .returning();
    return updatedSalon;
  }

  // Service operations
  async getServicesBySalonId(salonId: string): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.salonId, salonId)).orderBy(asc(services.name));
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service> {
    const [updatedService] = await db
      .update(services)
      .set({ ...service, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // Stylist operations
  async getStylistsBySalonId(salonId: string): Promise<Styliste[]> {
    return await db.select().from(stylistes).where(eq(stylistes.salonId, salonId)).orderBy(asc(stylistes.firstName));
  }

  async getStylist(id: string): Promise<Styliste | undefined> {
    const [stylist] = await db.select().from(stylistes).where(eq(stylistes.id, id));
    return stylist;
  }

  async createStylist(stylist: InsertStyliste): Promise<Styliste> {
    const [newStylist] = await db.insert(stylistes).values(stylist).returning();
    return newStylist;
  }

  async updateStylist(id: string, stylist: Partial<InsertStyliste>): Promise<Styliste> {
    const [updatedStylist] = await db
      .update(stylistes)
      .set({ ...stylist, updatedAt: new Date() })
      .where(eq(stylistes.id, id))
      .returning();
    return updatedStylist;
  }

  async deleteStylist(id: string): Promise<void> {
    await db.delete(stylistes).where(eq(stylistes.id, id));
  }

  // Client operations
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(asc(clients.firstName));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.email, email));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  // Appointment operations
  async getAppointmentsBySalonId(salonId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    if (startDate && endDate) {
      return await db.select().from(appointments).where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      ).orderBy(asc(appointments.startTime));
    }
    
    return await db.select().from(appointments).where(eq(appointments.salonId, salonId)).orderBy(asc(appointments.startTime));
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }

  async updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({ ...appointment, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async deleteAppointment(id: string): Promise<void> {
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  async getAppointmentsByStylistId(stylistId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    if (startDate && endDate) {
      return await db.select().from(appointments).where(
        and(
          eq(appointments.stylistId, stylistId),
          gte(appointments.startTime, startDate),
          lte(appointments.startTime, endDate)
        )
      ).orderBy(asc(appointments.startTime));
    }
    
    return await db.select().from(appointments).where(eq(appointments.stylistId, stylistId)).orderBy(asc(appointments.startTime));
  }

  // Availability checking
  async checkStylistAvailability(stylistId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const conflictingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.stylistId, stylistId),
          gte(appointments.endTime, startTime),
          lte(appointments.startTime, endTime)
        )
      );
    
    return conflictingAppointments.length === 0;
  }

  async getAvailableSlots(salonId: string, stylistId: string, date: Date, serviceDuration: number): Promise<Date[]> {
    // This is a simplified implementation
    // In a real app, you'd consider salon hours, stylist schedule, existing appointments, buffers, etc.
    const startOfDay = new Date(date);
    startOfDay.setHours(9, 0, 0, 0); // 9 AM
    
    const endOfDay = new Date(date);
    endOfDay.setHours(18, 0, 0, 0); // 6 PM
    
    const slots: Date[] = [];
    const slotInterval = 15; // 15-minute intervals (quart d'heure)
    
    for (let time = new Date(startOfDay); time < endOfDay; time.setMinutes(time.getMinutes() + slotInterval)) {
      const slotEnd = new Date(time);
      slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);
      
      if (slotEnd <= endOfDay) {
        const isAvailable = await this.checkStylistAvailability(stylistId, new Date(time), slotEnd);
        if (isAvailable) {
          slots.push(new Date(time));
        }
      }
    }
    
    return slots;
  }

  async getAppointmentsByClientId(clientId: string): Promise<Appointment[]> {
    const clientAppointments = await db
      .select()
      .from(appointments)
      .where(eq(appointments.clientId, clientId))
      .orderBy(desc(appointments.startTime));
    
    return clientAppointments;
  }
}

export const storage = new DatabaseStorage();
