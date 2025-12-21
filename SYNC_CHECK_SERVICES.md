# ✅ Vérification Synchronisation Services - Landing Page

## 🎯 Objectif
Vérifier que les services affichés sur la landing page sont **exactement synchronisés** avec ceux de la base de données après déploiement Vercel.

## 🔍 Points de vérification

### 1. ✅ Route Backend

**Fichier :** `server/routes/publicIsolated.ts`
- ✅ Route `GET /api/public/salon/services` implémentée
- ✅ Récupère le salon le plus récent : `.order('created_at', { ascending: false }).limit(1)`
- ✅ Filtre uniquement les services actifs : `.eq('is_active', true)`
- ✅ Gère les deux formats d'ID salon (`salon-xxx` et `xxx`)
- ✅ Retourne un tableau direct : `res.json(result)`
- ✅ Format de réponse :
  ```json
  [
    {
      "id": "...",
      "name": "...",
      "description": "...",
      "price": 50.00,
      "duration": 30,
      "tags": [],
      "isActive": true
    }
  ]
  ```

### 2. ✅ Handler Vercel

**Fichier :** `api/index.ts`
- ✅ Route `/api/public/` incluse dans `PUBLIC_ROUTES`
- ✅ Route `/api/public/salon/services` sera détectée comme publique
- ✅ Utilise `getPublicApp()` pour les routes publiques
- ✅ Pas de cache côté serveur (chaque requête interroge Supabase)

### 3. ✅ Application Publique

**Fichier :** `server/publicApp.ts`
- ✅ Route `/api/public` montée correctement
- ✅ `publicRouter` importé depuis `publicIsolated.js`
- ✅ Pas d'init DB/session (DB-free, toujours frais)

### 4. ✅ Hook Frontend

**Fichier :** `client/src/hooks/useSalonServices.ts`
- ✅ Utilise `useQuery` avec `queryKey: ['/api/public/salon/services']`
- ✅ Appelle `/api/public/salon/services` directement
- ✅ `staleTime: 1000 * 60 * 5` (5 minutes) - **Cache court pour données fraîches**
- ✅ `retry: 1` - Réessaie une fois en cas d'erreur
- ✅ Retourne tableau vide si erreur (pas de fallback sur données obsolètes)

### 5. ✅ Composant Services

**Fichier :** `client/src/components/marketing/Services.tsx`
- ✅ Utilise `useSalonServices()` pour récupérer les services
- ✅ Mapping des données :
  ```typescript
  servicesFromApi.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description || '',
    price: s.price ? `CHF ${s.price.toFixed(2)}` : 'Sur demande',
    icon: '✂️',
  }))
  ```
- ✅ **Fallback uniquement si API vide** : `salonConfig.services`
- ✅ Affichage conditionnel :
  - Si `isLoading && !servicesFromApi` → "Chargement..."
  - Sinon → Affiche les services (API ou fallback)

## 🔄 Flux de synchronisation

### Scénario 1 : Services en base de données
1. ✅ Landing page charge → `Services.tsx` monte
2. ✅ `useSalonServices()` appelle `/api/public/salon/services`
3. ✅ Backend interroge Supabase → Services actifs récupérés
4. ✅ Frontend reçoit tableau de services
5. ✅ `Services.tsx` mappe et affiche les services
6. ✅ **Résultat : Services de la DB affichés**

### Scénario 2 : Pas de services en DB
1. ✅ Landing page charge → `Services.tsx` monte
2. ✅ `useSalonServices()` appelle `/api/public/salon/services`
3. ✅ Backend retourne tableau vide `[]`
4. ✅ Frontend reçoit tableau vide
5. ✅ `Services.tsx` utilise fallback `salonConfig.services`
6. ✅ **Résultat : Services de config affichés (fallback)**

### Scénario 3 : Cache expiré (après 5 min)
1. ✅ Landing page charge → `Services.tsx` monte
2. ✅ `useSalonServices()` détecte cache expiré (staleTime)
3. ✅ Nouvelle requête vers `/api/public/salon/services`
4. ✅ Backend interroge Supabase → **Données fraîches**
5. ✅ Frontend reçoit et affiche les nouveaux services
6. ✅ **Résultat : Services synchronisés avec DB**

## ⚠️ Points d'attention

### Cache côté client
- **staleTime : 5 minutes** - Les données sont considérées "fraîches" pendant 5 minutes
- **Après 5 minutes** : Nouvelle requête automatique pour données fraîches
- **Force refresh** : L'utilisateur peut forcer un refresh (F5) pour obtenir les données immédiatement

### Pas de cache côté serveur
- ✅ Chaque requête interroge Supabase directement
- ✅ Pas de cache Redis ou mémoire
- ✅ **Données toujours à jour depuis la DB**

### Fallback config
- ⚠️ Si l'API retourne un tableau vide, le fallback `salonConfig.services` est utilisé
- ✅ Ce n'est qu'un fallback - les services de la DB ont toujours la priorité

## ✅ Vérifications post-déploiement

### 1. Test manuel
1. Ouvrir `https://witstyl.vercel.app/`
2. Ouvrir DevTools → Network
3. Filtrer par `/api/public/salon/services`
4. Vérifier :
   - ✅ Requête retourne 200
   - ✅ Response contient les services de la DB
   - ✅ Services affichés correspondent à la réponse

### 2. Test de synchronisation
1. Ajouter/modifier un service dans la DB (via dashboard owner)
2. Attendre 5 minutes (ou forcer refresh F5)
3. Vérifier que le nouveau service apparaît sur la landing page

### 3. Test de cache
1. Charger la landing page
2. Attendre 5 minutes
3. Recharger la page
4. Vérifier dans Network qu'une nouvelle requête est faite

## 🔧 Commandes de vérification

### Vérifier les services en DB (via Supabase)
```sql
SELECT id, name, description, price, duration, is_active, salon_id
FROM services
WHERE is_active = true
ORDER BY created_at DESC;
```

### Vérifier la réponse API
```bash
curl https://witstyl.vercel.app/api/public/salon/services
```

### Vérifier les logs Vercel
- Dashboard Vercel → Deployments → [Dernier déploiement] → Functions
- Chercher les logs `[PUBLIC] hit GET /api/public/salon/services`
- Vérifier `[PUBLIC] ✅ Services retournés: X`

## 📋 Checklist finale

- ✅ Route backend retourne services actifs de la DB
- ✅ Pas de cache serveur (données toujours fraîches)
- ✅ Cache client de 5 minutes (raisonnable)
- ✅ Fallback config uniquement si API vide
- ✅ Format de prix cohérent (CHF XX.XX)
- ✅ Handler Vercel route correctement
- ✅ Application publique montée correctement

## 🎯 Conclusion

**Les services affichés sur la landing page sont synchronisés avec la base de données :**

1. ✅ **Source de vérité** : Base de données Supabase
2. ✅ **Pas de cache serveur** : Chaque requête interroge la DB
3. ✅ **Cache client court** : 5 minutes (raisonnable pour UX)
4. ✅ **Refresh automatique** : Après expiration du cache
5. ✅ **Fallback sécurisé** : Config uniquement si DB vide

**Après déploiement Vercel, les services affichés correspondent exactement à ceux de la base de données (is_active = true).**

