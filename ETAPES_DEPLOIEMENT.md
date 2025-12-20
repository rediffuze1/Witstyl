# 🚀 Étapes de déploiement et test - Fix Login Production

## 📋 Étape 1 : Vérifier les modifications

Avant de committer, vérifiez que tous les fichiers modifiés sont bien présents :

```bash
git status
```

Vous devriez voir :
- `client/src/hooks/useAuth.ts`
- `client/src/contexts/AuthContext.tsx`
- `server/index.ts`
- `FIX_LOGIN_PROD.md` (nouveau fichier)

---

## 📋 Étape 2 : Ajouter les fichiers modifiés

```bash
git add client/src/hooks/useAuth.ts
git add client/src/contexts/AuthContext.tsx
git add server/index.ts
git add FIX_LOGIN_PROD.md
```

Ou en une seule commande :
```bash
git add client/src/hooks/useAuth.ts client/src/contexts/AuthContext.tsx server/index.ts FIX_LOGIN_PROD.md
```

---

## 📋 Étape 3 : Créer le commit

```bash
git commit -m "Fix: Sécurisation du parsing JSON pour le login en production

- Ajout vérification content-type avant parsing JSON côté front
- Amélioration handler API /api/salon/login pour toujours renvoyer du JSON
- Ajout logs spécifiques pour debug en production
- Gestion d'erreurs propre avec messages informatifs"
```

---

## 📋 Étape 4 : Push vers GitHub

```bash
git push origin main
```

**Note :** Si vous êtes sur une autre branche, adaptez :
```bash
git push origin votre-branche
```

---

## 📋 Étape 5 : Attendre le déploiement Vercel

1. **Allez sur [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Sélectionnez votre projet** (Witstyl)
3. **Onglet "Deployments"**
4. **Attendez que le nouveau déploiement apparaisse** (généralement 10-30 secondes après le push)
5. **Vérifiez le statut** :
   - ✅ **Building** → Le build est en cours
   - ✅ **Ready** → Le déploiement est terminé et disponible
   - ❌ **Error** → Il y a une erreur (cliquez pour voir les logs)

**Temps estimé :** 2-5 minutes selon la taille du build

---

## 📋 Étape 6 : Vérifier que le déploiement est terminé

Dans Vercel Dashboard :
- Le statut doit être **"Ready"** (vert)
- L'URL de production doit être accessible : `https://witstyl.vercel.app`

**Test rapide :**
```bash
curl -I https://witstyl.vercel.app
```

Vous devriez recevoir une réponse `200 OK`.

---

## 📋 Étape 7 : Tester le login en production

### 7.1 Ouvrir la page de login

1. **Allez sur** : `https://witstyl.vercel.app/salon-login`
2. **Vérifiez que la page se charge** correctement
3. **Ouvrez la console du navigateur** (F12 > Console)

### 7.2 Tester avec de bonnes credentials

1. **Entrez un email et mot de passe valides**
2. **Cliquez sur "Se connecter"**
3. **Observez la console** :
   - ✅ **Pas d'erreur "Unexpected token"**
   - ✅ **Pas d'erreur de parsing JSON**
   - ✅ **Message de succès ou erreur propre**

### 7.3 Tester avec de mauvaises credentials

1. **Entrez un email ou mot de passe invalide**
2. **Cliquez sur "Se connecter"**
3. **Vérifiez** :
   - ✅ **Message d'erreur propre** (pas de "Unexpected token")
   - ✅ **Message en français** et informatif

---

## 📋 Étape 8 : Vérifier les logs Vercel (si nécessaire)

Si le problème persiste :

### 8.1 Accéder aux logs

1. **Vercel Dashboard** > Votre projet
2. **Deployments** > Cliquez sur le dernier déploiement
3. **Onglet "Functions"** ou **"Logs"**

### 8.2 Chercher les logs de login

Cherchez dans les logs :
- `🔍 Debug /api/salon/login`
- `[salon/login]`
- `[404 Middleware]` (si la route n'est pas trouvée)

### 8.3 Vérifier les erreurs

Si vous voyez :
- **`[404 Middleware] ❌❌❌ CRITIQUE: Requête POST /api/salon/login non interceptée!`**
  → La route n'est pas correctement chargée (problème de build ou routing)

- **Erreurs de base de données**
  → Vérifiez les variables d'environnement Supabase dans Vercel

- **Erreurs de session**
  → Vérifiez la configuration des sessions (cookies, secrets)

---

## 📋 Étape 9 : Tester les autres fonctionnalités

Une fois le login fonctionnel, testez :

1. **Navigation vers le dashboard** après login
2. **Déconnexion**
3. **Rafraîchissement de la page** (la session doit persister)

---

## 📋 Étape 10 : Documenter le résultat

Si tout fonctionne :

1. **Notez le résultat** dans `FIX_LOGIN_PROD.md` ou un autre fichier
2. **Si le problème persiste**, copiez les logs Vercel et les erreurs de la console

---

## 🆘 En cas de problème

### Le déploiement échoue

1. **Vérifiez les logs de build** dans Vercel
2. **Vérifiez les erreurs TypeScript** :
   ```bash
   npm run build
   ```
3. **Vérifiez les variables d'environnement** dans Vercel Dashboard

### Le login ne fonctionne toujours pas

1. **Vérifiez les logs Vercel** (Étape 8)
2. **Vérifiez la console du navigateur** (F12)
3. **Vérifiez le Network tab** :
   - La requête vers `/api/salon/login` est-elle bien envoyée ?
   - Quelle est la réponse (status, content-type, body) ?

### La route n'est pas trouvée (404)

1. **Vérifiez que `vercel.json` est correct** :
   ```json
   {
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "/api/index"
       }
     ]
   }
   ```

2. **Vérifiez que `api/index.ts` existe** et exporte bien l'app Express

3. **Vérifiez les logs Vercel** pour voir si la route est interceptée

---

## ✅ Checklist finale

- [ ] Modifications commitées et pushées
- [ ] Déploiement Vercel terminé avec succès
- [ ] Page `/salon-login` accessible
- [ ] Login fonctionne avec de bonnes credentials
- [ ] Erreurs propres avec de mauvaises credentials
- [ ] Pas d'erreur "Unexpected token" dans la console
- [ ] Navigation vers dashboard fonctionne
- [ ] Déconnexion fonctionne

---

## 📞 Support

Si vous avez besoin d'aide :
1. Consultez `FIX_LOGIN_PROD.md` pour les détails techniques
2. Vérifiez les logs Vercel
3. Vérifiez la console du navigateur
4. Documentez les erreurs rencontrées



