/**
 * Tests unitaires pour les templates SMS
 * 
 * Vérifie :
 * - Suppression des accents
 * - Limite à 160 caractères
 * - Templates courts même avec noms longs
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeSmsText,
  ensureSingleSegment,
  buildConfirmationSms,
  buildReminderSms,
  formatDateForSms,
  formatTimeForSms,
  formatWeekdayForSms,
  type AppointmentSmsContext,
} from '../smsTemplates.js';

describe('normalizeSmsText', () => {
  it('supprime les accents', () => {
    expect(normalizeSmsText('é')).toBe('e');
    expect(normalizeSmsText('à')).toBe('a');
    expect(normalizeSmsText('ç')).toBe('c');
    expect(normalizeSmsText('ù')).toBe('u');
    expect(normalizeSmsText('ô')).toBe('o');
    expect(normalizeSmsText('î')).toBe('i');
    expect(normalizeSmsText('ê')).toBe('e');
    expect(normalizeSmsText('â')).toBe('a');
  });

  it('supprime les diacritiques complexes', () => {
    expect(normalizeSmsText('François')).toBe('Francois');
    expect(normalizeSmsText('José')).toBe('Jose');
    expect(normalizeSmsText('À bientôt')).toBe('A bientot');
    expect(normalizeSmsText('Café')).toBe('Cafe');
  });

  it('remplace les caractères spéciaux', () => {
    expect(normalizeSmsText('œ')).toBe('oe');
    expect(normalizeSmsText('"guillemets"')).toBe('"guillemets"');
    expect(normalizeSmsText("'apostrophe'")).toBe("'apostrophe'");
    expect(normalizeSmsText('–')).toBe('-');
    expect(normalizeSmsText('…')).toBe('...');
  });

  it('nettoie les espaces multiples', () => {
    expect(normalizeSmsText('Bonjour   monde')).toBe('Bonjour monde');
    expect(normalizeSmsText('  Bonjour  monde  ')).toBe('Bonjour monde');
  });

  it('gère les chaînes vides', () => {
    expect(normalizeSmsText('')).toBe('');
    expect(normalizeSmsText('   ')).toBe('');
  });
});

describe('ensureSingleSegment', () => {
  it('retourne le texte tel quel si <= 160 caractères', () => {
    const short = 'Bonjour, ceci est un SMS court.';
    expect(ensureSingleSegment(short)).toBe(short);
    expect(ensureSingleSegment(short).length).toBeLessThanOrEqual(160);
  });

  it('tronque si > 160 caractères', () => {
    const long = 'A'.repeat(200);
    const result = ensureSingleSegment(long);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toMatch(/\.\.\.$/);
  });

  it('ne tronque pas si exactement 160 caractères', () => {
    const exact = 'A'.repeat(160);
    expect(ensureSingleSegment(exact).length).toBe(160);
  });

  it('supprime les accents avant de tronquer', () => {
    const withAccents = 'é'.repeat(200);
    const result = ensureSingleSegment(withAccents);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).not.toContain('é');
  });
});

describe('formatDateForSms', () => {
  it('formate correctement la date', () => {
    const date = new Date('2025-12-02T17:30:00');
    expect(formatDateForSms(date)).toBe('2 decembre 2025');
  });

  it('formate correctement une date en janvier', () => {
    const date = new Date('2025-01-05T10:00:00');
    expect(formatDateForSms(date)).toBe('5 janvier 2025');
  });
});

describe('formatWeekdayForSms', () => {
  it('formate correctement le jour de la semaine', () => {
    const date = new Date('2025-12-02T17:30:00'); // Mardi
    expect(formatWeekdayForSms(date)).toBe('mardi');
  });

  it('formate correctement tous les jours de la semaine', () => {
    const weekdays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    for (let i = 0; i < 7; i++) {
      const date = new Date('2025-12-01T00:00:00');
      date.setDate(date.getDate() + i);
      expect(formatWeekdayForSms(date)).toBe(weekdays[i]);
    }
  });
});

describe('formatTimeForSms', () => {
  it('formate correctement l\'heure', () => {
    const date = new Date('2025-12-02T17:30:00');
    expect(formatTimeForSms(date)).toBe('17:30');
  });

  it('pad les heures et minutes avec zéro', () => {
    const date = new Date('2025-12-02T09:05:00');
    expect(formatTimeForSms(date)).toBe('09:05');
  });
});

describe('buildConfirmationSms', () => {
  it('construit un SMS de confirmation avec style détaillé', () => {
    const ctx: AppointmentSmsContext = {
      clientFirstName: 'Colette',
      serviceName: 'Service Modifie',
      salonName: 'HairPlay',
      appointmentWeekday: 'mardi',
      appointmentDate: '2 decembre 2025',
      appointmentTime: '17:30',
    };

    const result = buildConfirmationSms(ctx);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toContain('Colette');
    expect(result).toContain('Service Modifie');
    expect(result).toContain('HairPlay');
    expect(result).toContain('mardi');
    expect(result).toContain('2 decembre 2025');
    expect(result).toContain('17:30');
    expect(result).not.toContain('é');
    expect(result).not.toContain('à');
    expect(result).toContain('confirme');
    expect(result).toContain('hate');
  });

  it('tient dans 160 caractères même avec prénom long', () => {
    const ctx: AppointmentSmsContext = {
      clientFirstName: 'Alexandrine-Marguerite-Victoire',
      serviceName: 'Coupe',
      salonName: 'SalonPilot',
      appointmentWeekday: 'mardi',
      appointmentDate: '2 decembre 2025',
      appointmentTime: '17:30',
    };

    const result = buildConfirmationSms(ctx);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('tient dans 160 caractères même avec nom de salon et service longs', () => {
    const ctx: AppointmentSmsContext = {
      clientFirstName: 'Pierre',
      serviceName: 'Coloration-Professionnelle-Excellence',
      salonName: 'Salon-de-Coiffure-Professionnel-Excellence-Premium',
      appointmentWeekday: 'mardi',
      appointmentDate: '2 decembre 2025',
      appointmentTime: '17:30',
    };

    const result = buildConfirmationSms(ctx);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('tient dans 160 caractères avec prénom, salon et service très longs', () => {
    const ctx: AppointmentSmsContext = {
      clientFirstName: 'Alexandrine-Marguerite-Victoire',
      serviceName: 'Coloration-Professionnelle-Excellence-Premium',
      salonName: 'Salon-de-Coiffure-Professionnel-Excellence-Premium',
      appointmentWeekday: 'mardi',
      appointmentDate: '2 decembre 2025',
      appointmentTime: '17:30',
    };

    const result = buildConfirmationSms(ctx);
    expect(result.length).toBeLessThanOrEqual(160);
  });
});

describe('buildReminderSms', () => {
  it('construit un SMS de rappel avec style détaillé', () => {
    const ctx: AppointmentSmsContext = {
      clientFirstName: 'Colette',
      serviceName: 'Service Modifie',
      salonName: 'HairPlay',
      appointmentWeekday: 'mardi',
      appointmentDate: '2 decembre 2025',
      appointmentTime: '17:30',
    };

    const result = buildReminderSms(ctx);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toContain('Rappel de RDV');
    expect(result).toContain('Colette');
    expect(result).toContain('Service Modifie');
    expect(result).toContain('HairPlay');
    expect(result).toContain('mardi');
    expect(result).toContain('2 decembre 2025');
    expect(result).toContain('17:30');
    expect(result).not.toContain('é');
    expect(result).not.toContain('à');
    expect(result).toContain('prevu');
    expect(result).toContain('venir');
  });

  it('tient dans 160 caractères même avec nom de salon et service longs', () => {
    const ctx: AppointmentSmsContext = {
      clientFirstName: 'Pierre',
      serviceName: 'Coloration-Professionnelle-Excellence',
      salonName: 'Salon-de-Coiffure-Professionnel-Excellence-Premium',
      appointmentWeekday: 'mardi',
      appointmentDate: '2 decembre 2025',
      appointmentTime: '17:30',
    };

    const result = buildReminderSms(ctx);
    expect(result.length).toBeLessThanOrEqual(160);
  });
});

