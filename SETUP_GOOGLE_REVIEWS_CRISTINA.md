# 🎯 Configuration Google Reviews pour Cristina Coiffure

## ✅ Place ID trouvé

**Place ID :** `ChlJgehpVzL_jUcR4Y1sWAlbZpM`  
**Adresse :** Cristina Coiffure, La Petite Côte 35, 2336 Les Bois, Suisse

## 📋 Étapes de configuration

### Étape 1 : Créer une clé API Google Places

1. **Allez sur [Google Cloud Console](https://console.cloud.google.com/)**
   - Connectez-vous avec votre compte Google

2. **Créez un projet (ou sélectionnez un existant)**
   - Cliquez sur le sélecteur de projet en haut
   - Cliquez sur "Nouveau projet"
   - Nommez-le "Witstyl Reviews" (ou autre)
   - Cliquez sur "Créer"

3. **Activez l'API Places (New)**
   - Dans le menu latéral, allez dans **APIs & Services** > **Library**
   - Recherchez **"Places API (New)"**
   - Cliquez dessus
   - Cliquez sur le bouton **"Enable"** (Activer)

4. **Créez une clé API**
   - Allez dans **APIs & Services** > **Credentials**
   - Cliquez sur **"+ CREATE CREDENTIALS"** en haut
   - Sélectionnez **"API Key"**
   - **Copiez la clé API** qui s'affiche (format : `AIzaSy...`)

   ⚠️ **Important :** Gardez cette clé secrète, ne la partagez jamais publiquement.

5. **(Optionnel) Restreignez la clé API pour plus de sécurité**
   - Cliquez sur la clé API que vous venez de créer
   - Dans **"API restrictions"**, sélectionnez **"Restrict key"**
   - Choisissez **"Places API (New)"**
   - Cliquez sur **"Save"**

### Étape 2 : Configurer sur Vercel

1. **Allez sur [Vercel Dashboard](https://vercel.com/dashboard)**
   - Connectez-vous à votre compte Vercel
   - Sélectionnez votre projet **Witstyl**

2. **Ouvrez les paramètres**
   - Cliquez sur **"Settings"** dans le menu du projet
   - Cliquez sur **"Environment Variables"** dans le menu latéral

3. **Ajoutez les variables d'environnement**

   Cliquez sur **"+ Add New"** et ajoutez :

   **Variable 1 :**
   - **Key :** `GOOGLE_PLACES_API_KEY`
   - **Value :** `votre_clé_api_google` (collez la clé API que vous avez copiée)
   - **Environments :** ✅ Production, ✅ Preview, ✅ Development

   **Variable 2 :**
   - **Key :** `GOOGLE_PLACE_ID`
   - **Value :** `ChlJgehpVzL_jUcR4Y1sWAlbZpM`
   - **Environments :** ✅ Production, ✅ Preview, ✅ Development

4. **Sauvegardez**
   - Cliquez sur **"Save"** pour chaque variable
   - Vercel redéploiera automatiquement votre application

### Étape 3 : Vérifier que ça fonctionne

1. **Attendez 2-5 minutes** après le déploiement Vercel

2. **Visitez votre site**
   - Allez sur `https://witstyl.vercel.app`
   - Scrollez jusqu'à la section **"Ce que disent nos clients"**

3. **Vérifiez les logs Vercel (si besoin)**
   - Allez dans **Deployments** > **Functions** > **View Function Logs**
   - Cherchez les logs `[google-reviews]`
   - Vous devriez voir : `✅ X avis récupérés, note moyenne: X.X`

## 🎉 Résultat attendu

Une fois configuré, vous verrez :
- ✅ Les 5 meilleurs avis Google de Cristina Coiffure
- ✅ La note moyenne du salon
- ✅ Le nombre total d'avis
- ✅ Les avis se mettent à jour automatiquement toutes les 30 minutes

## 🔍 Dépannage

### Aucun avis ne s'affiche

1. **Vérifiez que les variables sont bien configurées sur Vercel**
   - Allez dans Settings > Environment Variables
   - Vérifiez que `GOOGLE_PLACES_API_KEY` et `GOOGLE_PLACE_ID` sont présentes

2. **Vérifiez les logs Vercel**
   - Deployments > [Dernier déploiement] > Functions > View Function Logs
   - Cherchez les erreurs `[google-reviews]`

3. **Vérifiez que l'API est activée**
   - Google Cloud Console > APIs & Services > Dashboard
   - Vérifiez que "Places API (New)" est listée et activée

4. **Vérifiez que le lieu a des avis publics**
   - Allez sur Google Maps
   - Recherchez "Cristina Coiffure, Les Bois"
   - Vérifiez qu'il y a des avis visibles

### Erreur 403 (Forbidden)

- Vérifiez que l'API Places (New) est bien activée dans Google Cloud Console
- Vérifiez que la clé API n'est pas restreinte de manière trop stricte

### Erreur 404 (Not Found)

- Vérifiez que le Place ID est correct : `ChlJgehpVzL_jUcR4Y1sWAlbZpM`
- Vérifiez que le lieu existe bien sur Google My Business

## 💰 Coûts

- **Gratuit :** 1 000 requêtes/jour
- **Payant :** À partir de $0.017 par requête après le quota gratuit

Pour un site avec peu de trafic, le quota gratuit est largement suffisant.

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs Vercel
2. Vérifiez la configuration Google Cloud Console
3. Consultez `GUIDE_GOOGLE_REVIEWS_SETUP.md` pour plus de détails

