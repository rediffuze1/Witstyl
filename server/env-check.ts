/**
 * Vérification des variables d'environnement au démarrage
 * Affiche des messages clairs si des variables sont manquantes
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  example?: string;
  clientSide?: boolean; // Si true, doit être préfixé avec VITE_ pour le client
}

const envVars: EnvVar[] = [
  {
    name: 'SUPABASE_URL',
    required: true,
    description: 'URL de votre projet Supabase (serveur)',
    example: 'https://your-project-id.supabase.co',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    required: true,
    description: 'Clé anonyme Supabase (serveur)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  {
    name: 'VITE_SUPABASE_URL',
    required: true,
    description: 'URL Supabase pour le client (doit être identique à SUPABASE_URL)',
    clientSide: true,
    example: 'https://your-project-id.supabase.co',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    required: true,
    description: 'Clé anonyme Supabase pour le client (doit être identique à SUPABASE_ANON_KEY)',
    clientSide: true,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false,
    description: 'Clé service role Supabase (pour opérations admin)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  {
    name: 'PORT',
    required: false,
    description: 'Port du serveur (défaut: 5001)',
    example: '5001',
  },
  {
    name: 'HOST',
    required: false,
    description: 'Host du serveur (défaut: 0.0.0.0)',
    example: '0.0.0.0',
  },
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Environnement (development | production)',
    example: 'development',
  },
  {
    name: 'SESSION_SECRET',
    required: false,
    description: 'Secret pour les sessions Express (générer avec: openssl rand -base64 32)',
    example: 'your-random-secret-here',
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    description: 'Clé API OpenAI (pour fonctionnalités vocales)',
    example: 'sk-proj-...',
  },
  {
    name: 'VOICE_MODE',
    required: false,
    description: 'Mode vocal (off | browser | openai)',
    example: 'off',
  },
  {
    name: 'DATABASE_URL',
    required: false,
    description: 'URL de connexion PostgreSQL (optionnel si Supabase uniquement)',
    example: 'postgresql://user:password@host:port/database',
  },
  {
    name: 'REPLIT_URL',
    required: false,
    description: 'URL de votre application Replit (si déployée)',
    example: 'https://your-app.replit.app',
  },
];

export function checkEnv(): { isValid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of envVars) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      missing.push(envVar.name);
    } else if (value && envVar.example && (value.includes('your-') || value.includes('YOUR_'))) {
      warnings.push(`${envVar.name} semble contenir une valeur d'exemple`);
    }
  }

  // Vérifications spéciales
  const supabaseUrl = process.env.SUPABASE_URL;
  const viteSupabaseUrl = process.env.VITE_SUPABASE_URL;
  if (supabaseUrl && viteSupabaseUrl && supabaseUrl !== viteSupabaseUrl) {
    warnings.push('SUPABASE_URL et VITE_SUPABASE_URL doivent avoir la même valeur');
  }

  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const viteSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseAnonKey && viteSupabaseAnonKey && supabaseAnonKey !== viteSupabaseAnonKey) {
    warnings.push('SUPABASE_ANON_KEY et VITE_SUPABASE_ANON_KEY doivent avoir la même valeur');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

export function printEnvStatus(): void {
  const { isValid, missing, warnings } = checkEnv();

  console.log('\n📋 Vérification des variables d\'environnement\n');

  if (isValid) {
    console.log('✅ Toutes les variables obligatoires sont configurées\n');
  } else {
    console.error('❌ Variables d\'environnement manquantes:\n');
    for (const name of missing) {
      const envVar = envVars.find(v => v.name === name);
      console.error(`   - ${name}`);
      if (envVar) {
        console.error(`     Description: ${envVar.description}`);
        if (envVar.example) {
          console.error(`     Exemple: ${envVar.example}`);
        }
        if (envVar.clientSide) {
          console.error(`     ⚠️  Cette variable est exposée côté client`);
        }
      }
      console.error('');
    }
    console.error('💡 Créez un fichier .env à la racine du projet avec ces variables.');
    console.error('   Vous pouvez copier .env.example comme point de départ.\n');
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Avertissements:\n');
    for (const warning of warnings) {
      console.warn(`   - ${warning}`);
    }
    console.warn('');
  }

  // Afficher les variables configurées (masquées)
  console.log('📝 Variables configurées:\n');
  for (const envVar of envVars) {
    const value = process.env[envVar.name];
    if (value) {
      // Masquer les valeurs sensibles
      const displayValue = envVar.name.includes('KEY') || envVar.name.includes('SECRET')
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`   ✅ ${envVar.name}: ${displayValue}`);
    } else if (!envVar.required) {
      console.log(`   ⚪ ${envVar.name}: (optionnel, non défini)`);
    }
  }
  console.log('');
}

