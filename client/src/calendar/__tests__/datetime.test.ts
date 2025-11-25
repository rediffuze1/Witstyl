/**
 * Tests unitaires pour les utilitaires datetime
 */

import { describe, it, expect } from 'vitest';
import {
  overlaps,
  snapToGrid,
  generateTimeGrid,
  isSameDay,
  addMinutes,
  durationMinutes,
  getWeekStart,
  clampToBusinessHours,
} from '../utils/datetime';
import type { CalendarEvent, BusinessHours } from '../types';

describe('datetime utils', () => {
  describe('overlaps', () => {
    it('devrait détecter un chevauchement simple', () => {
      const a: CalendarEvent = {
        id: '1',
        title: 'Event A',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
      };
      const b: CalendarEvent = {
        id: '2',
        title: 'Event B',
        start: '2024-01-01T10:30:00Z',
        end: '2024-01-01T11:30:00Z',
      };
      expect(overlaps(a, b)).toBe(true);
    });

    it('ne devrait pas détecter de chevauchement pour des événements séparés', () => {
      const a: CalendarEvent = {
        id: '1',
        title: 'Event A',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
      };
      const b: CalendarEvent = {
        id: '2',
        title: 'Event B',
        start: '2024-01-01T12:00:00Z',
        end: '2024-01-01T13:00:00Z',
      };
      expect(overlaps(a, b)).toBe(false);
    });

    it('devrait détecter un chevauchement quand un événement contient l\'autre', () => {
      const a: CalendarEvent = {
        id: '1',
        title: 'Event A',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T12:00:00Z',
      };
      const b: CalendarEvent = {
        id: '2',
        title: 'Event B',
        start: '2024-01-01T10:30:00Z',
        end: '2024-01-01T11:30:00Z',
      };
      expect(overlaps(a, b)).toBe(true);
    });
  });

  describe('snapToGrid', () => {
    it('devrait arrondir à la grille de 15 minutes', () => {
      const date = new Date('2024-01-01T10:07:00Z');
      const snapped = snapToGrid(date, 15);
      expect(snapped.getMinutes()).toBe(0);
    });

    it('devrait arrondir à la grille de 30 minutes', () => {
      const date = new Date('2024-01-01T10:20:00Z');
      const snapped = snapToGrid(date, 30);
      expect(snapped.getMinutes()).toBe(30);
    });
  });

  describe('generateTimeGrid', () => {
    it('devrait générer une grille de créneaux', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const businessHours: BusinessHours = { start: '09:00', end: '18:00' };
      const slots = generateTimeGrid(date, businessHours, 15);
      
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].getHours()).toBe(9);
      expect(slots[0].getMinutes()).toBe(0);
    });
  });

  describe('isSameDay', () => {
    it('devrait retourner true pour le même jour', () => {
      const a = new Date('2024-01-01T10:00:00Z');
      const b = new Date('2024-01-01T15:00:00Z');
      expect(isSameDay(a, b)).toBe(true);
    });

    it('devrait retourner false pour des jours différents', () => {
      const a = new Date('2024-01-01T10:00:00Z');
      const b = new Date('2024-01-02T10:00:00Z');
      expect(isSameDay(a, b)).toBe(false);
    });
  });

  describe('addMinutes', () => {
    it('devrait ajouter des minutes à une date', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      const result = addMinutes(date, 30);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe('durationMinutes', () => {
    it('devrait calculer la durée en minutes', () => {
      const start = new Date('2024-01-01T10:00:00Z');
      const end = new Date('2024-01-01T10:30:00Z');
      expect(durationMinutes(start, end)).toBe(30);
    });
  });

  describe('clampToBusinessHours', () => {
    it('devrait clamp une date avant les heures d\'ouverture', () => {
      const date = new Date('2024-01-01T08:00:00Z');
      const businessHours: BusinessHours = { start: '09:00', end: '18:00' };
      const clamped = clampToBusinessHours(date, businessHours);
      expect(clamped.getHours()).toBe(9);
    });

    it('devrait clamp une date après les heures de fermeture', () => {
      const date = new Date('2024-01-01T19:00:00Z');
      const businessHours: BusinessHours = { start: '09:00', end: '18:00' };
      const clamped = clampToBusinessHours(date, businessHours);
      expect(clamped.getHours()).toBe(18);
    });
  });
});








