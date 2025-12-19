# 🔧 Fix: Affichage des coiffeurs à l'étape 2 de la réservation

## 📋 Cause racine identifiée

**En production, la requête publique Supabase retourne 0 lignes car la table `stylistes` n'a pas de policy RLS SELECT pour le rôle `anon` (utilisateurs anonymes).**

### Diagnostic détaillé

1. **RLS activé** : La table `stylistes` a RLS activé (`rowsecurity: true`)
2. **Policies existantes** :
   - ✅ "Salon owners can manage stylistes" - pour les propriétaires authentifiés
   - ✅ "Service role can manage stylistes" - pour le service_role
   - ✅ "Stylistes can view own data" - pour les stylistes eux-mêmes
   - ❌ **AUCUNE policy publique** pour le rôle `anon`
3. **API publique** : `/api/public/salon/stylistes` utilise `SUPABASE_ANON_KEY` (rôle `anon`)
4. **Résultat** : Supabase bloque la requête à cause de RLS → retourne `[]`

### Preuve

```sql
-- Vérification des policies existantes
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'stylistes';

-- Résultat: Aucune policy pour le rôle 'anon'
```

## ✅ Solution appliquée

### 1. Migration SQL : Policy RLS publique

**Fichier** : Migration Supabase `add_public_read_stylistes_policy`

**Code SQL** :
```sql
-- S'assurer que RLS est activé
ALTER TABLE public.stylistes ENABLE ROW LEVEL SECURITY;

-- Supprimer la policy si elle existe déjà (idempotent)
DROP POLICY IF EXISTS "Allow public to view active stylistes" ON public.stylistes;

-- Créer la policy publique pour permettre la lecture des stylistes actifs
-- Cette policy permet aux utilisateurs anonymes (anon) de lire uniquement :
-- - Les stylistes actifs (is_active = true)
-- - Qui appartiennent à un salon existant
CREATE POLICY "Allow public to view active stylistes"
ON public.stylistes
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 
    FROM public.salons 
    WHERE salons.id = stylistes.salon_id
  )
);
```

### 2. Sécurité maintenue

✅ **RLS reste activé** - Pas de désactivation globale  
✅ **Filtrage strict** - Seuls les stylistes actifs sont visibles  
✅ **Vérification salon** - Seuls les stylistes appartenant à un salon existant  
✅ **Policies d'écriture protégées** - INSERT/UPDATE/DELETE restent protégées par les policies existantes

## 📦 Fichiers modifiés

### Backend / Database
- ✅ **Migration Supabase** : `add_public_read_stylistes_policy` (appliquée)

### Frontend
- ✅ **Aucun changement nécessaire** - Le code frontend était déjà correct

## 🧪 Tests de validation

### Test 1 : Vérifier que l'API retourne les stylistes

```bash
# Tester l'API directement
curl https://witstyl.vercel.app/api/public/salon/stylistes

# Résultat attendu :
# [
#   {
#     "id": "stylist-1761567120719-0f2lq2164",
#     "firstName": "pierre",
#     "lastName": "veignat",
#     "isActive": true,
#     "specialties": ["Homme"]
#   },
#   {
#     "id": "stylist-1761504151845-kgglkv8h3",
#     "firstName": "Julie",
#     "lastName": "Moulin",
#     "isActive": true,
#     "specialties": ["Femme"]
#   }
# ]
```

### Test 2 : Vérifier l'affichage dans l'UI

1. **Ouvrir** : https://witstyl.vercel.app/book
2. **Étape 1** : Sélectionner un service
3. **Étape 2** : Vérifier que les coiffeurs s'affichent :
   - ✅ Pierre Veignat (Homme)
   - ✅ Julie Moulin (Femme)
   - ✅ Option "Sans préférences" disponible
4. **Vérifier** : Le bouton "Suivant" est activé après sélection

### Test 3 : Vérifier la sécurité RLS

```sql
-- Tester avec le rôle anon (simulation)
SET ROLE anon;
SELECT id, first_name, last_name, is_active 
FROM stylistes 
WHERE is_active = true;

-- Résultat attendu : Retourne uniquement les stylistes actifs
-- (Pierre et Julie, pas Nathan qui est inactif)
```

## ✅ Résultat attendu

Après le déploiement :

1. ✅ **L'API `/api/public/salon/stylistes` retourne les stylistes actifs**
2. ✅ **La page `/book` affiche les coiffeurs à l'étape 2**
3. ✅ **Le bouton "Suivant" est activé après sélection**
4. ✅ **La sécurité RLS est maintenue** (seuls les stylistes actifs sont visibles)

## 🔍 Logs de diagnostic

Si le problème persiste, vérifier les logs Vercel :

```
[PUBLIC] hit GET /api/public/salon/stylistes
[PUBLIC] Salon ID récupéré: salon-c152118c-478b-497b-98db-db37a4c58898
[PUBLIC] ✅ Stylistes trouvés avec salon_id: salon-c152118c-478b-497b-98db-db37a4c58898 → 2
[PUBLIC] Stylistes mappés retournés: 2
```

## 📝 Notes importantes

- **Migration appliquée** : La policy RLS a été créée via migration Supabase
- **Pas de redéploiement nécessaire** : La migration est appliquée directement sur la base de données
- **Sécurité maintenue** : Les stylistes inactifs restent invisibles pour les utilisateurs anonymes
- **Compatible avec l'existant** : Les policies d'écriture restent inchangées

