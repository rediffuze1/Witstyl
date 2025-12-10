# 🔧 Fix : Erreur de login en production

## 🐛 Problème identifié

Sur `witstyl.vercel.app/salon-login`, lors de la connexion, l'erreur suivante apparaissait :
```
"Unexpected token 'T', 'The page c'... is not valid JSON"
```

**Cause :** Le front-end essayait de parser du HTML (page d'erreur 404) en JSON, car la réponse serveur n'était pas au format JSON.

## ✅ Corrections apportées

### 1. Sécurisation du parsing JSON côté front (`client/src/hooks/useAuth.ts`)

**Avant :** Le code parsait directement la réponse sans vérifier le content-type.

**Après :** 
- ✅ Vérification du `content-type` avant de parser le JSON
- ✅ Gestion d'erreur propre si la réponse n'est pas du JSON
- ✅ Logs détaillés pour le debug
- ✅ Gestion des erreurs 401/403 pour `/api/auth/user`

**Modifications :**
- `loginMutation` : Vérification du content-type avant `response.json()`
- `useQuery` pour `/api/auth/user` : Vérification du content-type et gestion gracieuse des erreurs
- `logoutMutation` : Vérification du content-type

### 2. Sécurisation du parsing JSON dans `AuthContext.tsx`

**Avant :** Pas de vérification du content-type.

**Après :**
- ✅ Vérification du `content-type` avant de parser le JSON
- ✅ Gestion d'erreur propre avec logs
- ✅ Retour `false` si la réponse n'est pas du JSON

### 3. Amélioration du handler API (`server/index.ts`)

**Modifications dans `/api/salon/login` :**
- ✅ `res.setHeader('Content-Type', 'application/json')` au début du handler
- ✅ Validation des données d'entrée (email et password requis)
- ✅ Utilisation de `return` pour s'assurer qu'on renvoie toujours du JSON
- ✅ Format de réponse cohérent : `{ success: true/false, message: "..." }`

**Avant :**
```typescript
res.json({ ... });
// ou
res.status(401).json({ message: "..." });
```

**Après :**
```typescript
res.setHeader('Content-Type', 'application/json');
// ...
return res.json({ success: true, ... });
// ou
return res.status(401).json({ success: false, message: "..." });
```

### 4. Amélioration du middleware 404

**Ajout :**
- ✅ Log spécifique pour `/api/salon/login` si la route n'est pas trouvée
- ✅ Réponse JSON cohérente même pour les 404 API
- ✅ Informations de debug (environnement, Vercel)

## 📋 Fichiers modifiés

1. **`client/src/hooks/useAuth.ts`**
   - Sécurisation du parsing JSON dans `loginMutation`
   - Sécurisation du parsing JSON dans `useQuery` pour `/api/auth/user`
   - Sécurisation du parsing JSON dans `logoutMutation`

2. **`client/src/contexts/AuthContext.tsx`**
   - Sécurisation du parsing JSON dans `loginOwner`

3. **`server/index.ts`**
   - Amélioration du handler `/api/salon/login` (ligne 1534)
   - Amélioration du middleware 404 avec log spécifique pour `/api/salon/login`

## 🧪 Tests à effectuer

### En local :
1. ✅ Vérifier que le login fonctionne toujours
2. ✅ Vérifier que les erreurs sont bien gérées (mauvais email/mot de passe)
3. ✅ Vérifier que les logs apparaissent dans la console

### En production (après déploiement) :
1. ✅ Tester le login sur `witstyl.vercel.app/salon-login`
2. ✅ Vérifier que les erreurs sont maintenant propres (pas de "Unexpected token")
3. ✅ Vérifier les logs Vercel pour voir si la route est bien interceptée

## 🔍 Debug

Si le problème persiste en production :

1. **Vérifier les logs Vercel** :
   - Aller dans Vercel Dashboard > Deployments > [Dernier déploiement] > Functions
   - Chercher les logs pour `/api/salon/login`
   - Vérifier si la route est bien interceptée

2. **Vérifier le routing Vercel** :
   - Le fichier `vercel.json` route `/api/(.*)` vers `/api/index`
   - Le fichier `api/index.ts` exporte l'app Express
   - La route `/api/salon/login` est définie à la ligne 1534 de `server/index.ts`

3. **Vérifier les variables d'environnement** :
   - S'assurer que toutes les variables nécessaires sont configurées dans Vercel
   - Vérifier que `NODE_ENV=production` est défini

## 📝 Notes

- ✅ Toutes les réponses API renvoient maintenant du JSON avec le header `Content-Type: application/json`
- ✅ Le front-end vérifie maintenant le content-type avant de parser le JSON
- ✅ Les erreurs sont maintenant propres et informatives
- ✅ Le middleware 404 renvoie du JSON même pour les routes non trouvées

## 🚀 Déploiement

Après ces modifications, commit et push :

```bash
git add .
git commit -m "Fix: Sécurisation du parsing JSON pour le login en production"
git push origin main
```

Vercel déploiera automatiquement (si configuré selon `GITHUB_VERCEL_SYNC.md`).

