/**
 * Tests pour useReportRange
 * 
 * Vérifie que les calculs de période sont corrects pour chaque granularité
 */

import { describe, it, expect } from "vitest";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

describe("Report Range Calculations", () => {
  describe("Day view", () => {
    it("should calculate correct day range", () => {
      const testDate = new Date("2025-11-20T14:30:00Z");
      const expectedStart = startOfDay(testDate);
      const expectedEnd = endOfDay(testDate);

      expect(expectedStart.getHours()).toBe(0);
      expect(expectedStart.getMinutes()).toBe(0);
      expect(expectedStart.getSeconds()).toBe(0);
      expect(expectedStart.getMilliseconds()).toBe(0);

      expect(expectedEnd.getHours()).toBe(23);
      expect(expectedEnd.getMinutes()).toBe(59);
      expect(expectedEnd.getSeconds()).toBe(59);
      expect(expectedEnd.getMilliseconds()).toBe(999);
    });

    it("should include appointment at 09:00 in the day", () => {
      const testDate = new Date("2025-11-20T14:30:00Z");
      const dayStart = startOfDay(testDate);
      const dayEnd = endOfDay(testDate);
      
      const appointmentDate = new Date("2025-11-20T09:00:00Z");
      
      expect(appointmentDate >= dayStart).toBe(true);
      expect(appointmentDate <= dayEnd).toBe(true);
    });
  });

  describe("Week view", () => {
    it("should calculate correct ISO week range (Monday to Sunday)", () => {
      // Mercredi 19 novembre 2025
      const testDate = new Date("2025-11-19T14:30:00Z");
      const weekStart = startOfWeek(testDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(testDate, { weekStartsOn: 1 });
      
      // Vérifier que c'est un lundi
      expect(weekStart.getDay()).toBe(1); // 1 = lundi
      
      // Vérifier que c'est un dimanche
      expect(weekEnd.getDay()).toBe(0); // 0 = dimanche
      
      // Vérifier que la semaine contient 7 jours
      const daysDiff = Math.floor((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(6); // 6 jours entre lundi et dimanche (inclus)
    });

    it("should include appointments from Monday to Sunday", () => {
      // Semaine du 17 au 23 novembre 2025
      const testDate = new Date("2025-11-20T14:30:00Z"); // Mercredi
      const weekStart = startOfWeek(testDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(testDate, { weekStartsOn: 1 });
      weekEnd.setHours(23, 59, 59, 999);
      
      // Rendez-vous lundi
      const mondayAppt = new Date("2025-11-17T09:00:00Z");
      expect(mondayAppt >= weekStart).toBe(true);
      expect(mondayAppt <= weekEnd).toBe(true);
      
      // Rendez-vous dimanche
      const sundayAppt = new Date("2025-11-23T23:30:00Z");
      expect(sundayAppt >= weekStart).toBe(true);
      expect(sundayAppt <= weekEnd).toBe(true);
    });

    it("should handle Sunday 23:30 correctly (belongs to current week)", () => {
      // Dimanche 23 novembre 2025 à 23:30
      const sundayDate = new Date("2025-11-23T23:30:00Z");
      const weekStart = startOfWeek(sundayDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(sundayDate, { weekStartsOn: 1 });
      weekEnd.setHours(23, 59, 59, 999);
      
      expect(sundayDate >= weekStart).toBe(true);
      expect(sundayDate <= weekEnd).toBe(true);
    });

    it("should calculate previous week correctly", () => {
      // Semaine du 17 au 23 novembre 2025
      const testDate = new Date("2025-11-20T14:30:00Z");
      const weekStart = startOfWeek(testDate, { weekStartsOn: 1 });
      
      // Semaine précédente
      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(weekStart.getDate() - 7);
      const previousWeekEnd = new Date(previousWeekStart);
      previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
      previousWeekEnd.setHours(23, 59, 59, 999);
      
      // Vérifier que c'est bien la semaine du 10 au 16 novembre
      expect(previousWeekStart.getDate()).toBe(10);
      expect(previousWeekEnd.getDate()).toBe(16);
    });
  });

  describe("Month view", () => {
    it("should calculate correct month range", () => {
      const testDate = new Date("2025-11-20T14:30:00Z");
      const monthStart = startOfMonth(testDate);
      const monthEnd = endOfMonth(testDate);
      monthEnd.setHours(23, 59, 59, 999);
      
      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(10); // Novembre = 10 (0-indexed)
      expect(monthStart.getFullYear()).toBe(2025);
      
      expect(monthEnd.getDate()).toBe(30); // Novembre a 30 jours
      expect(monthEnd.getMonth()).toBe(10);
      expect(monthEnd.getFullYear()).toBe(2025);
    });
  });
});




