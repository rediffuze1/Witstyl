-- Script de vérification : Vérifier que theme_color est bien configuré
-- Exécutez ce script pour vérifier que tout est en place

-- 1. Vérifier que la colonne theme_color existe
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'salons' 
  AND column_name = 'theme_color';

-- 2. Vérifier que RLS est activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'salons';

-- 3. Vérifier que la policy existe
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies 
WHERE tablename = 'salons' 
  AND policyname = 'public_read_salon_appearance';

-- 4. Vérifier les valeurs actuelles de theme_color dans vos salons
SELECT id, name, theme_color 
FROM salons 
LIMIT 10;



