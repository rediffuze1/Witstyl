# 🔧 Correction : Landing Page ne charge pas en entier

## 🐛 Problème identifié

La landing page ne se chargeait pas complètement car les composants `Contact` et `Hours` utilisaient `useQuery` sans gestion d'erreur appropriée. Si l'API `/api/public/salon` échouait ou retournait une erreur, React Query pouvait suspendre le rendu de la page entière.

## ✅ Solution implémentée

### 1. Composant `Contact.tsx`

**Modifications :**
- ✅ Ajout de `throwOnError: false` pour ne pas suspendre le rendu en cas d'erreur
- ✅ Réduction des retries à 1 pour éviter les blocages prolongés
- ✅ Gestion d'erreur dans le rendu avec affichage d'un message de fallback
- ✅ Retour d'un objet vide au lieu de throw une erreur dans la `queryFn`

**Code :**
```typescript
const { data: salonData, isLoading, error } = useQuery({
  queryKey: ['/api/public/salon'],
  queryFn: async () => {
    const response = await fetch('/api/public/salon');
    if (!response.ok) {
      // Ne pas throw, retourner un objet vide pour permettre le rendu
      console.warn('[Contact] Impossible de charger les informations du salon:', response.status);
      return { salon: null, hours: [] };
    }
    return response.json();
  },
  retry: 1, // Réduire les retries pour éviter les blocages
  staleTime: 5 * 60 * 1000,
  throwOnError: false, // Ne pas suspendre le rendu en cas d'erreur
});
```

### 2. Composant `Hours.tsx`

**Modifications identiques :**
- ✅ Ajout de `throwOnError: false`
- ✅ Réduction des retries à 1
- ✅ Gestion d'erreur dans le rendu
- ✅ Retour d'un objet vide au lieu de throw

**Code :**
```typescript
const { data: salonData, isLoading, error } = useQuery({
  queryKey: ['/api/public/salon'],
  queryFn: async () => {
    const response = await fetch('/api/public/salon');
    if (!response.ok) {
      console.warn('[Hours] Impossible de charger les horaires:', response.status);
      return { salon: null, hours: [] };
    }
    return response.json();
  },
  retry: 1,
  staleTime: 5 * 60 * 1000,
  throwOnError: false,
});
```

## 📋 Résultat

### Avant
- ❌ La page pouvait rester bloquée si l'API échouait
- ❌ Pas de message d'erreur visible
- ❌ Retries multiples qui bloquaient le rendu

### Après
- ✅ La page se charge toujours, même si l'API échoue
- ✅ Message d'erreur clair affiché si les données ne peuvent pas être chargées
- ✅ Retries limités pour éviter les blocages
- ✅ Fallback gracieux avec valeurs par défaut

## 🧪 Test

Pour tester la correction :

1. **Avec API fonctionnelle :**
   ```bash
   npm run dev
   # Ouvrir http://localhost:5001/
   # La page devrait se charger complètement avec les données du salon
   ```

2. **Sans API (simulation d'erreur) :**
   - Désactiver temporairement Supabase dans `.env`
   - Redémarrer le serveur
   - La page devrait toujours se charger, avec des messages indiquant que les données ne sont pas disponibles

## 📝 Fichiers modifiés

1. `client/src/components/landing/Contact.tsx`
   - Ajout de gestion d'erreur
   - Ajout de `throwOnError: false`
   - Réduction des retries

2. `client/src/components/landing/Hours.tsx`
   - Ajout de gestion d'erreur
   - Ajout de `throwOnError: false`
   - Réduction des retries

## ✅ Critères d'acceptation

- ✅ La landing page se charge complètement même si l'API échoue
- ✅ Les sections Contact et Hours affichent un message si les données ne sont pas disponibles
- ✅ Pas de blocage du rendu de la page
- ✅ Les autres sections de la landing page continuent de fonctionner normalement

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. Ouvrir la console du navigateur (F12)
2. Vérifier qu'il n'y a pas d'erreurs bloquantes
3. Vérifier que tous les composants de la landing page sont rendus
4. Vérifier que les sections Contact et Hours affichent soit les données, soit un message de fallback

## 📚 Notes techniques

- `throwOnError: false` empêche React Query de suspendre le rendu en cas d'erreur
- Les retries limités à 1 évitent les blocages prolongés
- Le retour d'un objet vide dans la `queryFn` permet au composant de continuer à fonctionner même en cas d'erreur
- La gestion d'erreur dans le rendu permet d'afficher un message clair à l'utilisateur








