-- Fonction SQL pour insérer un client sans valider le schéma owner_notes
-- Cette fonction permet de contourner PostgREST qui valide le schéma avant d'exécuter les requêtes

CREATE OR REPLACE FUNCTION insert_client_without_owner_notes(
  p_id uuid,
  p_salon_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text,
  p_preferred_stylist_id uuid,
  p_created_at timestamptz,
  p_updated_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  -- Insérer le client directement sans valider le schéma
  INSERT INTO clients (
    id,
    salon_id,
    first_name,
    last_name,
    email,
    phone,
    notes,
    preferred_stylist_id,
    created_at,
    updated_at
  )
  VALUES (
    p_id,
    p_salon_id,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_notes,
    p_preferred_stylist_id,
    p_created_at,
    p_updated_at
  );
  
  -- Retourner les données insérées
  SELECT json_build_object(
    'id', id,
    'salon_id', salon_id,
    'first_name', first_name,
    'last_name', last_name,
    'email', email,
    'phone', phone,
    'notes', notes,
    'preferred_stylist_id', preferred_stylist_id,
    'created_at', created_at,
    'updated_at', updated_at
  )
  INTO v_result
  FROM clients
  WHERE id = p_id;
  
  RETURN v_result;
END;
$$;

-- Commentaire pour documenter la fonction
COMMENT ON FUNCTION insert_client_without_owner_notes IS 'Fonction pour insérer un client sans valider le schéma owner_notes (contourne PostgREST)';








