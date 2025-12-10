#!/usr/bin/env node

// Serveur MCP pour Witstyl
// Ce serveur expose des outils pour interagir avec Supabase et gérer les données du salon

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Charger les variables d'environnement
import 'dotenv/config';

// Vérifier les variables d'environnement
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Variables Supabase manquantes : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.warn('   Le serveur MCP fonctionnera avec des outils limités');
}

// Créer le serveur MCP
const server = new Server(
  {
    name: 'salon-pilot-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Configuration des outils disponibles
const TOOLS_CONFIG = {
  // Outils de base (toujours disponibles)
  basic: [
    {
      name: 'health_check',
      description: 'Vérifier la santé de la connexion Supabase et du système',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_system_info',
      description: 'Obtenir les informations système et de configuration',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],

  // Outils Supabase (nécessitent la configuration Supabase)
  supabase: [
    {
      name: 'get_supabase_stats',
      description: 'Obtenir les statistiques de la base de données Supabase',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_table_data',
      description: 'Récupérer les données d\'une table spécifique',
      inputSchema: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: 'Nom de la table à interroger',
            enum: ['users', 'salons', 'services', 'stylistes', 'clients', 'appointments']
          },
          limit: {
            type: 'number',
            description: 'Nombre maximum d\'enregistrements à retourner',
            default: 10
          }
        },
        required: ['table'],
      },
    },
    {
      name: 'create_client',
      description: 'Créer un nouveau client',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'Prénom du client' },
          lastName: { type: 'string', description: 'Nom du client' },
          email: { type: 'string', description: 'Email du client' },
          phone: { type: 'string', description: 'Téléphone du client' },
          notes: { type: 'string', description: 'Notes personnelles' }
        },
        required: ['firstName', 'lastName', 'email'],
      },
    },
    {
      name: 'get_client_appointments',
      description: 'Récupérer les rendez-vous d\'un client',
      inputSchema: {
        type: 'object',
        properties: {
          clientId: { type: 'string', description: 'ID du client' }
        },
        required: ['clientId'],
      },
    },
    {
      name: 'create_appointment',
      description: 'Créer un nouveau rendez-vous',
      inputSchema: {
        type: 'object',
        properties: {
          clientId: { type: 'string', description: 'ID du client' },
          stylistId: { type: 'string', description: 'ID du styliste' },
          serviceId: { type: 'string', description: 'ID du service' },
          appointmentDate: { type: 'string', description: 'Date et heure du rendez-vous (ISO)' },
          notes: { type: 'string', description: 'Notes du rendez-vous' }
        },
        required: ['clientId', 'stylistId', 'serviceId', 'appointmentDate'],
      },
    },
    {
      name: 'update_appointment_status',
      description: 'Mettre à jour le statut d\'un rendez-vous',
      inputSchema: {
        type: 'object',
        properties: {
          appointmentId: { type: 'string', description: 'ID du rendez-vous' },
          status: { 
            type: 'string', 
            description: 'Nouveau statut',
            enum: ['scheduled', 'confirmed', 'completed', 'cancelled']
          }
        },
        required: ['appointmentId', 'status'],
      },
    },
  ],

  // Outils de base de données (nécessitent DATABASE_URL)
  database: [
    {
      name: 'test_database_connection',
      description: 'Tester la connexion à la base de données PostgreSQL',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'execute_sql_query',
      description: 'Exécuter une requête SQL personnalisée (lecture seule)',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête SQL à exécuter' }
        },
        required: ['query'],
      },
    },
  ],
};

// Fonction pour obtenir tous les outils disponibles
function getAvailableTools() {
  const tools = [...TOOLS_CONFIG.basic];

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    tools.push(...TOOLS_CONFIG.supabase);
  }

  if (DATABASE_URL) {
    tools.push(...TOOLS_CONFIG.database);
  }

  return tools;
}

// Lister les outils disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getAvailableTools();
  return { tools };
});

// Gérer les appels d'outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'health_check':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                supabase_configured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
                database_configured: !!DATABASE_URL,
                available_tools: getAvailableTools().length,
              }, null, 2),
            },
          ],
        };

      case 'get_system_info':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                server_name: 'salon-pilot-mcp',
                version: '1.0.0',
                environment: {
                  supabase_url: SUPABASE_URL ? 'configured' : 'not configured',
                  database_url: DATABASE_URL ? 'configured' : 'not configured',
                },
                available_tools: getAvailableTools().map(tool => tool.name),
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      case 'get_supabase_stats':
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Variables Supabase non configurées');
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const tables = ['users', 'salons', 'services', 'stylistes', 'clients', 'appointments'];
        const stats = {};
        
        for (const table of tables) {
          try {
            const { count, error } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            
            stats[table] = error ? 0 : count || 0;
          } catch (error) {
            stats[table] = 0;
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                stats,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      case 'get_table_data':
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Variables Supabase non configurées');
        }
        
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
        const supabaseClient = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { table, limit = 10 } = args;
        
        const { data, error } = await supabaseClient
          .from(table)
          .select('*')
          .limit(limit);
        
        if (error) {
          throw new Error(`Erreur lors de la récupération des données: ${error.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                table,
                count: data.length,
                data,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      case 'create_client':
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Variables Supabase non configurées');
        }
        
        const { createClient: createClientSupabase } = await import('@supabase/supabase-js');
        const clientSupabase = createClientSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { firstName, lastName, email, phone, notes: clientNotes } = args;
        
        // Récupérer le salon par défaut
        const { data: defaultSalon } = await clientSupabase
          .from('salons')
          .select('id')
          .limit(1)
          .single();
        
        if (!defaultSalon) {
          throw new Error('Aucun salon trouvé pour créer le client');
        }
        
        const { data: newClient, error: clientError } = await clientSupabase
          .from('clients')
          .insert({
            id: crypto.randomUUID(),
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone || '',
            notes: clientNotes || '',
            salon_id: defaultSalon.id
          })
          .select()
          .single();
        
        if (clientError) {
          throw new Error(`Erreur lors de la création du client: ${clientError.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                client: newClient,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      case 'get_client_appointments':
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Variables Supabase non configurées');
        }
        
        const { createClient: createAppointmentSupabase } = await import('@supabase/supabase-js');
        const appointmentSupabase = createAppointmentSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { clientId: getClientId } = args;
        
        const { data: appointments, error: appointmentsError } = await appointmentSupabase
          .from('appointments')
          .select(`
            *,
            services:service_id (
              id,
              name,
              price,
              duration
            ),
            stylistes:stylist_id (
              id,
              name
            )
          `)
          .eq('client_id', getClientId)
          .order('appointment_date', { ascending: true });
        
        if (appointmentsError) {
          throw new Error(`Erreur lors de la récupération des rendez-vous: ${appointmentsError.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                clientId: getClientId,
                appointments,
                count: appointments.length,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      case 'create_appointment':
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Variables Supabase non configurées');
        }
        
        const { createClient: createAppointmentClient } = await import('@supabase/supabase-js');
        const appointmentClient = createAppointmentClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { clientId: createClientId, stylistId, serviceId, appointmentDate, notes: appointmentNotes } = args;
        
        // Récupérer les détails du service pour calculer la durée
        const { data: service } = await appointmentClient
          .from('services')
          .select('duration')
          .eq('id', serviceId)
          .single();
        
        if (!service) {
          throw new Error('Service non trouvé');
        }
        
        const { data: newAppointment, error: appointmentError } = await appointmentClient
          .from('appointments')
          .insert({
            id: crypto.randomUUID(),
            client_id: createClientId,
            stylist_id: stylistId,
            service_id: serviceId,
            appointment_date: appointmentDate,
            duration: service.duration,
            status: 'scheduled',
            notes: appointmentNotes || '',
            salon_id: 'salon-c152118c-478b-497b-98db-db37a4c58898' // Salon par défaut
          })
          .select()
          .single();
        
        if (appointmentError) {
          throw new Error(`Erreur lors de la création du rendez-vous: ${appointmentError.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                appointment: newAppointment,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      case 'update_appointment_status':
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Variables Supabase non configurées');
        }
        
        const { createClient: createStatusSupabase } = await import('@supabase/supabase-js');
        const statusSupabase = createStatusSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { appointmentId, status } = args;
        
        const { data: updatedAppointment, error: updateError } = await statusSupabase
          .from('appointments')
          .update({
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', appointmentId)
          .select()
          .single();
        
        if (updateError) {
          throw new Error(`Erreur lors de la mise à jour du rendez-vous: ${updateError.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                appointment: updatedAppointment,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      case 'test_database_connection':
        if (!DATABASE_URL) {
          throw new Error('DATABASE_URL non configuré');
        }
        
        const { Client } = await import('pg');
        const client = new Client({ connectionString: DATABASE_URL });
        
        try {
          await client.connect();
          const result = await client.query('SELECT 1 as test');
          await client.end();
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'connected',
                  test_result: result.rows[0],
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          await client.end().catch(() => {});
          throw error;
        }

      case 'execute_sql_query':
        if (!DATABASE_URL) {
          throw new Error('DATABASE_URL non configuré');
        }
        
        const { Client: SQLClient } = await import('pg');
        const sqlClient = new SQLClient({ connectionString: DATABASE_URL });
        
        try {
          await sqlClient.connect();
          
          // Vérifier que la requête est en lecture seule (pas de INSERT, UPDATE, DELETE)
          const query = args.query.toLowerCase().trim();
          if (query.startsWith('insert') || query.startsWith('update') || 
              query.startsWith('delete') || query.startsWith('drop') || 
              query.startsWith('create') || query.startsWith('alter')) {
            throw new Error('Seules les requêtes de lecture sont autorisées');
          }
          
          const result = await sqlClient.query(args.query);
          await sqlClient.end();
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  query: args.query,
                  rows: result.rows,
                  rowCount: result.rowCount,
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          await sqlClient.end().catch(() => {});
          throw error;
        }

      default:
        throw new Error(`Outil inconnu: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Démarrer le serveur
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Serveur MCP SalonPilot démarré');
  console.error(`📊 Outils disponibles: ${getAvailableTools().length}`);
  console.error(`🔧 Supabase: ${SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}`);
  console.error(`🗄️ Database: ${DATABASE_URL ? '✅' : '❌'}`);
}

main().catch((error) => {
  console.error('❌ Erreur serveur MCP:', error);
  process.exit(1);
});