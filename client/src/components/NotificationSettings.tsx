import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Save, Mail, MessageSquare, Clock, Info, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NotificationSettings {
  confirmationEmailSubject: string;
  confirmationEmailText: string; // Nouveau : texte simple (sans HTML)
  confirmationEmailHtml?: string; // Optionnel : généré automatiquement côté serveur
  confirmationSmsText: string;
  reminderSmsText: string;
  reminderOffsetHours: number;
}

const AVAILABLE_PLACEHOLDERS = [
  { key: '{{client_first_name}}', description: 'Prénom du client' },
  { key: '{{client_full_name}}', description: 'Nom complet du client' },
  { key: '{{appointment_date}}', description: 'Date du rendez-vous (ex: "mardi 25 novembre 2025 à 14:00")' },
  { key: '{{appointment_time}}', description: 'Heure du rendez-vous (ex: "14:00")' },
  { key: '{{service_name}}', description: 'Nom du service' },
  { key: '{{salon_name}}', description: 'Nom du salon' },
  { key: '{{stylist_name}}', description: 'Nom du coiffeur/coiffeuse' },
];

export default function NotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<NotificationSettings>({
    confirmationEmailSubject: '',
    confirmationEmailText: '',
    confirmationSmsText: '',
    reminderSmsText: '',
    reminderOffsetHours: 24,
  });

  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');

  // Charger les settings depuis l'API
  // ⚠️ IMPORTANT: staleTime: 0 pour toujours recharger depuis le serveur
  // et ne pas utiliser de cache local qui pourrait contenir de vieilles valeurs
  const { data, isLoading } = useQuery<NotificationSettings>({
    queryKey: ['/api/owner/notification-settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/owner/notification-settings');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des paramètres');
      }
      const result = await response.json();
      console.log('[NotificationSettings] Données reçues de l\'API GET:', {
        confirmationEmailSubject: result.confirmationEmailSubject ? `[${result.confirmationEmailSubject.length} chars]` : 'VIDE/NULL',
        confirmationEmailText: result.confirmationEmailText ? `[${result.confirmationEmailText.length} chars]` : 'VIDE/NULL',
        confirmationSmsText: result.confirmationSmsText ? `[${result.confirmationSmsText.length} chars]` : 'VIDE/NULL',
      });
      return result;
    },
    retry: 1,
    staleTime: 0, // Toujours considérer les données comme obsolètes pour forcer le rechargement
    cacheTime: 0, // Ne pas mettre en cache côté client pour éviter les valeurs obsolètes
  });

  // Mettre à jour l'état local quand les données sont chargées
  useEffect(() => {
    if (data) {
      console.log('[NotificationSettings] useEffect - Données chargées depuis l\'API:', {
        confirmationEmailSubject: data.confirmationEmailSubject ? `[${data.confirmationEmailSubject.length} chars] "${data.confirmationEmailSubject.length > 50 ? data.confirmationEmailSubject.substring(0, 50) + '...' : data.confirmationEmailSubject}"` : 'VIDE/NULL',
        confirmationEmailText: data.confirmationEmailText ? `[${data.confirmationEmailText.length} chars] "${data.confirmationEmailText.length > 50 ? data.confirmationEmailText.substring(0, 50) + '...' : data.confirmationEmailText}"` : 'VIDE/NULL',
        confirmationSmsText: data.confirmationSmsText ? `[${data.confirmationSmsText.length} chars]` : 'VIDE/NULL',
      });
      setSettings({
        confirmationEmailSubject: data.confirmationEmailSubject ?? '',
        confirmationEmailText: data.confirmationEmailText ?? '',
        confirmationSmsText: data.confirmationSmsText ?? '',
        reminderSmsText: data.reminderSmsText ?? '',
        reminderOffsetHours: data.reminderOffsetHours ?? 24,
      });
    }
  }, [data]);

  // Mutation pour sauvegarder les settings
  const saveMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      const response = await apiRequest('PUT', '/api/owner/notification-settings', newSettings);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Erreur lors de la sauvegarde');
      }
      return response.json();
    },
    onSuccess: async (data) => {
      // Mettre à jour immédiatement le state avec les données retournées par le serveur
      // pour éviter d'afficher les anciennes valeurs pendant le rechargement
      // ⚠️ IMPORTANT: Utiliser ?? au lieu de || pour préserver les chaînes vides valides
      if (data) {
        console.log('[NotificationSettings] onSuccess - Données reçues du serveur:', {
          confirmationEmailSubject: data.confirmationEmailSubject ? `[${data.confirmationEmailSubject.length} chars]` : 'VIDE/NULL',
          confirmationEmailText: data.confirmationEmailText ? `[${data.confirmationEmailText.length} chars]` : 'VIDE/NULL',
          confirmationSmsText: data.confirmationSmsText ? `[${data.confirmationSmsText.length} chars]` : 'VIDE/NULL',
        });
        setSettings({
          confirmationEmailSubject: data.confirmationEmailSubject ?? '',
          confirmationEmailText: data.confirmationEmailText ?? '',
          confirmationSmsText: data.confirmationSmsText ?? '',
          reminderSmsText: data.reminderSmsText ?? '',
          reminderOffsetHours: data.reminderOffsetHours ?? 24,
        });
      }
      
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les templates de notifications ont été mis à jour avec succès.',
      });
      
      // Invalider et recharger depuis le serveur pour être sûr d'avoir les bonnes valeurs
      await queryClient.invalidateQueries({ queryKey: ['/api/owner/notification-settings'] });
      queryClient.refetchQueries({ queryKey: ['/api/owner/notification-settings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder les paramètres.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    console.log('[NotificationSettings] handleSave - Données à sauvegarder:', {
      confirmationEmailSubject: settings.confirmationEmailSubject ? `[${settings.confirmationEmailSubject.length} chars] "${settings.confirmationEmailSubject}"` : 'VIDE',
      confirmationEmailText: settings.confirmationEmailText ? `[${settings.confirmationEmailText.length} chars] "${settings.confirmationEmailText.length > 50 ? settings.confirmationEmailText.substring(0, 50) + '...' : settings.confirmationEmailText}"` : 'VIDE',
      confirmationSmsText: settings.confirmationSmsText ? `[${settings.confirmationSmsText.length} chars]` : 'VIDE',
    });
    saveMutation.mutate(settings);
  };

  // Mutation pour envoyer un email de test
  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', '/api/owner/notifications/send-test-email', { testEmail: email });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Erreur lors de l\'envoi de l\'email de test');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Email de test envoyé',
        description: `L'email de test a été envoyé à ${data.to}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'envoyer l\'email de test.',
        variant: 'destructive',
      });
    },
  });

  const handleSendTestEmail = () => {
    if (!testEmail.trim()) {
      toast({
        title: 'Email requis',
        description: 'Veuillez saisir une adresse email de test.',
        variant: 'destructive',
      });
      return;
    }
    sendTestEmailMutation.mutate(testEmail.trim());
  };

  // Mutation pour envoyer un SMS de test
  const sendTestSmsMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await apiRequest('POST', '/api/owner/notifications/send-test-sms', { 
        to: phone,
        message: 'Test SMS depuis SalonPilot - Vérification de la configuration'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Erreur lors de l\'envoi du SMS de test');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'SMS de test envoyé',
        description: data.metadata?.dryRun 
          ? 'SMS loggé en mode DRY RUN (pas réellement envoyé). Vérifiez les logs du serveur.'
          : `Le SMS de test a été envoyé à ${data.to}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'envoyer le SMS de test.',
        variant: 'destructive',
      });
    },
  });

  const handleSendTestSms = () => {
    if (!testPhone.trim()) {
      toast({
        title: 'Numéro requis',
        description: 'Veuillez saisir un numéro de téléphone de test (format: +41791234567).',
        variant: 'destructive',
      });
      return;
    }
    sendTestSmsMutation.mutate(testPhone.trim());
  };

  const insertPlaceholder = (field: keyof NotificationSettings, placeholder: string) => {
    if (field === 'reminderOffsetHours') return; // Pas de placeholder pour ce champ
    
    // Pour confirmationEmailText, insérer le placeholder à la position du curseur
    if (field === 'confirmationEmailText') {
      const textarea = document.getElementById('emailText') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = settings.confirmationEmailText;
        const newText = text.substring(0, start) + placeholder + text.substring(end);
        setSettings(prev => ({ ...prev, confirmationEmailText: newText }));
        // Remettre le focus et la position du curseur
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
        return;
      }
    }
    
    setSettings(prev => ({
      ...prev,
      [field]: (prev[field] as string) + placeholder,
    }));
  };

  if (isLoading) {
    return (
      <Card className="glassmorphism-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glassmorphism-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Configurez les templates d'emails et SMS ainsi que le délai d'envoi des rappels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email de confirmation */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Email de confirmation</h3>
          </div>
          
          <div>
            <Label htmlFor="emailSubject">Sujet de l'email</Label>
            <Input
              id="emailSubject"
              value={settings.confirmationEmailSubject}
              onChange={(e) => setSettings(prev => ({ ...prev, confirmationEmailSubject: e.target.value }))}
              placeholder="Confirmation de votre rendez-vous chez {{salon_name}}"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="emailText">Contenu de l'email</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Écrivez votre message en texte simple. Le HTML sera généré automatiquement.
              Utilisez des sauts de ligne pour créer des paragraphes.
            </p>
            <Textarea
              id="emailText"
              value={settings.confirmationEmailText}
              onChange={(e) => setSettings(prev => ({ ...prev, confirmationEmailText: e.target.value }))}
              placeholder="Bonjour {{client_full_name}},

Votre rendez-vous a été confirmé avec succès !

Salon : {{salon_name}}
Service : {{service_name}}
Coiffeur·euse : {{stylist_name}}
Date et heure : {{appointment_date}} à {{appointment_time}}

Nous avons hâte de vous accueillir !"
              rows={12}
              className="mt-1"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_PLACEHOLDERS.map(ph => (
                <Button
                  key={ph.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertPlaceholder('confirmationEmailText', ph.key)}
                  className="text-xs"
                >
                  {ph.key}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* SMS de confirmation */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">SMS de confirmation</h3>
          </div>
          
          <div>
            <Label htmlFor="smsText">Message SMS</Label>
            <Textarea
              id="smsText"
              value={settings.confirmationSmsText}
              onChange={(e) => setSettings(prev => ({ ...prev, confirmationSmsText: e.target.value }))}
              placeholder="Bonjour {{client_first_name}}, votre rendez-vous {{service_name}} chez {{salon_name}} est confirmé le {{appointment_date}} à {{appointment_time}}."
              rows={4}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {settings.confirmationSmsText.length} caractères (recommandé: max 160)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_PLACEHOLDERS.map(ph => (
                <Button
                  key={ph.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertPlaceholder('confirmationSmsText', ph.key)}
                  className="text-xs"
                >
                  {ph.key}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* SMS de rappel */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">SMS de rappel</h3>
          </div>
          
          <div>
            <Label htmlFor="reminderSmsText">Message SMS de rappel</Label>
            <Textarea
              id="reminderSmsText"
              value={settings.reminderSmsText}
              onChange={(e) => setSettings(prev => ({ ...prev, reminderSmsText: e.target.value }))}
              placeholder="Rappel : votre rendez-vous {{service_name}} chez {{salon_name}} est prévu le {{appointment_date}} à {{appointment_time}}."
              rows={4}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {settings.reminderSmsText.length} caractères (recommandé: max 160)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_PLACEHOLDERS.map(ph => (
                <Button
                  key={ph.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertPlaceholder('reminderSmsText', ph.key)}
                  className="text-xs"
                >
                  {ph.key}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Délai du rappel */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Délai d'envoi du rappel</h3>
          </div>
          
          <div>
            <Label htmlFor="reminderOffset">Envoyer le rappel</Label>
            <Select
              value={settings.reminderOffsetHours.toString()}
              onValueChange={(value) => setSettings(prev => ({ ...prev, reminderOffsetHours: parseInt(value, 10) }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 heures avant</SelectItem>
                <SelectItem value="24">24 heures avant</SelectItem>
                <SelectItem value="48">48 heures avant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Aide sur les placeholders */}
        <div className="space-y-2 rounded-lg bg-muted p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Placeholders disponibles</h4>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            {AVAILABLE_PLACEHOLDERS.map(ph => (
              <li key={ph.key}>
                <code className="bg-background px-1 py-0.5 rounded">{ph.key}</code> : {ph.description}
              </li>
            ))}
          </ul>
        </div>

        {/* Bouton de sauvegarde */}
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {saveMutation.isPending ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer les paramètres
            </>
          )}
        </Button>

        <Separator />

        {/* Section Email de test */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Envoyer un email de test</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Testez vos templates en envoyant un email de confirmation factice avec des données de test.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="votre-email@exemple.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleSendTestEmail}
              disabled={sendTestEmailMutation.isPending || !testEmail.trim()}
              variant="outline"
            >
              {sendTestEmailMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Section SMS de test */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Envoyer un SMS de test</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Testez l'envoi de SMS directement. Si SMS_DRY_RUN=true, le SMS sera loggé mais pas envoyé (vérifiez les logs du serveur).
          </p>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="+41791234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleSendTestSms}
              disabled={sendTestSmsMutation.isPending || !testPhone.trim()}
              variant="outline"
            >
              {sendTestSmsMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Envoi...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Format: +41791234567 (E.164 international). Vérifiez les logs du serveur pour voir le résultat.
          </p>
        </div>

        <Separator />
      </CardContent>
    </Card>
  );
}



