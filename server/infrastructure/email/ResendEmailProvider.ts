/**
 * Implémentation du provider Email utilisant Resend
 * 
 * Documentation Resend : https://resend.com/docs
 * 
 * Pour utiliser un autre provider (ex: Brevo, SendGrid) :
 * 1. Créer une nouvelle classe implémentant EmailProvider (ex: BrevoEmailProvider)
 * 2. Modifier uniquement server/core/notifications/index.ts pour utiliser le nouveau provider
 * 3. Aucune autre modification nécessaire
 */

import { EmailProvider } from '../../core/notifications/types.js';

// @ts-ignore - Resend peut avoir des problèmes de types avec moduleResolution
import { Resend } from 'resend';

export class ResendEmailProvider implements EmailProvider {
  private client: Resend | null;
  private from: string;
  private dryRun: boolean;

  constructor(apiKey: string, from: string, dryRun: boolean = false) {
    if (!apiKey && !dryRun) {
      throw new Error('RESEND_API_KEY is required when dryRun is false');
    }
    if (!from) {
      throw new Error('RESEND_FROM is required');
    }

    this.dryRun = dryRun;
    this.from = from;
    // Ne créer le client Resend que si on n'est pas en mode dry run
    this.client = dryRun ? null : new Resend(apiKey);
  }

  /**
   * Envoie un email via Resend
   * @param params - Paramètres d'envoi
   * @param params.to - Adresse email du destinataire
   * @param params.subject - Sujet de l'email
   * @param params.html - Contenu HTML de l'email
   * @param params.text - Contenu texte brut (optionnel, utilisé comme fallback)
   * @param params.from - Adresse email de l'expéditeur (optionnel, utilise this.from par défaut)
   * @returns Résultat de l'envoi avec success: true si réussi, false sinon avec un message d'erreur
   */
  async sendEmail({ to, subject, html, text, from, metadata }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; error?: string }> {
    const fromAddress = from || this.from;

    // Mode dry run : log le payload et retourner success sans appeler l'API
    if (this.dryRun) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[Resend] [DRY RUN] 📧 Email qui serait envoyé');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[Resend] [DRY RUN]   To:', to);
      console.log('[Resend] [DRY RUN]   From:', fromAddress);
      console.log('[Resend] [DRY RUN]   Subject:', subject);
      console.log('[Resend] [DRY RUN]   HTML complet:');
      console.log(html);
      if (text) {
        console.log('[Resend] [DRY RUN]   Text complet:');
        console.log(text);
      }
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      return { success: true };
    }

    if (!this.client) {
      return { success: false, error: 'RESEND_SEND_FAILED: Client Resend non initialisé' };
    }

    try {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[Resend] 📧 ENVOI RÉEL D\'EMAIL');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`[Resend] To: ${to}`);
      console.log(`[Resend] From: ${fromAddress}`);
      console.log(`[Resend] Subject: ${subject}`);
      console.log(`[Resend] HTML length: ${html.length} chars`);
      console.log(`[Resend] Text length: ${(text || this.htmlToText(html)).length} chars`);
      
      const payload: {
        from: string;
        to: string;
        subject: string;
        html: string;
        text: string;
        tags?: Array<{ name: string; value: string }>;
      } = {
        from: fromAddress,
        to,
        subject,
        html,
        text: text || this.htmlToText(html),
      };

      // Ajouter les metadata comme tags Resend (pour le webhook)
      if (metadata && Object.keys(metadata).length > 0) {
        payload.tags = Object.entries(metadata).map(([name, value]) => ({
          name,
          value: String(value),
        }));
      }
      
      console.log('[Resend] Payload complet:', JSON.stringify(payload, null, 2));
      console.log('[Resend] Appel à Resend API...');

      const result = await this.client.emails.send(payload);

      console.log('[Resend] Réponse brute de Resend:', JSON.stringify(result, null, 2));

      if (result.error) {
        const errorMessage = `RESEND_SEND_FAILED: ${JSON.stringify(result.error)}`;
        console.error('');
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('[Resend] ❌ ERREUR LORS DE L\'ENVOI');
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('[Resend] Erreur Resend:', JSON.stringify(result.error, null, 2));
        console.error('[Resend] Message d\'erreur:', errorMessage);
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('');
        return { success: false, error: errorMessage };
      }

      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[Resend] ✅ EMAIL ENVOYÉ AVEC SUCCÈS');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`[Resend] Email ID: ${result.data?.id || 'N/A'}`);
      console.log(`[Resend] Destinataire: ${to}`);
      console.log(`[Resend] Sujet: ${subject}`);
      console.log('[Resend] Données complètes:', JSON.stringify(result.data, null, 2));
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = `RESEND_SEND_FAILED: ${error.message || 'Erreur inconnue'}`;
      console.error('');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('[Resend] ❌ EXCEPTION LORS DE L\'ENVOI');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('[Resend] Type d\'erreur:', error.constructor.name);
      console.error('[Resend] Message:', error.message);
      console.error('[Resend] Stack:', error.stack);
      console.error('[Resend] Erreur complète:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('');
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Convertit du HTML en texte brut (fallback simple)
   * @param html - Contenu HTML
   * @returns Texte brut approximatif
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Supprimer les styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Supprimer les scripts
      .replace(/<[^>]+>/g, '') // Supprimer toutes les balises HTML
      .replace(/&nbsp;/g, ' ') // Remplacer &nbsp; par espace
      .replace(/&amp;/g, '&') // Remplacer &amp; par &
      .replace(/&lt;/g, '<') // Remplacer &lt; par <
      .replace(/&gt;/g, '>') // Remplacer &gt; par >
      .replace(/&quot;/g, '"') // Remplacer &quot; par "
      .replace(/&#39;/g, "'") // Remplacer &#39; par '
      .replace(/\n\s*\n/g, '\n\n') // Supprimer les lignes vides multiples
      .trim();
  }
}

