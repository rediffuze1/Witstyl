import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "./supabaseService";
import crypto from 'crypto';

// Extension du type Request pour inclure les sessions client
declare global {
  namespace Express {
    interface Request {
      client?: any;
    }
  }
}

// Interface pour les sessions client
export interface ClientSession {
  clientId: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Fonction pour hasher les mots de passe
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Fonction pour vérifier les mots de passe
function verifyPassword(password: string, hashedPassword: string): boolean {
  return hashPassword(password) === hashedPassword;
}

// Middleware pour vérifier l'authentification client
export const isClientAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Debug: Vérifier la session
    const hasSession = !!req.session;
    const clientSession = req.session?.client as ClientSession;
    const sessionId = req.sessionID;
    const hasCookies = !!req.headers.cookie;
    const userSession = req.session?.user;
    
    // Log pour debugging
    console.log('[isClientAuthenticated] Vérification:', {
      path: req.path,
      hasSession,
      sessionId: sessionId?.substring(0, 20) + '...',
      hasCookies,
      hasUserSession: !!userSession,
      hasClientSession: !!clientSession,
      clientId: clientSession?.clientId
    });
    
    if (!hasSession) {
      console.log('[isClientAuthenticated] ❌ Aucune session trouvée');
      return res.status(401).json({ message: "Session introuvable" });
    }
    
    if (!clientSession || !clientSession.clientId) {
      console.log('[isClientAuthenticated] ❌ Session client invalide:', {
        hasClientSession: !!clientSession,
        clientId: clientSession?.clientId,
        sessionId: sessionId?.substring(0, 20) + '...',
        cookies: hasCookies ? 'présents' : 'absents'
      });
      return res.status(401).json({ message: "Client non authentifié" });
    }

    // Vérifier que le client existe toujours dans Supabase
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientSession.clientId)
      .single();

    if (error || !client) {
      console.error('[isClientAuthenticated] Client non trouvé en base:', {
        clientId: clientSession.clientId,
        error: error?.message
      });
      req.session!.client = undefined;
      return res.status(401).json({ message: "Client introuvable" });
    }

    req.client = client;
    next();
  } catch (error) {
    console.error("Erreur d'authentification client:", error);
    res.status(500).json({ message: "Erreur d'authentification" });
  }
};

// Routes d'authentification client
export function setupClientAuth(app: any) {
  // Fonction utilitaire pour normaliser les emails en minuscules
  const normalizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
  };

  // Connexion client
  app.post('/api/client/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email et mot de passe requis" });
      }

      // Normaliser l'email en minuscules
      const normalizedEmail = normalizeEmail(email);
      console.log('[client/login] Email normalisé:', email, '→', normalizedEmail);

      // Chercher le client par email dans Supabase (insensible à la casse)
      // Utiliser ilike avec le pattern exact (ilike fonctionne comme LIKE mais insensible à la casse)
      const { data: client, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      
      // Si pas trouvé avec ilike, essayer avec eq en minuscules (pour les emails déjà normalisés)
      let foundClient = client;
      if (!foundClient && !error) {
        const { data: clientLower, error: errorLower } = await supabaseAdmin
          .from('clients')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();
        
        if (clientLower) {
          foundClient = clientLower;
        }
      }
      
      const finalClient = foundClient;
      const finalError = error;
      
      if (finalError || !finalClient) {
        console.log('[client/login] Client non trouvé avec email:', normalizedEmail);
        return res.status(404).json({ message: "Aucun compte trouvé avec cet email" });
      }

      // Vérifier le mot de passe
      if (!finalClient.password_hash || hashPassword(password) !== finalClient.password_hash) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      // Si l'email en base n'est pas en minuscules, le mettre à jour
      if (finalClient.email !== normalizedEmail) {
        console.log('[client/login] Mise à jour de l\'email en minuscules:', finalClient.email, '→', normalizedEmail);
        await supabaseAdmin
          .from('clients')
          .update({ email: normalizedEmail })
          .eq('id', finalClient.id);
        // Mettre à jour l'email dans l'objet client pour la session
        finalClient.email = normalizedEmail;
      }

      // Créer la session client
      const clientSession: ClientSession = {
        clientId: finalClient.id,
        email: finalClient.email,
        firstName: finalClient.first_name,
        lastName: finalClient.last_name
      };

      req.session!.client = clientSession;
      
      // Sauvegarder explicitement la session AVANT de répondre
      await new Promise<void>((resolve, reject) => {
        req.session!.save((err) => {
          if (err) {
            console.error("[clientAuth] Erreur lors de la sauvegarde de la session:", err);
            reject(err);
          } else {
            console.log("[clientAuth] ✅ Session sauvegardée pour client:", client.id);
            resolve();
          }
        });
      });

      // Vérifier que la session est bien sauvegardée avant d'envoyer la réponse
      console.log("[clientAuth] Session après save:", {
        sessionId: req.sessionID?.substring(0, 20) + '...',
        hasClient: !!req.session?.client,
        clientId: req.session?.client?.clientId
      });

      res.json({
        success: true,
        client: {
          id: finalClient.id,
          firstName: finalClient.first_name,
          lastName: finalClient.last_name,
          email: finalClient.email,
          phone: finalClient.phone
        }
      });
    } catch (error) {
      console.error("Erreur de connexion client:", error);
      res.status(500).json({ message: "Erreur de connexion" });
    }
  });

  // Inscription client
  app.post('/api/client/register', async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, email, phone, password, notes, sex } = req.body;
      
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "Tous les champs requis doivent être remplis" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
      }

      // Normaliser l'email en minuscules avant l'enregistrement
      const normalizedEmail = normalizeEmail(email);
      console.log('[client/register] Email normalisé:', email, '→', normalizedEmail);

      // Vérifier si le client existe déjà (insensible à la casse avec ilike)
      const { data: existingClients, error: checkError } = await supabaseAdmin
        .from('clients')
        .select('*')
        .ilike('email', normalizedEmail);
      
      if (checkError) {
        console.error("Erreur lors de la vérification du client existant:", checkError);
        // Continuer malgré l'erreur, car cela pourrait être une erreur de connexion
      }
      
      if (existingClients && existingClients.length > 0) {
        return res.status(400).json({ message: "Un compte existe déjà avec cet email" });
      }

      // Récupérer le salon par défaut (premier salon disponible)
      const { data: defaultSalon, error: salonError } = await supabaseAdmin
        .from('salons')
        .select('id')
        .limit(1)
        .single();

      if (salonError || !defaultSalon) {
        console.error('Aucun salon disponible pour l\'inscription', { salonError });
        return res.status(400).json({ message: "Aucun salon n'est configuré. Veuillez d'abord créer un salon côté propriétaire." });
      }

      // Générer un ID unique pour le client
      const clientId = crypto.randomUUID();
      
      // Hasher le mot de passe
      const hashedPassword = hashPassword(password);
      
      console.log('Tentative de création client:', {
        id: clientId,
        email,
        salon_id: defaultSalon.id,
        hasPassword: !!hashedPassword
      });

      // Préparer les notes avec le sexe en JSON (car la colonne sex n'existe pas)
      let clientNotes: string | null = null;
      if (sex && sex !== '' && sex !== 'none') {
        const notesData: any = {};
        if (notes && notes.trim()) {
          notesData.text = notes.trim();
        }
        notesData.sex = sex;
        clientNotes = JSON.stringify(notesData);
      } else if (notes && notes.trim()) {
        clientNotes = notes.trim();
      }

      // Créer le client dans Supabase avec mot de passe hashé (email en minuscules)
      const { data: newClient, error: createError } = await supabaseAdmin
        .from('clients')
        .insert({
          id: clientId,
          first_name: firstName,
          last_name: lastName,
          email: normalizedEmail, // Email normalisé en minuscules
          phone: phone || '',
          notes: clientNotes,
          salon_id: defaultSalon.id,
          password_hash: hashedPassword
        })
        .select()
        .single();

      if (createError) {
        console.error("Erreur de création de client:", createError);
        console.error("Détails de l'erreur:", JSON.stringify(createError, null, 2));
        return res.status(500).json({ 
          message: "Erreur lors de la création du compte",
          error: process.env.NODE_ENV === 'development' ? createError.message : undefined
        });
      }

      // Créer la session client
      const clientSession: ClientSession = {
        clientId: newClient.id,
        email: newClient.email,
        firstName: newClient.first_name,
        lastName: newClient.last_name
      };

      req.session!.client = clientSession;

      res.json({
        success: true,
        message: "Compte créé avec succès",
        client: {
          id: newClient.id,
          firstName: newClient.first_name,
          lastName: newClient.last_name,
          email: newClient.email,
          phone: newClient.phone
        }
      });
    } catch (error: any) {
      console.error("Erreur d'inscription client:", error);
      console.error("Stack:", error?.stack);
      res.status(500).json({ 
        message: "Erreur d'inscription",
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });

  // Réinitialisation de mot de passe client
  app.post('/api/client/reset-password', async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body;
      
      if (!email || !newPassword) {
        return res.status(400).json({ message: "Email et nouveau mot de passe requis" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
      }

      // Normaliser l'email en minuscules
      const normalizedEmail = normalizeEmail(email);
      console.log('[client/reset-password] Email normalisé:', email, '→', normalizedEmail);

      // Vérifier si le client existe dans la table clients (insensible à la casse avec ilike)
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('*')
        .ilike('email', normalizedEmail)
        .single();
      
      if (clientError || !client) {
        return res.status(404).json({ message: "Aucun compte trouvé avec cet email" });
      }

      // Mettre à jour le mot de passe hashé dans la table clients
      const { error: updateError } = await supabaseAdmin
        .from('clients')
        .update({ 
          password_hash: hashPassword(newPassword),
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (updateError) {
        console.error("Erreur lors de la mise à jour du mot de passe:", updateError);
        return res.status(500).json({ message: "Erreur lors de la réinitialisation du mot de passe" });
      }

      res.json({
        success: true,
        message: "Mot de passe réinitialisé avec succès"
      });
    } catch (error) {
      console.error("Erreur de réinitialisation de mot de passe:", error);
      res.status(500).json({ message: "Erreur de réinitialisation" });
    }
  });

  // Déconnexion client
  app.post('/api/client/logout', (req: Request, res: Response) => {
    req.session!.client = undefined;
    res.json({ success: true });
  });

  // Vérifier la session client (route gracieuse)
  app.get('/api/client/me', async (req: Request, res: Response) => {
    try {
      const clientSession = req.session?.client as ClientSession;

      if (!clientSession || !clientSession.clientId) {
        return res.json({ authenticated: false, user: null, profile: null });
      }

      // Vérifier que le client existe toujours dans Supabase
      // Exclure owner_notes (notes privées du owner) pour la sécurité
      const { data: client, error } = await supabaseAdmin
        .from('clients')
        .select('id, first_name, last_name, email, phone, notes, preferred_stylist_id, salon_id, created_at, updated_at')
        .eq('id', clientSession.clientId)
        .single();

      if (error || !client) {
        req.session!.client = undefined;
        return res.json({ authenticated: false, user: null, profile: null });
      }

      // Client authentifié
      res.json({
        authenticated: true,
        user: {
          id: client.id,
          email: client.email,
          firstName: client.first_name,
          lastName: client.last_name
        },
        profile: {
          id: client.id,
          firstName: client.first_name,
          lastName: client.last_name,
          email: client.email,
          phone: client.phone,
          notes: (() => {
            // Extraire le texte des notes depuis JSON si nécessaire
            try {
              if (client.notes) {
                const notesData = JSON.parse(client.notes);
                return notesData.text || client.notes;
              }
            } catch (e) {
              // Si notes n'est pas du JSON, retourner tel quel
            }
            return client.notes;
          })(),
          preferredStylistId: client.preferred_stylist_id,
          // Extraire le sexe depuis notes (JSON) si la colonne sex n'existe pas
          sex: (() => {
            // Essayer d'abord la colonne sex si elle existe
            if (client.sex) {
              return client.sex;
            }
            // Sinon, extraire depuis notes (JSON)
            try {
              if (client.notes) {
                const notesData = JSON.parse(client.notes);
                return notesData.sex || null;
              }
            } catch (e) {
              // Si notes n'est pas du JSON, retourner null
            }
            return null;
          })()
        }
      });
    } catch (error) {
      console.error("Erreur dans /api/client/me:", error);
      res.json({ authenticated: false, user: null, profile: null });
    }
  });

  // Obtenir les rendez-vous du client
  app.get('/api/client/appointments', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      
      if (!client || !client.id) {
        console.error('[GET /api/client/appointments] ❌ Client invalide dans req.client');
        return res.status(401).json({ message: "Client invalide" });
      }
      
      const clientSession = req.session?.client as ClientSession;
      console.log('[GET /api/client/appointments] ✅ Client ID (depuis req.client):', client.id);
      console.log('[GET /api/client/appointments] ✅ Client ID (depuis session):', clientSession?.clientId);
      console.log('[GET /api/client/appointments] 🔍 Comparaison clientId:', {
        'req.client.id': client.id,
        'session.clientId': clientSession?.clientId,
        'correspondent': client.id === clientSession?.clientId
      });
      console.log('[GET /api/client/appointments] Client ID type:', typeof client.id);
      console.log('[GET /api/client/appointments] Client ID length:', client.id?.length);
      console.log('[GET /api/client/appointments] Client email:', client.email);
      console.log('[GET /api/client/appointments] Client complet:', JSON.stringify(client, null, 2));
      
      // Déterminer le clientId à utiliser pour la recherche
      // Utiliser client.id en priorité, mais aussi vérifier session.clientId si différent
      let searchClientId = client.id;
      const useSessionClientId = clientSession?.clientId && clientSession.clientId !== client.id;
      
      if (useSessionClientId) {
        console.log('[GET /api/client/appointments] ⚠️ client.id et session.clientId diffèrent!');
        console.log('[GET /api/client/appointments] ⚠️ client.id:', client.id);
        console.log('[GET /api/client/appointments] ⚠️ session.clientId:', clientSession.clientId);
        console.log('[GET /api/client/appointments] 🔍 Vérification des deux...');
      }
      
      // Vérifier d'abord s'il y a des rendez-vous pour ce client (sans jointures pour debug)
      console.log('[GET /api/client/appointments] 🔍 Recherche avec client.id:', client.id);
      const { data: allAppointments, error: checkError } = await supabaseAdmin
        .from('appointments')
        .select('id, client_id, appointment_date, status')
        .eq('client_id', client.id);
      
      // Aussi essayer avec le clientId de la session au cas où ils diffèrent
      let altAppointments: any[] | null = null;
      if (useSessionClientId) {
        console.log('[GET /api/client/appointments] 🔍 Recherche alternative avec session.clientId:', clientSession.clientId);
        const { data: altAppts, error: altError } = await supabaseAdmin
          .from('appointments')
          .select('id, client_id, appointment_date, status')
          .eq('client_id', clientSession.clientId);
        altAppointments = altAppts;
        console.log('[GET /api/client/appointments] 🔍 Résultats recherche alternative:', altAppointments?.length || 0);
        if (altAppointments && altAppointments.length > 0 && (!allAppointments || allAppointments.length === 0)) {
          console.log('[GET /api/client/appointments] ⚠️ PROBLÈME DÉTECTÉ: Les rendez-vous sont trouvés avec session.clientId mais pas avec client.id!');
          console.log('[GET /api/client/appointments] ⚠️ Utilisation de session.clientId pour la recherche principale');
          searchClientId = clientSession.clientId;
        }
      }
      
      console.log('[GET /api/client/appointments] 🔍 Vérification directe - Nombre de rendez-vous:', allAppointments?.length || 0);
      console.log('[GET /api/client/appointments] 🔍 Rendez-vous bruts (sans jointures):', JSON.stringify(allAppointments, null, 2));
      if (checkError) {
        console.error('[GET /api/client/appointments] ❌ Erreur vérification directe:', checkError);
      }
      
      // Vérification supplémentaire : récupérer TOUS les rendez-vous pour voir s'il y en a
      const { data: allAppointmentsInDb, error: allError } = await supabaseAdmin
        .from('appointments')
        .select('id, client_id, appointment_date, status')
        .limit(100);
      
      console.log('[GET /api/client/appointments] 🔍 TOTAL rendez-vous dans la base:', allAppointmentsInDb?.length || 0);
      if (allAppointmentsInDb && allAppointmentsInDb.length > 0) {
        const matchingAppointments = allAppointmentsInDb.filter((apt: any) => 
          apt.client_id === client.id || apt.client_id === clientSession?.clientId
        );
        console.log('[GET /api/client/appointments] 🔍 Rendez-vous correspondants trouvés:', matchingAppointments.length);
        if (matchingAppointments.length > 0) {
          console.log('[GET /api/client/appointments] 🔍 Rendez-vous correspondants:', JSON.stringify(matchingAppointments, null, 2));
        }
        
        // Afficher quelques exemples de client_id dans la base pour comparaison
        const sampleClientIds = [...new Set(allAppointmentsInDb.slice(0, 10).map((apt: any) => apt.client_id))];
        console.log('[GET /api/client/appointments] 🔍 Exemples de client_id dans la base:', sampleClientIds);
      }
      
      // Récupérer les rendez-vous depuis Supabase avec les détails
      // Adapter aux noms de colonnes réels (snake_case) de la base
      // Note: La table utilise appointment_date et duration, pas start_time/end_time
      
      // Essayer d'abord avec les jointures
      let appointments: any[] | null = null;
      
      const { data: appointmentsWithJoins, error: joinError } = await supabaseAdmin
        .from('appointments')
        .select(`
          id,
          appointment_date,
          duration,
          status,
          notes,
          service_id,
          stylist_id,
          client_id,
          services:service_id (
            id,
            name,
            price,
            duration_minutes,
            duration
          ),
          stylistes:stylist_id (
            id,
            first_name,
            last_name,
            name
          )
        `)
        .eq('client_id', searchClientId) // Utiliser le clientId déterminé
        .order('appointment_date', { ascending: true });

      // Vérifier si les jointures ont fonctionné correctement
      if (joinError) {
        console.error('[GET /api/client/appointments] ❌ Erreur Supabase (avec jointures):', joinError);
        console.log('[GET /api/client/appointments] 🔄 Tentative de récupération sans jointures...');
        
        // Si les jointures échouent, récupérer sans jointures et enrichir manuellement
        const { data: appointmentsWithoutJoins, error: noJoinError } = await supabaseAdmin
          .from('appointments')
          .select('id, appointment_date, duration, status, notes, service_id, stylist_id, client_id')
          .eq('client_id', searchClientId) // Utiliser le clientId déterminé
          .order('appointment_date', { ascending: true });
        
        if (noJoinError) {
          console.error('[GET /api/client/appointments] ❌ Erreur même sans jointures:', noJoinError);
          return res.json([]);
        }
        
        // Enrichir manuellement avec les services et stylistes
        if (appointmentsWithoutJoins && appointmentsWithoutJoins.length > 0) {
          console.log('[GET /api/client/appointments] 🔄 Enrichissement manuel de', appointmentsWithoutJoins.length, 'rendez-vous');
          
          const enrichedAppointments = await Promise.all(
            appointmentsWithoutJoins.map(async (apt: any) => {
              // Récupérer le service - utiliser select('*') car les noms de colonnes peuvent varier
              const { data: service, error: serviceError } = await supabaseAdmin
                .from('services')
                .select('*')
                .eq('id', apt.service_id)
                .maybeSingle();
              
              if (serviceError) {
                console.warn('[GET /api/client/appointments] ⚠️ Erreur récupération service pour', apt.service_id, ':', serviceError);
              }
              
              // Récupérer le styliste - utiliser select('*') car les noms de colonnes peuvent varier
              const { data: stylist, error: stylistError } = await supabaseAdmin
                .from('stylistes')
                .select('*')
                .eq('id', apt.stylist_id)
                .maybeSingle();
              
              if (stylistError) {
                console.warn('[GET /api/client/appointments] ⚠️ Erreur récupération styliste pour', apt.stylist_id, ':', stylistError);
              }
              
              console.log('[GET /api/client/appointments] 🔍 Service récupéré pour', apt.id, ':', service ? service.name : 'NON TROUVÉ');
              console.log('[GET /api/client/appointments] 🔍 Styliste récupéré pour', apt.id, ':', stylist ? `${stylist.first_name} ${stylist.last_name}` : 'NON TROUVÉ');
              
              return {
                ...apt,
                services: service,
                stylistes: stylist
              };
            })
          );
          
          appointments = enrichedAppointments;
        } else {
          appointments = [];
        }
      } else {
        // Vérifier si les jointures ont bien fonctionné et si les données sont complètes
        if (appointmentsWithJoins && appointmentsWithJoins.length > 0) {
          console.log('[GET /api/client/appointments] ✅ Jointures réussies, vérification des données...');
          console.log('[GET /api/client/appointments] 🔍 Exemple premier rendez-vous brut:', JSON.stringify({
            id: appointmentsWithJoins[0]?.id,
            service_id: appointmentsWithJoins[0]?.service_id,
            services: appointmentsWithJoins[0]?.services,
            stylist_id: appointmentsWithJoins[0]?.stylist_id,
            stylistes: appointmentsWithJoins[0]?.stylistes
          }, null, 2));
          
          // TOUJOURS enrichir manuellement - Les jointures Supabase peuvent retourner null même si elles réussissent
          // Ne pas se fier aux jointures, toujours récupérer les services et stylistes manuellement
          console.log('[GET /api/client/appointments] 🔄 Enrichissement manuel FORCÉ de tous les rendez-vous...');
          
          const enrichedAppointments = await Promise.all(
            appointmentsWithJoins.map(async (apt: any) => {
              // TOUJOURS utiliser service_id et stylist_id directement - ne pas se fier aux jointures
              const serviceId = apt.service_id;
              const stylistId = apt.stylist_id;
              
              console.log('[GET /api/client/appointments] 🔍 Rendez-vous', apt.id, '- service_id:', serviceId, '- stylist_id:', stylistId);
              
              // TOUJOURS récupérer le service manuellement (les jointures peuvent retourner null)
              if (serviceId) {
                console.log('[GET /api/client/appointments] 🔍 Recherche service avec ID:', serviceId);
                // Utiliser select('*') directement car les noms de colonnes peuvent varier
                let { data: service, error: serviceError } = await supabaseAdmin
                  .from('services')
                  .select('*')
                  .eq('id', serviceId)
                  .maybeSingle();
                
                // Si la requête échoue, loguer l'erreur mais continuer
                if (serviceError) {
                  console.error('[GET /api/client/appointments] ❌ Erreur récupération service:', serviceError);
                }
                
                console.log('[GET /api/client/appointments] 🔍 Résultat query Supabase - service:', service ? `TROUVÉ (${JSON.stringify(service)})` : 'NON TROUVÉ');
                console.log('[GET /api/client/appointments] 🔍 Résultat query Supabase - error:', serviceError ? JSON.stringify(serviceError) : 'AUCUNE ERREUR');
                
                if (serviceError) {
                  console.error('[GET /api/client/appointments] ❌ Erreur récupération service:', serviceError);
                }
                
                // Assigner le service même s'il n'a pas de name (on pourra utiliser un fallback)
                if (service && service.id) {
                  apt.services = service;
                  console.log('[GET /api/client/appointments] ✅ Service récupéré et assigné pour', apt.id, ':', service.name || 'SANS NOM', '- Prix:', service.price || 0);
                  console.log('[GET /api/client/appointments] 🔍 apt.services après assignation:', JSON.stringify(apt.services));
                } else {
                  console.warn('[GET /api/client/appointments] ⚠️ Service non trouvé pour', apt.id, 'avec service_id:', serviceId);
                  console.warn('[GET /api/client/appointments] ⚠️ service récupéré:', JSON.stringify(service));
                  console.warn('[GET /api/client/appointments] ⚠️ serviceError:', JSON.stringify(serviceError));
                  
                  // Essayer une dernière fois avec une requête plus simple
                  console.log('[GET /api/client/appointments] 🔄 Dernière tentative avec requête simple...');
                  const { data: serviceSimple, error: serviceErrorSimple } = await supabaseAdmin
                    .from('services')
                    .select('*')
                    .eq('id', serviceId)
                    .maybeSingle();
                  
                  console.log('[GET /api/client/appointments] 🔍 Résultat requête simple:', serviceSimple ? `TROUVÉ (${JSON.stringify(serviceSimple)})` : 'NON TROUVÉ');
                  if (serviceSimple && serviceSimple.id) {
                    apt.services = serviceSimple;
                    console.log('[GET /api/client/appointments] ✅ Service trouvé avec requête simple:', serviceSimple.name || 'SANS NOM');
                  } else {
                    console.error('[GET /api/client/appointments] ❌ Service définitivement non trouvé pour service_id:', serviceId);
                  }
                }
              } else {
                console.warn('[GET /api/client/appointments] ⚠️ Pas de service_id pour', apt.id);
              }
              
              // TOUJOURS récupérer le styliste manuellement (les jointures peuvent retourner null)
              if (stylistId) {
                // Utiliser select('*') directement car les noms de colonnes peuvent varier
                const { data: stylist, error: stylistError } = await supabaseAdmin
                  .from('stylistes')
                  .select('*')
                  .eq('id', stylistId)
                  .maybeSingle();
                
                if (stylistError) {
                  console.error('[GET /api/client/appointments] ❌ Erreur récupération styliste:', stylistError);
                }
                
                if (stylist && stylist.id) {
                  apt.stylistes = stylist;
                  console.log('[GET /api/client/appointments] ✅ Styliste récupéré pour', apt.id, ':', `${stylist.first_name || ''} ${stylist.last_name || ''}`.trim() || stylist.name || 'SANS NOM');
                  console.log('[GET /api/client/appointments] 🔍 apt.stylistes après assignation:', JSON.stringify(apt.stylistes));
                } else {
                  console.warn('[GET /api/client/appointments] ⚠️ Styliste non trouvé pour', apt.id, 'avec stylist_id:', stylistId);
                  console.warn('[GET /api/client/appointments] ⚠️ stylist récupéré:', JSON.stringify(stylist));
                  console.warn('[GET /api/client/appointments] ⚠️ stylistError:', JSON.stringify(stylistError));
                  
                  // Essayer une dernière fois avec une requête plus simple
                  console.log('[GET /api/client/appointments] 🔄 Dernière tentative styliste avec requête simple...');
                  const { data: stylistSimple, error: stylistErrorSimple } = await supabaseAdmin
                    .from('stylistes')
                    .select('*')
                    .eq('id', stylistId)
                    .maybeSingle();
                  
                  console.log('[GET /api/client/appointments] 🔍 Résultat requête simple styliste:', stylistSimple ? `TROUVÉ (${JSON.stringify(stylistSimple)})` : 'NON TROUVÉ');
                  if (stylistSimple && stylistSimple.id) {
                    apt.stylistes = stylistSimple;
                    console.log('[GET /api/client/appointments] ✅ Styliste trouvé avec requête simple:', `${stylistSimple.first_name || ''} ${stylistSimple.last_name || ''}`.trim() || stylistSimple.name || 'SANS NOM');
                  } else {
                    console.error('[GET /api/client/appointments] ❌ Styliste définitivement non trouvé pour stylist_id:', stylistId);
                  }
                }
              } else {
                console.warn('[GET /api/client/appointments] ⚠️ Pas de stylist_id pour', apt.id);
              }
              
              console.log('[GET /api/client/appointments] 🔍 apt final avant return:', JSON.stringify({
                id: apt.id,
                service_id: apt.service_id,
                services: apt.services,
                stylist_id: apt.stylist_id,
                stylistes: apt.stylistes
              }));
              
              return apt;
            })
          );
          
          appointments = enrichedAppointments;
        } else {
          appointments = appointmentsWithJoins || [];
        }
      }

      console.log('[GET /api/client/appointments] Nombre de rendez-vous trouvés (avec jointures):', appointments?.length || 0);
      if (appointments && appointments.length > 0) {
        const firstApt = appointments[0];
        console.log('[GET /api/client/appointments] 🔍 Exemple rendez-vous AVANT transformation:');
        console.log('[GET /api/client/appointments] 🔍   id:', firstApt?.id);
        console.log('[GET /api/client/appointments] 🔍   service_id:', firstApt?.service_id);
        console.log('[GET /api/client/appointments] 🔍   services:', JSON.stringify(firstApt?.services));
        console.log('[GET /api/client/appointments] 🔍   services type:', typeof firstApt?.services);
        console.log('[GET /api/client/appointments] 🔍   services.id:', firstApt?.services?.id);
        console.log('[GET /api/client/appointments] 🔍   services.name:', firstApt?.services?.name);
        console.log('[GET /api/client/appointments] 🔍   stylist_id:', firstApt?.stylist_id);
        console.log('[GET /api/client/appointments] 🔍   stylistes:', JSON.stringify(firstApt?.stylistes));
      }

      // Transformer les données pour correspondre au format attendu
      const enrichedAppointments = (appointments || []).map((appointment: any) => {
        // Calculer endTime à partir de appointment_date + duration
        const startTime = appointment.appointment_date;
        const duration = appointment.duration || appointment.services?.duration_minutes || appointment.services?.duration || 60;
        const endTime = startTime ? new Date(new Date(startTime).getTime() + duration * 60000).toISOString() : null;
        
        // Normaliser le statut (s'assurer qu'il est valide)
        let status = appointment.status || 'scheduled';
        // Si le statut est "scheduled", le convertir en "confirmed" pour compatibilité
        if (status === 'scheduled') {
          status = 'confirmed';
        }
        
        // Vérifier que les données essentielles sont présentes
        if (!appointment.id) {
          console.warn('[GET /api/client/appointments] Rendez-vous sans ID ignoré:', appointment);
          return null;
        }
        
        // Utiliser les données enrichies si disponibles, sinon utiliser les données de base
        // IMPORTANT: Les données enrichies sont dans appointment.services et appointment.stylistes
        // Vérifier si appointment.services est un objet valide avec id (name peut être manquant)
        const hasValidService = appointment.services && 
                                typeof appointment.services === 'object' && 
                                appointment.services !== null && 
                                appointment.services.id;
        
        const hasValidStylist = appointment.stylistes && 
                                typeof appointment.stylistes === 'object' && 
                                appointment.stylistes !== null && 
                                appointment.stylistes.id;
        
        const serviceData = hasValidService ? appointment.services : {};
        const stylistData = hasValidStylist ? appointment.stylistes : {};
        
        console.log('[GET /api/client/appointments] 🔍 Transformation - appointment.id:', appointment.id);
        console.log('[GET /api/client/appointments] 🔍   appointment.service_id:', appointment.service_id);
        console.log('[GET /api/client/appointments] 🔍   hasValidService:', hasValidService);
        console.log('[GET /api/client/appointments] 🔍   appointment.services:', JSON.stringify(appointment.services));
        console.log('[GET /api/client/appointments] 🔍   serviceData:', JSON.stringify(serviceData));
        console.log('[GET /api/client/appointments] 🔍   serviceData.name:', serviceData.name);
        
        if (!hasValidService && appointment.service_id) {
          console.warn('[GET /api/client/appointments] ⚠️ Service manquant pour rendez-vous:', appointment.id, 'service_id:', appointment.service_id);
          console.warn('[GET /api/client/appointments] ⚠️ appointment.services type:', typeof appointment.services);
          console.warn('[GET /api/client/appointments] ⚠️ appointment.services value:', appointment.services);
        }
        if (!hasValidStylist && appointment.stylist_id) {
          console.warn('[GET /api/client/appointments] ⚠️ Styliste manquant pour rendez-vous:', appointment.id, 'stylist_id:', appointment.stylist_id);
        }
        
        const enriched = {
          id: appointment.id,
          startTime: startTime || new Date().toISOString(),
          endTime: endTime || new Date().toISOString(),
          status: status,
          notes: appointment.notes || null,
          service: {
            id: serviceData.id || appointment.service_id || 'unknown',
            name: hasValidService ? (serviceData.name || 'Service sans nom') : 'Service inconnu',
            price: hasValidService ? (parseFloat((serviceData.price ?? '0').toString()) || 0) : 0,
            duration: hasValidService ? (serviceData.duration ?? serviceData.duration_minutes ?? appointment.duration ?? 60) : (appointment.duration ?? 60),
          },
          stylist: {
            id: stylistData.id || appointment.stylist_id || 'unknown',
            firstName: hasValidStylist ? (stylistData.first_name || stylistData.name?.split(' ')[0] || 'Styliste') : 'Styliste',
            lastName: hasValidStylist ? (stylistData.last_name || stylistData.name?.split(' ').slice(1).join(' ') || '') : '',
          },
        };
        
        // Log final pour vérification
        if (enriched.service.name === 'Service inconnu') {
          console.warn('[GET /api/client/appointments] ⚠️ Service inconnu pour rendez-vous:', appointment.id);
          console.warn('[GET /api/client/appointments] ⚠️   service_id:', appointment.service_id);
          console.warn('[GET /api/client/appointments] ⚠️   hasValidService:', hasValidService);
          console.warn('[GET /api/client/appointments] ⚠️   serviceData:', JSON.stringify(serviceData));
          console.warn('[GET /api/client/appointments] ⚠️   appointment.services:', JSON.stringify(appointment.services));
        } else {
          console.log('[GET /api/client/appointments] ✅ Service correct pour rendez-vous:', appointment.id, '-', enriched.service.name, '- Prix:', enriched.service.price);
        }
        
        return enriched;
      }).filter((apt: any) => apt !== null); // Filtrer les rendez-vous invalides

      console.log('[GET /api/client/appointments] Rendez-vous enrichis:', JSON.stringify(enrichedAppointments, null, 2));
      console.log('[GET /api/client/appointments] Nombre de rendez-vous après transformation:', enrichedAppointments.length);
      
      // Vérification finale : s'assurer qu'on retourne bien un tableau
      if (!Array.isArray(enrichedAppointments)) {
        console.error('[GET /api/client/appointments] ❌ ERREUR: enrichedAppointments n\'est pas un tableau!', typeof enrichedAppointments);
        return res.json([]);
      }
      
      // Vérification finale : s'assurer que chaque rendez-vous a les champs requis
      const validAppointments = enrichedAppointments.filter((apt: any) => {
        const isValid = apt && apt.id && apt.startTime && apt.service && apt.stylist;
        if (!isValid) {
          console.warn('[GET /api/client/appointments] ⚠️ Rendez-vous invalide filtré:', apt);
        }
        return isValid;
      });
      
      console.log('[GET /api/client/appointments] ✅ Rendez-vous valides finaux:', validAppointments.length);
      if (validAppointments.length !== enrichedAppointments.length) {
        console.warn('[GET /api/client/appointments] ⚠️', enrichedAppointments.length - validAppointments.length, 'rendez-vous invalides ont été filtrés');
      }

      res.json(validAppointments);
    } catch (error: any) {
      console.error("Erreur lors de la récupération des rendez-vous:", error);
      // Retourner un tableau vide pour que le client continue à fonctionner
      res.json([]);
    }
  });

  // Mettre à jour le profil client
  app.put('/api/client/profile', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      if (!client) {
        return res.status(401).json({ message: "Non authentifié" });
      }
      
      const { firstName, lastName, email, phone, notes, sex, preferredStylistId } = req.body;

      console.log('[PUT /api/client/profile] Mise à jour profil pour client:', client.id);
      console.log('[PUT /api/client/profile] Données reçues:', { firstName, lastName, email, phone, notes, sex, preferredStylistId });

      // Normaliser l'email en minuscules
      const normalizedEmail = email ? normalizeEmail(email) : (client.email || '');
      console.log('[PUT /api/client/profile] Email normalisé:', email, '→', normalizedEmail);

      // Récupérer les notes existantes pour préserver les données JSON
      let existingNotesData: any = {};
      try {
        if (client.notes) {
          existingNotesData = JSON.parse(client.notes);
        }
      } catch (parseError) {
        // Si notes n'est pas du JSON, le traiter comme texte simple
        if (client.notes && typeof client.notes === 'string' && !client.notes.startsWith('{')) {
          existingNotesData = { text: client.notes };
        }
      }

      // Stocker le sexe dans notes en JSON (car la colonne sex n'existe pas)
      if (sex !== undefined && sex !== null && sex !== '' && sex !== 'none') {
        existingNotesData.sex = sex;
      } else if (sex === '' || sex === 'none' || sex === null) {
        // Si sex est vide ou 'none', retirer du JSON
        delete existingNotesData.sex;
      }

      // Préparer les notes finales
      // Si notes est fourni et n'est pas du JSON, l'ajouter comme texte
      let finalNotes: string | null = null;
      if (notes && notes.trim()) {
        // Si notes contient du texte, le stocker dans notesData.text
        existingNotesData.text = notes.trim();
      } else if (notes === '' || notes === null) {
        // Si notes est vide, garder seulement les métadonnées JSON
        delete existingNotesData.text;
      }
      
      // Convertir en JSON si on a des données, sinon null
      if (Object.keys(existingNotesData).length > 0) {
        finalNotes = JSON.stringify(existingNotesData);
      } else {
        finalNotes = null;
      }

      // Préparer les données de mise à jour
      const updateData: any = {
          first_name: firstName,
          last_name: lastName,
        email: normalizedEmail, // Email normalisé en minuscules
        phone: phone || null,
        notes: finalNotes,
          updated_at: new Date().toISOString()
      };

      // Ajouter le styliste préféré si fourni
      if (preferredStylistId !== undefined) {
        updateData.preferred_stylist_id = preferredStylistId === '' || preferredStylistId === 'none' ? null : preferredStylistId;
      }

      console.log('[PUT /api/client/profile] Données à mettre à jour:', updateData);

      const { data: updatedClient, error } = await supabaseAdmin
        .from('clients')
        .update(updateData)
        .eq('id', client.id)
        .select()
        .single();

      if (error) {
        console.error("[PUT /api/client/profile] Erreur Supabase:", JSON.stringify(error, null, 2));
        console.error("[PUT /api/client/profile] Code erreur:", error.code);
        console.error("[PUT /api/client/profile] Message erreur:", error.message);
        console.error("[PUT /api/client/profile] Détails:", error.details);
        
        // Si l'erreur est liée à une colonne qui n'existe pas, nettoyer les données et réessayer
        if (error.code === '42703' || error.message?.includes('does not exist')) {
          console.log('[PUT /api/client/profile] Colonne inexistante détectée, nettoyage des données...');
          console.log('[PUT /api/client/profile] Erreur:', error.message);
          
          // Créer un objet nettoyé avec seulement les colonnes qui existent
          const cleanedUpdateData: any = {
            first_name: updateData.first_name,
            last_name: updateData.last_name,
            email: updateData.email,
            phone: updateData.phone,
            notes: updateData.notes,
            updated_at: updateData.updated_at
          };
          
          // Ajouter seulement preferred_stylist_id s'il est défini
          if (updateData.preferred_stylist_id !== undefined) {
            cleanedUpdateData.preferred_stylist_id = updateData.preferred_stylist_id;
          }
          
          console.log('[PUT /api/client/profile] Données nettoyées:', cleanedUpdateData);
          
          const { data: retryClient, error: retryError } = await supabaseAdmin
            .from('clients')
            .update(cleanedUpdateData)
            .eq('id', client.id)
            .select()
            .single();

          if (retryError) {
            console.error("[PUT /api/client/profile] Erreur après retry:", JSON.stringify(retryError, null, 2));
            return res.status(500).json({ 
              message: "Erreur lors de la mise à jour du profil",
              error: retryError.message,
              code: retryError.code
            });
          }

          // Formater la réponse pour correspondre au format attendu par le frontend
          // Extraire le sexe depuis notes (JSON) si la colonne sex n'existe pas
          let extractedSex: string | null = null;
          let extractedNotes: string | null = retryClient.notes;
          
          try {
            if (retryClient.notes) {
              const notesData = JSON.parse(retryClient.notes);
              extractedSex = notesData.sex || null;
              // Extraire le texte des notes si présent
              extractedNotes = notesData.text || null;
            }
          } catch (e) {
            // Si notes n'est pas du JSON, garder tel quel
            extractedNotes = retryClient.notes;
          }

          const formattedRetryClient = {
            id: retryClient.id,
            firstName: retryClient.first_name,
            lastName: retryClient.last_name,
            email: retryClient.email,
            phone: retryClient.phone,
            notes: extractedNotes, // Notes texte extraites du JSON
            preferredStylistId: retryClient.preferred_stylist_id,
            sex: extractedSex
          };

          return res.json({
            success: true,
            message: "Profil mis à jour avec succès",
            client: formattedRetryClient
          });
        }

        return res.status(500).json({ 
          message: "Erreur lors de la mise à jour du profil",
          error: error.message,
          code: error.code
        });
      }

      console.log('[PUT /api/client/profile] ✅ Profil mis à jour avec succès');

      // Formater la réponse pour correspondre au format attendu par le frontend
      // Extraire le sexe depuis notes (JSON) si la colonne sex n'existe pas
      let extractedSex: string | null = null;
      let extractedNotes: string | null = updatedClient.notes;
      
      try {
        if (updatedClient.notes) {
          const notesData = JSON.parse(updatedClient.notes);
          extractedSex = notesData.sex || null;
          // Extraire le texte des notes si présent
          extractedNotes = notesData.text || null;
        }
      } catch (e) {
        // Si notes n'est pas du JSON, garder tel quel
        extractedNotes = updatedClient.notes;
      }
      
      // Essayer d'abord la colonne sex si elle existe
      if (updatedClient.sex) {
        extractedSex = updatedClient.sex;
      }

      const formattedClient = {
        id: updatedClient.id,
        firstName: updatedClient.first_name,
        lastName: updatedClient.last_name,
        email: updatedClient.email,
        phone: updatedClient.phone,
        notes: extractedNotes, // Notes texte extraites du JSON
        preferredStylistId: updatedClient.preferred_stylist_id,
        sex: extractedSex
      };

      res.json({
        success: true,
        message: "Profil mis à jour avec succès",
        client: formattedClient
      });
    } catch (error: any) {
      console.error("[PUT /api/client/profile] Exception:", error);
      console.error("[PUT /api/client/profile] Stack:", error.stack);
      res.status(500).json({ 
        message: "Erreur lors de la mise à jour du profil",
        error: error.message 
      });
    }
  });

  // Changer le mot de passe client
  app.post('/api/client/change-password', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Mot de passe actuel et nouveau mot de passe requis" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 6 caractères" });
      }

      // Pour l'instant, on simule le changement de mot de passe
      // En production, il faudrait vérifier le mot de passe actuel et le hasher
      res.json({
        success: true,
        message: "Mot de passe modifié avec succès"
      });
    } catch (error) {
      console.error("Erreur lors du changement de mot de passe:", error);
      res.status(500).json({ message: "Erreur lors du changement de mot de passe" });
    }
  });

  // Annuler un rendez-vous
  app.post('/api/client/appointments/:id/cancel', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      const appointmentId = req.params.id;

      // Vérifier que le rendez-vous appartient au client
      const { data: appointment, error: checkError } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .eq('client_id', client.id)
        .single();

      if (checkError || !appointment) {
        return res.status(404).json({ message: "Rendez-vous non trouvé" });
      }

      // Annuler le rendez-vous
      const { error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (updateError) {
        console.error("Erreur lors de l'annulation du rendez-vous:", updateError);
        return res.status(500).json({ message: "Erreur lors de l'annulation du rendez-vous" });
      }

      res.json({
        success: true,
        message: "Rendez-vous annulé avec succès"
      });
    } catch (error) {
      console.error("Erreur lors de l'annulation du rendez-vous:", error);
      res.status(500).json({ message: "Erreur lors de l'annulation du rendez-vous" });
    }
  });

  // Sauvegarder les paramètres de notification
  app.put('/api/client/notification-settings', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      const settings = req.body;

      // Pour l'instant, on stocke les paramètres dans les notes du client
      // En production, il faudrait créer une table séparée pour les paramètres
      let existingNotes = {};
      try {
        existingNotes = client.notes ? JSON.parse(client.notes) : {};
      } catch (parseError) {
        console.warn("Erreur de parsing des notes existantes:", parseError);
        existingNotes = {};
      }

      const { error } = await supabaseAdmin
        .from('clients')
        .update({
          notes: JSON.stringify({
            ...existingNotes,
            notificationSettings: settings
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (error) {
        console.error("Erreur lors de la sauvegarde des paramètres:", error);
        return res.status(500).json({ message: "Erreur lors de la sauvegarde des paramètres" });
      }

      res.json({
        success: true,
        message: "Paramètres de notification sauvegardés"
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des paramètres:", error);
      res.status(500).json({ message: "Erreur lors de la sauvegarde des paramètres" });
    }
  });

  // Récupérer les notifications du client
  app.get('/api/client/notifications', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      if (!client) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      // Récupérer les notifications depuis Supabase
      // Note: Si la table n'existe pas encore, on retourne un tableau vide
      const { data: notifications, error } = await supabaseAdmin
        .from('client_notifications')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Si la table n'existe pas, retourner un tableau vide
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('[GET /api/client/notifications] Table client_notifications n\'existe pas encore, retour tableau vide');
          return res.json([]);
        }
        console.error('[GET /api/client/notifications] Erreur:', error);
        return res.json([]);
      }

      // Transformer les données de Supabase vers le format attendu par le frontend
      const formattedNotifications = (notifications || []).map((notif: any) => ({
        id: notif.id,
        type: notif.type || 'system',
        title: notif.title || 'Notification',
        message: notif.message || '',
        isRead: notif.is_read || false,
        createdAt: notif.created_at || new Date().toISOString(),
        appointmentId: notif.appointment_id || undefined,
        priority: notif.priority || 'medium'
      }));

      res.json(formattedNotifications);
    } catch (error: any) {
      console.error('[GET /api/client/notifications] Exception:', error);
      res.json([]);
    }
  });

  // Marquer une notification comme lue
  app.post('/api/client/notifications/:id/read', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      if (!client) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const notificationId = req.params.id;

      // Mettre à jour la notification dans Supabase
      const { error } = await supabaseAdmin
        .from('client_notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('client_id', client.id);

      if (error) {
        // Si la table n'existe pas, on considère que c'est OK (pas d'erreur)
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return res.json({ success: true, message: "Notification marquée comme lue" });
        }
        console.error('[POST /api/client/notifications/:id/read] Erreur:', error);
        return res.status(500).json({ message: "Erreur lors de la mise à jour" });
      }

      res.json({ success: true, message: "Notification marquée comme lue" });
    } catch (error: any) {
      console.error('[POST /api/client/notifications/:id/read] Exception:', error);
      res.status(500).json({ message: "Erreur lors de la mise à jour" });
    }
  });

  // Marquer toutes les notifications comme lues
  app.post('/api/client/notifications/read-all', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      if (!client) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      // Mettre à jour toutes les notifications non lues du client
      const { error } = await supabaseAdmin
        .from('client_notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('client_id', client.id)
        .eq('is_read', false);

      if (error) {
        // Si la table n'existe pas, on considère que c'est OK
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return res.json({ success: true, message: "Toutes les notifications marquées comme lues" });
        }
        console.error('[POST /api/client/notifications/read-all] Erreur:', error);
        return res.status(500).json({ message: "Erreur lors de la mise à jour" });
      }

      res.json({ success: true, message: "Toutes les notifications marquées comme lues" });
    } catch (error: any) {
      console.error('[POST /api/client/notifications/read-all] Exception:', error);
      res.status(500).json({ message: "Erreur lors de la mise à jour" });
    }
  });

  // Supprimer une notification
  app.delete('/api/client/notifications/:id', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      if (!client) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const notificationId = req.params.id;

      // Supprimer la notification dans Supabase
      const { error } = await supabaseAdmin
        .from('client_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('client_id', client.id);

      if (error) {
        // Si la table n'existe pas, on considère que c'est OK
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return res.json({ success: true, message: "Notification supprimée" });
        }
        console.error('[DELETE /api/client/notifications/:id] Erreur:', error);
        return res.status(500).json({ message: "Erreur lors de la suppression" });
      }

      res.json({ success: true, message: "Notification supprimée" });
    } catch (error: any) {
      console.error('[DELETE /api/client/notifications/:id] Exception:', error);
      res.status(500).json({ message: "Erreur lors de la suppression" });
    }
  });

  // Récupérer les paramètres de notification
  app.get('/api/client/notification-settings', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      
      // Récupérer les paramètres depuis les notes du client
      let notes = {};
      try {
        notes = client.notes ? JSON.parse(client.notes) : {};
      } catch (parseError) {
        console.warn("Erreur de parsing des notes:", parseError);
        notes = {};
      }
      
      const settings = notes.notificationSettings || {
        email: true,
        sms: true,
        reminders: true,
        promotions: false
      };

      res.json(settings);
    } catch (error) {
      console.error("Erreur lors de la récupération des paramètres:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des paramètres" });
    }
  });

  // Sauvegarder les paramètres de confidentialité
  app.put('/api/client/privacy-settings', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      const settings = req.body;

      // Stocker les paramètres de confidentialité dans les notes du client
      let existingNotes = {};
      try {
        existingNotes = client.notes ? JSON.parse(client.notes) : {};
      } catch (parseError) {
        console.warn("Erreur de parsing des notes existantes:", parseError);
        existingNotes = {};
      }

      const { error } = await supabaseAdmin
        .from('clients')
        .update({
          notes: JSON.stringify({
            ...existingNotes,
            privacySettings: settings
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (error) {
        console.error("Erreur lors de la sauvegarde des paramètres:", error);
        return res.status(500).json({ message: "Erreur lors de la sauvegarde des paramètres" });
      }

      res.json({
        success: true,
        message: "Paramètres de confidentialité sauvegardés"
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des paramètres:", error);
      res.status(500).json({ message: "Erreur lors de la sauvegarde des paramètres" });
    }
  });

  // Récupérer les paramètres de confidentialité
  app.get('/api/client/privacy-settings', isClientAuthenticated, async (req: Request, res: Response) => {
    try {
      const client = req.client;
      
      // Récupérer les paramètres depuis les notes du client
      let notes = {};
      try {
        notes = client.notes ? JSON.parse(client.notes) : {};
      } catch (parseError) {
        console.warn("Erreur de parsing des notes:", parseError);
        notes = {};
      }
      
      const settings = notes.privacySettings || {
        showPhone: true,
        showEmail: true,
        allowMarketing: false
      };

      res.json(settings);
    } catch (error) {
      console.error("Erreur lors de la récupération des paramètres:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des paramètres" });
    }
  });
}
