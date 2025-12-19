# 📝 Guide : Configuration des Avis Google

## 🎯 Objectif

Connecter votre site à Google My Business pour afficher automatiquement les avis Google de votre salon sur la landing page.

## 📋 Prérequis

1. **Un compte Google My Business** avec votre salon enregistré
2. **Un compte Google Cloud** (gratuit)
3. **Une clé API Google Places** (gratuite jusqu'à un certain quota)

## 🔧 Étapes de configuration

### Étape 1 : Obtenir le Place ID de votre salon

1. Allez sur [Google My Business](https://www.google.com/business/)
2. Sélectionnez votre établissement
3. Ouvrez les informations de votre établissement
4. Le **Place ID** se trouve dans l'URL ou dans les paramètres avancés

**Alternative :** Utilisez [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id) :
- Entrez l'adresse de votre salon
- Copiez le Place ID (ex: `ChIJN1t_tDeuEmsRUsoyG83frY4`)

### Étape 2 : Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet (ou utilisez un existant)
3. Notez le nom du projet

### Étape 3 : Activer l'API Places (New)

1. Dans Google Cloud Console, allez dans **APIs & Services** > **Library**
2. Recherchez **"Places API (New)"**
3. Cliquez sur **Enable** pour activer l'API

### Étape 4 : Créer une clé API

1. Dans Google Cloud Console, allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **API Key**
3. Copiez la clé API générée
4. (Optionnel) Restreignez la clé API :
   - Cliquez sur la clé pour l'éditer
   - Dans **API restrictions**, sélectionnez **Restrict key**
   - Choisissez **Places API (New)**
   - Sauvegardez

### Étape 5 : Configurer les variables d'environnement sur Vercel

1. Allez sur votre projet Vercel
2. Ouvrez **Settings** > **Environment Variables**
3. Ajoutez les variables suivantes :

```
GOOGLE_PLACES_API_KEY = votre_clé_api_google
GOOGLE_PLACE_ID = votre_place_id_google
```

**Exemple :**
```
GOOGLE_PLACES_API_KEY = AIzaSyB1234567890abcdefghijklmnopqrstuvwxyz
GOOGLE_PLACE_ID = ChIJN1t_tDeuEmsRUsoyG83frY4
```

4. Cliquez sur **Save**
5. **Redéployez** votre application (Vercel redéploiera automatiquement)

### Étape 6 : (Optionnel) Stocker le Place ID dans la base de données

Au lieu d'utiliser une variable d'environnement, vous pouvez stocker le Place ID dans la table `salons` :

1. Ajoutez une colonne `google_place_id` à la table `salons` :
```sql
ALTER TABLE salons ADD COLUMN google_place_id TEXT;
```

2. Mettez à jour votre salon avec le Place ID :
```sql
UPDATE salons SET google_place_id = 'ChIJN1t_tDeuEmsRUsoyG83frY4' WHERE id = 'votre_salon_id';
```

## ✅ Vérification

1. Attendez 2-5 minutes après le déploiement Vercel
2. Visitez votre site : `https://witstyl.vercel.app`
3. Allez à la section "Ce que disent nos clients"
4. Les avis Google devraient s'afficher automatiquement

## 🔍 Dépannage

### Aucun avis ne s'affiche

1. **Vérifiez les logs Vercel** :
   - Allez dans **Deployments** > **Functions** > **View Function Logs**
   - Cherchez les logs `[google-reviews]`

2. **Vérifiez la configuration** :
   - La clé API est-elle correcte ?
   - Le Place ID est-il correct ?
   - L'API Places (New) est-elle activée ?

3. **Vérifiez les quotas Google** :
   - Allez dans Google Cloud Console > **APIs & Services** > **Dashboard**
   - Vérifiez que vous n'avez pas dépassé le quota gratuit

### Erreur 403 (Forbidden)

- Vérifiez que l'API Places (New) est bien activée
- Vérifiez que la clé API n'est pas restreinte de manière trop stricte
- Vérifiez que la clé API a les bonnes permissions

### Erreur 404 (Not Found)

- Vérifiez que le Place ID est correct
- Vérifiez que le lieu existe bien sur Google My Business
- Vérifiez que le lieu a des avis publics

## 📊 Quotas Google Places API

- **Gratuit** : 1 000 requêtes/jour
- **Payant** : À partir de $0.017 par requête après le quota gratuit

Pour un site avec peu de trafic, le quota gratuit est largement suffisant.

## 🔐 Sécurité

- **Ne jamais** exposer la clé API côté client
- La clé API est utilisée uniquement côté serveur
- Restreignez la clé API dans Google Cloud Console si possible

## 📚 Documentation

- [Google Places API (New) Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Google Cloud Console](https://console.cloud.google.com/)

## 🎉 Résultat attendu

Une fois configuré, la section "Ce que disent nos clients" affichera automatiquement :
- Les 5 meilleurs avis Google (triés par note puis date)
- La note moyenne du salon
- Le nombre total d'avis
- Les avis se mettent à jour automatiquement toutes les 30 minutes (cache)

