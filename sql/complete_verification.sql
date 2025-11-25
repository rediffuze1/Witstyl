-- Script de vérification complète : Vérifier que tout est bien configuré
-- Exécutez ce script pour vérifier que la colonne, RLS et la policy sont en place

-- 1. Vérifier que la colonne theme_color existe
SELECT 
  '✅ Colonne theme_color' as verification,
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'salons' 
  AND column_name = 'theme_color';

-- 2. Vérifier que RLS est activé
SELECT 
  '✅ RLS activé' as verification,
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'salons';

-- 3. Vérifier que la policy existe (déjà vérifié, mais on le remet pour confirmation)
SELECT 
  '✅ Policy RLS' as verification,
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'salons' 
  AND policyname = 'public_read_salon_appearance';

-- 4. Vérifier les valeurs actuelles de theme_color dans vos salons
SELECT 
  '📊 Valeurs actuelles' as verification,
  id, 
  name, 
  theme_color,
  CASE 
    WHEN theme_color IS NULL THEN '⚠️ Aucune couleur définie (normal si pas encore configuré)'
    ELSE '✅ Couleur définie: ' || theme_color
  END as status
FROM salons 
ORDER BY created_at DESC
LIMIT 10;



