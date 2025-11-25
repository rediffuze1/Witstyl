-- Script SQL complet pour créer toutes les tables nécessaires dans Supabase
-- Ce script crée toutes les tables pour SalonPilot

-- 1. Table des sessions (pour l'authentification)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des utilisateurs (propriétaires de salon)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table des salons
CREATE TABLE IF NOT EXISTS salons (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table des services
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration INTEGER NOT NULL, -- en minutes
    tags TEXT[], -- tableau de tags/catégories
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Table des stylistes
CREATE TABLE IF NOT EXISTS stylistes (
    id TEXT PRIMARY KEY,
    salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialties TEXT[], -- tableau de spécialités
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Table des clients
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    preferred_stylist_id TEXT REFERENCES stylistes(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Table des rendez-vous
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    stylist_id TEXT NOT NULL REFERENCES stylistes(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL, -- en minutes
    status TEXT DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_salons_user_id ON salons(user_id);
CREATE INDEX IF NOT EXISTS idx_services_salon_id ON services(salon_id);
CREATE INDEX IF NOT EXISTS idx_stylistes_salon_id ON stylistes(salon_id);
CREATE INDEX IF NOT EXISTS idx_clients_salon_id ON clients(salon_id);
CREATE INDEX IF NOT EXISTS idx_clients_preferred_stylist ON clients(preferred_stylist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_salon_id ON appointments(salon_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_stylist_id ON appointments(stylist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- Insérer des données de test
INSERT INTO users (id, email, password_hash, first_name, last_name, phone) VALUES
('user-1', 'test@example.com', '$2a$10$example_hash', 'Test', 'Owner', '+33 6 12 34 56 78')
ON CONFLICT (id) DO NOTHING;

INSERT INTO salons (id, user_id, name, address, phone, email, description) VALUES
('salon-1', 'user-1', 'Test Salon', '123 Test Street', '+33 1 23 45 67 89', 'contact@testsalon.com', 'A test salon')
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, salon_id, name, description, price, duration, tags) VALUES
('service-1', 'salon-1', 'Coupe Homme', 'Coupe de cheveux pour homme', 25.00, 30, ARRAY['Homme']),
('service-2', 'salon-1', 'Coupe Femme', 'Coupe de cheveux pour femme', 35.00, 45, ARRAY['Femme']),
('service-3', 'salon-1', 'Coupe Enfant', 'Coupe de cheveux pour enfant', 20.00, 25, ARRAY['Enfant']),
('service-4', 'salon-1', 'Coloration', 'Coloration complète', 60.00, 120, ARRAY['Femme']),
('service-5', 'salon-1', 'Brushing', 'Brushing et coiffage', 30.00, 30, ARRAY['Femme'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO stylistes (id, salon_id, name, email, phone, specialties, is_active) VALUES
('stylist-1', 'salon-1', 'Marie Dupont', 'marie@testsalon.com', '+33 6 11 22 33 44', ARRAY['Femme', 'Coloration'], true),
('stylist-2', 'salon-1', 'Jean Martin', 'jean@testsalon.com', '+33 6 22 33 44 55', ARRAY['Homme'], true),
('stylist-3', 'salon-1', 'Sophie Leroy', 'sophie@testsalon.com', '+33 6 33 44 55 66', ARRAY['Femme', 'Enfant'], true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (id, salon_id, first_name, last_name, email, phone, preferred_stylist_id, notes) VALUES
('client-1', 'salon-1', 'Alice', 'Durand', 'alice@example.com', '+33 6 44 55 66 77', 'stylist-1', 'Client régulier'),
('client-2', 'salon-1', 'Bob', 'Martin', 'bob@example.com', '+33 6 55 66 77 88', 'stylist-2', 'Préfère les coupes courtes'),
('client-3', 'salon-1', 'Claire', 'Petit', 'claire@example.com', '+33 6 66 77 88 99', 'stylist-3', 'Mère de famille')
ON CONFLICT (id) DO NOTHING;

-- Vérifier que les tables ont été créées
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('users', 'salons', 'services', 'stylistes', 'clients', 'appointments', 'sessions')
ORDER BY table_name, ordinal_position;
