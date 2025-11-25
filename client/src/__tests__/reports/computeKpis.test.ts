/**
 * Tests pour computeKpis
 * 
 * Vérifie que les calculs de KPIs sont corrects
 */

import { describe, it, expect } from "vitest";
import {
  computeKpis,
  computeTrends,
  computeKpisWithTrends,
  type Appointment,
  type Client,
  type Service,
} from "@/utils/computeKpis";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

describe("computeKpis", () => {
  const mockServices = new Map<string, Service>([
    ["service-1", { id: "service-1", price: 50 }],
    ["service-2", { id: "service-2", price: 75 }],
    ["service-3", { id: "service-3", price: 100 }],
  ]);

  describe("Day view", () => {
    it("should calculate correct KPIs for a day with one appointment", () => {
      const testDate = new Date("2025-11-20T09:00:00Z");
      const periodStart = startOfDay(testDate);
      const periodEnd = endOfDay(testDate);

      const appointments: Appointment[] = [
        {
          id: "apt-1",
          appointment_date: "2025-11-20T09:00:00Z",
          service_id: "service-1",
          stylist_id: "stylist-1",
          client_id: "client-1",
          status: "confirmed",
        },
      ];

      const clients: Client[] = [
        {
          id: "client-1",
          created_at: "2025-11-20T08:00:00Z",
        },
      ];

      const result = computeKpis(
        appointments,
        clients,
        mockServices,
        periodStart,
        periodEnd
      );

      expect(result.totalAppointments).toBe(1);
      expect(result.totalRevenue).toBe(50);
      expect(result.newClients).toBe(1);
    });

    it("should not count appointments outside the day", () => {
      const testDate = new Date("2025-11-20T09:00:00Z");
      const periodStart = startOfDay(testDate);
      const periodEnd = endOfDay(testDate);

      const appointments: Appointment[] = [
        {
          id: "apt-1",
          appointment_date: "2025-11-20T09:00:00Z", // Dans la journée
          service_id: "service-1",
          stylist_id: "stylist-1",
          client_id: "client-1",
          status: "confirmed",
        },
        {
          id: "apt-2",
          appointment_date: "2025-11-21T09:00:00Z", // Jour suivant
          service_id: "service-2",
          stylist_id: "stylist-1",
          client_id: "client-2",
          status: "confirmed",
        },
      ];

      const clients: Client[] = [];

      const result = computeKpis(
        appointments,
        clients,
        mockServices,
        periodStart,
        periodEnd
      );

      expect(result.totalAppointments).toBe(1);
      expect(result.totalRevenue).toBe(50);
    });
  });

  describe("Week view", () => {
    it("should calculate correct KPIs for a week with appointments on multiple days", () => {
      // Semaine du 17 au 23 novembre 2025
      const testDate = new Date("2025-11-20T14:30:00Z");
      const periodStart = startOfWeek(testDate, { weekStartsOn: 1 });
      const periodEnd = endOfWeek(testDate, { weekStartsOn: 1 });
      periodEnd.setHours(23, 59, 59, 999);

      const appointments: Appointment[] = [
        {
          id: "apt-1",
          appointment_date: "2025-11-17T09:00:00Z", // Lundi
          service_id: "service-1",
          stylist_id: "stylist-1",
          client_id: "client-1",
          status: "confirmed",
        },
        {
          id: "apt-2",
          appointment_date: "2025-11-20T14:00:00Z", // Jeudi
          service_id: "service-2",
          stylist_id: "stylist-1",
          client_id: "client-2",
          status: "confirmed",
        },
        {
          id: "apt-3",
          appointment_date: "2025-11-23T10:00:00Z", // Dimanche
          service_id: "service-3",
          stylist_id: "stylist-1",
          client_id: "client-3",
          status: "confirmed",
        },
      ];

      const clients: Client[] = [
        {
          id: "client-1",
          created_at: "2025-11-17T08:00:00Z",
        },
        {
          id: "client-2",
          created_at: "2025-11-20T08:00:00Z",
        },
      ];

      const result = computeKpis(
        appointments,
        clients,
        mockServices,
        periodStart,
        periodEnd
      );

      expect(result.totalAppointments).toBe(3);
      expect(result.totalRevenue).toBe(225); // 50 + 75 + 100
      expect(result.newClients).toBe(2);
    });

    it("should not count appointments outside the week", () => {
      // Semaine du 17 au 23 novembre 2025
      const testDate = new Date("2025-11-20T14:30:00Z");
      const periodStart = startOfWeek(testDate, { weekStartsOn: 1 });
      const periodEnd = endOfWeek(testDate, { weekStartsOn: 1 });
      periodEnd.setHours(23, 59, 59, 999);

      const appointments: Appointment[] = [
        {
          id: "apt-1",
          appointment_date: "2025-11-17T09:00:00Z", // Lundi (dans la semaine)
          service_id: "service-1",
          stylist_id: "stylist-1",
          client_id: "client-1",
          status: "confirmed",
        },
        {
          id: "apt-2",
          appointment_date: "2025-11-16T09:00:00Z", // Dimanche précédent (hors semaine)
          service_id: "service-2",
          stylist_id: "stylist-1",
          client_id: "client-2",
          status: "confirmed",
        },
        {
          id: "apt-3",
          appointment_date: "2025-11-24T09:00:00Z", // Lundi suivant (hors semaine)
          service_id: "service-3",
          stylist_id: "stylist-1",
          client_id: "client-3",
          status: "confirmed",
        },
      ];

      const clients: Client[] = [];

      const result = computeKpis(
        appointments,
        clients,
        mockServices,
        periodStart,
        periodEnd
      );

      expect(result.totalAppointments).toBe(1);
      expect(result.totalRevenue).toBe(50);
    });
  });

  describe("computeTrends", () => {
    it("should calculate correct trends", () => {
      const current: ReturnType<typeof computeKpis> = {
        totalAppointments: 10,
        totalRevenue: 500,
        newClients: 5,
        retentionRate: 75,
      };

      const previous = {
        totalAppointments: 8,
        totalRevenue: 400,
        newClients: 4,
        retentionRate: 70,
      };

      const trends = computeTrends(current, previous);

      expect(trends.appointments).toBe(25); // (10-8)/8 * 100 = 25%
      expect(trends.revenue).toBe(25); // (500-400)/400 * 100 = 25%
      expect(trends.newClients).toBe(25); // (5-4)/4 * 100 = 25%
    });

    it("should handle zero previous period", () => {
      const current: ReturnType<typeof computeKpis> = {
        totalAppointments: 10,
        totalRevenue: 500,
        newClients: 5,
        retentionRate: 75,
      };

      const previous = {
        totalAppointments: 0,
        totalRevenue: 0,
        newClients: 0,
        retentionRate: 0,
      };

      const trends = computeTrends(current, previous);

      expect(trends.appointments).toBe(100); // Nouveau (pas de période précédente)
      expect(trends.revenue).toBe(100);
      expect(trends.newClients).toBe(100);
    });
  });
});




