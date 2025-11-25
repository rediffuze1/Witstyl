/**
 * Générateur de HTML pour les emails de confirmation
 * 
 * Convertit un texte simple avec placeholders en HTML stylisé
 * Le manager n'a plus besoin d'éditer du HTML brut, uniquement du texte simple
 */

/**
 * Génère le HTML d'un email de confirmation à partir d'un texte simple
 * 
 * @param textContent - Texte simple avec placeholders (ex: "Bonjour {{client_first_name}}")
 * @returns HTML complet avec styles
 * 
 * @example
 * const text = "Bonjour {{client_first_name}}, votre rendez-vous est confirmé !";
 * const html = generateEmailHtmlFromText(text);
 * // Retourne un HTML complet avec styles
 */
export function generateEmailHtmlFromText(textContent: string): string {
  if (!textContent || !textContent.trim()) {
    // Retourner un template par défaut si vide
    return getDefaultEmailHtml();
  }

  // Séparer le texte en lignes
  const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) {
    return getDefaultEmailHtml();
  }

  // Séparer les paragraphes normaux des lignes d'information structurées
  const normalParagraphs: string[] = [];
  const infoRows: string[] = [];
  
  for (const line of lines) {
    // Détecter les lignes d'info structurées (format: "Label : {{placeholder}}")
    // Pattern: contient ":" et au moins un placeholder {{...}}
    if (line.includes(':') && line.match(/{{[^}]+}}/)) {
      infoRows.push(line);
    } else {
      normalParagraphs.push(line);
    }
  }

  // Générer le HTML des paragraphes normaux
  const normalContent = normalParagraphs
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('\n      ');

  // Générer le HTML de la info-box si on a des lignes d'info
  let infoBoxHtml = '';
  if (infoRows.length > 0) {
    const infoBoxContent = infoRows
      .map(row => {
        // Formater la ligne d'info (ex: "Salon : {{salon_name}}" → "<span class="label">Salon :</span> {{salon_name}}")
        const parts = row.split(':');
        if (parts.length >= 2) {
          const label = parts[0].trim();
          const value = parts.slice(1).join(':').trim();
          return `<div class="info-row"><span class="label">${escapeHtml(label)} :</span> ${escapeHtml(value)}</div>`;
        }
        return `<div class="info-row">${escapeHtml(row)}</div>`;
      })
      .join('\n        ');
    
    infoBoxHtml = `
      <div class="info-box">
        ${infoBoxContent}
      </div>`;
  }

  // Assembler le contenu final
  // Si on a des lignes d'info, les mettre dans une info-box entre les paragraphes
  let contentHtml = '';
  if (infoRows.length > 0) {
    // Trouver où insérer la info-box (après le premier paragraphe de salutation)
    const greetingIndex = normalParagraphs.findIndex(p => 
      p.toLowerCase().includes('bonjour') || p.toLowerCase().includes('salut')
    );
    
    const beforeInfoBox = normalParagraphs
      .slice(0, greetingIndex + 1)
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('\n      ');
    
    const afterInfoBox = normalParagraphs
      .slice(greetingIndex + 1)
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('\n      ');
    
    contentHtml = `${beforeInfoBox}${infoBoxHtml}
      ${afterInfoBox}`;
  } else {
    // Pas de lignes d'info, juste les paragraphes
    contentHtml = normalContent;
  }

  // Template HTML complet
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container { 
      max-width: 600px; 
      margin: 20px auto; 
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content { 
      background: #f9f9f9; 
      padding: 30px; 
    }
    .content p {
      margin: 15px 0;
      color: #333;
    }
    .info-box { 
      background: white; 
      padding: 20px; 
      margin: 20px 0; 
      border-radius: 8px; 
      border-left: 4px solid #667eea; 
    }
    .info-row { 
      margin: 10px 0; 
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-row .label { 
      font-weight: bold; 
      color: #667eea; 
      display: inline-block;
      min-width: 120px;
    }
    .footer { 
      text-align: center; 
      margin-top: 30px; 
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #666; 
      font-size: 12px; 
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .content {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Rendez-vous confirmé</h1>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement par {{salon_name}}</p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Échappe les caractères HTML pour éviter les injections
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Retourne le template HTML par défaut
 */
function getDefaultEmailHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #667eea; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Rendez-vous confirmé</h1>
    </div>
    <div class="content">
      <p>Bonjour {{client_full_name}},</p>
      <p>Votre rendez-vous a été confirmé avec succès !</p>
      <div class="info-box">
        <div class="info-row">
          <span class="label">Salon :</span> {{salon_name}}
        </div>
        <div class="info-row">
          <span class="label">Service :</span> {{service_name}}
        </div>
        <div class="info-row">
          <span class="label">Coiffeur·euse :</span> {{stylist_name}}
        </div>
        <div class="info-row">
          <span class="label">Date et heure :</span> {{appointment_date}} à {{appointment_time}}
        </div>
      </div>
      <p>Nous avons hâte de vous accueillir !</p>
      <p>Si vous avez des questions ou souhaitez modifier votre rendez-vous, n'hésitez pas à nous contacter.</p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement par {{salon_name}}</p>
    </div>
  </div>
</body>
</html>`;
}

