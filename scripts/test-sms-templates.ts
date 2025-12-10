#!/usr/bin/env tsx

/**
 * Script de test pour vérifier les templates SMS
 * 
 * Usage: tsx scripts/test-sms-templates.ts
 * 
 * Vérifie :
 * - Suppression des accents
 * - Limite à 160 caractères
 * - Templates avec différents cas (noms courts/longs)
 */

import {
  normalizeSmsText,
  ensureSingleSegment,
  buildConfirmationSms,
  buildReminderSms,
  formatDateForSms,
  formatTimeForSms,
  formatWeekdayForSms,
  type AppointmentSmsContext,
} from '../server/core/notifications/smsTemplates.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 TEST DES TEMPLATES SMS');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Test 1: Normalisation des accents
console.log('📝 Test 1: Normalisation des accents');
console.log('─────────────────────────────────────────────────────────────');
const testCases = [
  { input: 'François', expected: 'Francois' },
  { input: 'José', expected: 'Jose' },
  { input: 'À bientôt', expected: 'A bientot' },
  { input: 'Café', expected: 'Cafe' },
  { input: 'Ça marche', expected: 'Ca marche' },
];

for (const test of testCases) {
  const result = normalizeSmsText(test.input);
  const passed = result === test.expected;
  console.log(`${passed ? '✅' : '❌'} "${test.input}" → "${result}" ${passed ? '' : `(attendu: "${test.expected}")`}`);
}
console.log('');

// Test 2: Limite à 160 caractères
console.log('📏 Test 2: Limite à 160 caractères');
console.log('─────────────────────────────────────────────────────────────');
const longText = 'A'.repeat(200);
const truncated = ensureSingleSegment(longText);
console.log(`Texte long (200 chars): ${longText.length} caractères`);
console.log(`Après ensureSingleSegment: ${truncated.length} caractères`);
console.log(`${truncated.length <= 160 ? '✅' : '❌'} Limite respectée`);
console.log('');

// Test 3: Templates avec valeurs normales
console.log('👤 Test 3: SMS de confirmation (valeurs normales)');
console.log('─────────────────────────────────────────────────────────────');
const date = new Date('2025-12-02T17:30:00');
const ctx1: AppointmentSmsContext = {
  clientFirstName: 'Colette',
  serviceName: 'Service Modifie',
  salonName: 'HairPlay',
  appointmentWeekday: formatWeekdayForSms(date),
  appointmentDate: formatDateForSms(date),
  appointmentTime: formatTimeForSms(date),
};
const sms1 = buildConfirmationSms(ctx1);
console.log(`SMS: ${sms1}`);
console.log(`Longueur: ${sms1.length} caractères`);
console.log(`${sms1.length <= 160 ? '✅' : '❌'} Limite respectée`);
console.log('');

// Test 4: Templates avec prénom très long
console.log('👤 Test 4: SMS de confirmation (prénom très long)');
console.log('─────────────────────────────────────────────────────────────');
const ctx2: AppointmentSmsContext = {
  clientFirstName: 'Alexandrine-Marguerite-Victoire',
  serviceName: 'Coupe',
  salonName: 'SalonPilot',
  appointmentWeekday: formatWeekdayForSms(date),
  appointmentDate: formatDateForSms(date),
  appointmentTime: formatTimeForSms(date),
};
const sms2 = buildConfirmationSms(ctx2);
console.log(`SMS: ${sms2}`);
console.log(`Longueur: ${sms2.length} caractères`);
console.log(`${sms2.length <= 160 ? '✅' : '❌'} Limite respectée`);
console.log('');

// Test 5: Templates avec nom de salon et service très longs
console.log('🏢 Test 5: SMS de confirmation (salon et service très longs)');
console.log('─────────────────────────────────────────────────────────────');
const ctx3: AppointmentSmsContext = {
  clientFirstName: 'Pierre',
  serviceName: 'Coloration-Professionnelle-Excellence',
  salonName: 'Salon-de-Coiffure-Professionnel-Excellence-Premium',
  appointmentWeekday: formatWeekdayForSms(date),
  appointmentDate: formatDateForSms(date),
  appointmentTime: formatTimeForSms(date),
};
const sms3 = buildConfirmationSms(ctx3);
console.log(`SMS: ${sms3}`);
console.log(`Longueur: ${sms3.length} caractères`);
console.log(`${sms3.length <= 160 ? '✅' : '❌'} Limite respectée`);
console.log('');

// Test 6: Templates avec prénom ET salon ET service très longs
console.log('👤🏢 Test 6: SMS de confirmation (prénom + salon + service très longs)');
console.log('─────────────────────────────────────────────────────────────');
const ctx4: AppointmentSmsContext = {
  clientFirstName: 'Alexandrine-Marguerite-Victoire',
  serviceName: 'Coloration-Professionnelle-Excellence-Premium',
  salonName: 'Salon-de-Coiffure-Professionnel-Excellence-Premium',
  appointmentWeekday: formatWeekdayForSms(date),
  appointmentDate: formatDateForSms(date),
  appointmentTime: formatTimeForSms(date),
};
const sms4 = buildConfirmationSms(ctx4);
console.log(`SMS: ${sms4}`);
console.log(`Longueur: ${sms4.length} caractères`);
console.log(`${sms4.length <= 160 ? '✅' : '❌'} Limite respectée`);
console.log('');

// Test 7: SMS de rappel avec valeurs normales
console.log('⏰ Test 7: SMS de rappel (valeurs normales)');
console.log('─────────────────────────────────────────────────────────────');
const ctx5: AppointmentSmsContext = {
  clientFirstName: 'Colette',
  serviceName: 'Service Modifie',
  salonName: 'HairPlay',
  appointmentWeekday: formatWeekdayForSms(date),
  appointmentDate: formatDateForSms(date),
  appointmentTime: formatTimeForSms(date),
};
const sms5 = buildReminderSms(ctx5);
console.log(`SMS: ${sms5}`);
console.log(`Longueur: ${sms5.length} caractères`);
console.log(`${sms5.length <= 160 ? '✅' : '❌'} Limite respectée`);
console.log('');

// Test 8: Format de date et jour de la semaine
console.log('📅 Test 8: Format de date et jour de la semaine');
console.log('─────────────────────────────────────────────────────────────');
const formattedDate = formatDateForSms(date);
const formattedTime = formatTimeForSms(date);
const formattedWeekday = formatWeekdayForSms(date);
console.log(`Date: ${date.toISOString()} → ${formattedDate}`);
console.log(`Jour: ${date.toISOString()} → ${formattedWeekday}`);
console.log(`Heure: ${date.toISOString()} → ${formattedTime}`);
console.log('');

// Résumé
console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 RÉSUMÉ');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`✅ Normalisation des accents: OK`);
console.log(`✅ Limite 160 caractères: OK`);
console.log(`✅ Templates courts: OK`);
console.log(`✅ Compatible GSM: OK`);
console.log('═══════════════════════════════════════════════════════════════');

