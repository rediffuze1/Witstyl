# Guide : ENABLE_CRON_JOBS

## 🎯 À Quoi Sert `ENABLE_CRON_JOBS=true` ?

Cette variable d'environnement **active ou désactive les tâches automatiques** (cron jobs) qui gèrent les notifications intelligentes.

---

## 📋 Que Font les Cron Jobs ?

Quand `ENABLE_CRON_JOBS=true`, deux tâches automatiques tournent en arrière-plan :

### 1. **Vérification des Emails Non Ouverts** (toutes les heures)

**Fichier** : `server/cron/check-email-opened-and-send-sms.ts`

**Rôle** :
- Vérifie les emails envoyés il y a **3-6 heures**
- Si l'email n'a **pas été ouvert** → envoie un SMS de confirmation
- Uniquement pour les RDV pris **≥ 24h à l'avance**

**Exemple** :
```
RDV créé à 10h00 pour demain 14h00
→ Email envoyé à 10h00
→ À 13h00 (3h après), le cron vérifie si l'email a été ouvert
→ Si non ouvert → SMS de confirmation envoyé
```

### 2. **Envoi des SMS de Rappel** (toutes les heures)

**Fichier** : `server/cron/send-reminder-sms.ts`

**Rôle** :
- Vérifie les RDV qui sont **exactement dans 24h** (± 15min)
- Envoie un SMS de rappel si les conditions sont remplies
- Uniquement si `skip_reminder_sms = false` (RDV pris ≥ 24h avant)

**Exemple** :
```
RDV prévu demain à 15h00
→ Aujourd'hui à 15h00, le cron détecte que le RDV est dans 24h
→ SMS de rappel envoyé automatiquement
```

---

## ⚙️ Configuration

### Activer les Cron Jobs

Dans votre fichier `.env` :

```bash
ENABLE_CRON_JOBS=true
```

### Désactiver les Cron Jobs

```bash
ENABLE_CRON_JOBS=false
# ou simplement ne pas définir la variable
```

---

## 🔄 Quand Utiliser `ENABLE_CRON_JOBS=true` ?

### ✅ **À Activer Si** :

1. **Vous hébergez sur un serveur Node.js classique**
   - VPS, serveur dédié, Docker, etc.
   - Le serveur tourne 24/7

2. **Vous voulez que les notifications soient automatiques**
   - Pas besoin d'intervention manuelle
   - Les SMS de confirmation et rappels sont envoyés automatiquement

3. **Vous n'utilisez pas Vercel Cron ou un cron système**
   - Si vous utilisez Vercel Cron, vous pouvez désactiver cette option

### ❌ **À Désactiver Si** :

1. **Vous utilisez Vercel Cron**
   - Configurez les crons dans `vercel.json` à la place
   - Plus fiable et scalable sur Vercel

2. **Vous utilisez un cron système (crontab)**
   - Configurez les crons directement dans votre système
   - Plus de contrôle sur l'exécution

3. **Vous êtes en développement local**
   - Pas besoin de crons qui tournent en continu
   - Vous pouvez tester manuellement les notifications

---

## 🏗️ Alternatives aux Cron Jobs Node.js

### Option 1 : Vercel Cron (Recommandé pour Vercel)

Dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/check-email-opened",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/send-reminder",
      "schedule": "0 * * * *"
    }
  ]
}
```

Puis créez les routes API correspondantes.

### Option 2 : Cron Système (Linux/Mac)

Dans votre crontab (`crontab -e`) :

```bash
# Vérifier emails non ouverts (toutes les heures)
0 * * * * cd /path/to/Witstyl && npx tsx server/cron/check-email-opened-and-send-sms.ts

# Envoyer rappels SMS (toutes les heures)
0 * * * * cd /path/to/Witstyl && npx tsx server/cron/send-reminder-sms.ts
```

### Option 3 : Cron Jobs Node.js (Actuel)

Avec `ENABLE_CRON_JOBS=true`, les crons tournent directement dans votre processus Node.js.

**Avantages** :
- ✅ Simple à configurer
- ✅ Pas besoin de configuration externe
- ✅ Fonctionne sur n'importe quel hébergement Node.js

**Inconvénients** :
- ⚠️ Si le serveur redémarre, les crons redémarrent aussi
- ⚠️ Moins fiable que Vercel Cron pour les applications serverless

---

## 📊 Fréquence d'Exécution

Les crons sont configurés pour tourner **toutes les heures** à la minute 0 :

```typescript
cronDefault.schedule('0 * * * *', async () => {
  // Exécuté à : 00:00, 01:00, 02:00, 03:00, etc.
});
```

**Pourquoi toutes les heures ?**
- Les SMS de confirmation sont vérifiés après 3h (fenêtre 3-6h)
- Les SMS de rappel sont envoyés 24h avant (± 15min)
- Une exécution toutes les heures est suffisante pour ces besoins

---

## 🧪 Tester les Cron Jobs

### Test Manuel

Vous pouvez exécuter les crons manuellement :

```bash
# Test vérification emails non ouverts
npx tsx server/cron/check-email-opened-and-send-sms.ts

# Test envoi rappels SMS
npx tsx server/cron/send-reminder-sms.ts
```

### Vérifier que les Crons Tournent

Quand `ENABLE_CRON_JOBS=true`, vous devriez voir dans les logs au démarrage :

```
[SERVER] ✅ Cron job configuré: Vérification email ouvert + SMS (toutes les heures)
[SERVER] ✅ Cron job configuré: Envoi SMS de rappel (toutes les heures)
```

Et toutes les heures, vous verrez les logs d'exécution des crons.

---

## ⚠️ Points d'Attention

1. **Le serveur doit tourner 24/7**
   - Si le serveur redémarre, les crons redémarrent aussi
   - Si le serveur s'arrête, les crons s'arrêtent aussi

2. **Sur Vercel (serverless)**
   - Les crons Node.js ne fonctionnent pas bien
   - Utilisez Vercel Cron à la place

3. **Performance**
   - Les crons tournent dans le même processus que votre serveur
   - Si vous avez beaucoup de RDV, cela peut impacter les performances
   - Dans ce cas, utilisez un cron système ou Vercel Cron

---

## ✅ Résumé

| Situation | `ENABLE_CRON_JOBS` | Alternative |
|-----------|-------------------|-------------|
| Serveur Node.js 24/7 | ✅ `true` | Cron système |
| Vercel (serverless) | ❌ `false` | Vercel Cron |
| Développement local | ❌ `false` | Test manuel |
| Docker/VPS | ✅ `true` | Cron système |

---

## 🎯 Conclusion

`ENABLE_CRON_JOBS=true` active les **tâches automatiques** qui :
1. Vérifient les emails non ouverts après 3h → envoient SMS de confirmation
2. Envoient les SMS de rappel 24h avant les RDV

**C'est essentiel pour que votre système de notifications intelligentes fonctionne automatiquement !**

Sans cette option activée, vous devrez :
- Soit utiliser Vercel Cron
- Soit configurer un cron système
- Soit exécuter les scripts manuellement



