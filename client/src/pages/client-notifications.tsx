import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { 
  Bell, 
  BellOff, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Settings,
  Trash2,
  CheckCheck
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuthContext } from "@/contexts/AuthContext";
import { withClientAuth } from "@/components/withClientAuth";
import ClientNavigation from "@/components/client-navigation";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: 'appointment' | 'reminder' | 'promotion' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  appointmentId?: string;
  priority: 'low' | 'medium' | 'high';
}

interface NotificationSettings {
  email: boolean;
  sms: boolean;
  reminders: boolean;
  promotions: boolean;
}

function ClientNotifications() {
  const [, setLocation] = useLocation();
  const { client } = useAuthContext();
  const { toast } = useToast();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    email: true,
    sms: true,
    reminders: true,
    promotions: false
  });

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch("/api/client/notifications", {
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des notifications");
      }

      const data = await response.json();
      setNotifications(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des notifications:", error);
      // En cas d'erreur, garder un tableau vide plutôt que des données mockées
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/client/notification-settings", {
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object') {
          setSettings(prev => ({
            ...prev,
            ...data
          }));
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement des paramètres:", error);
    }
  };

  useEffect(() => {
    if (client?.id) {
      loadNotifications();
      loadSettings();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);


  const markAsRead = async (notificationId: string) => {
    try {
      // Mettre à jour l'état local immédiatement pour un feedback rapide
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      
      // Sauvegarder en base de données
      const response = await fetch(`/api/client/notifications/${notificationId}/read`, {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde");
      }

      toast({
        title: "Notification marquée comme lue",
        description: "La notification a été mise à jour.",
      });
    } catch (error) {
      // En cas d'erreur, restaurer l'état précédent
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: false }
            : notif
        )
      );
      toast({
        title: "Erreur",
        description: "Impossible de marquer la notification comme lue.",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    // Sauvegarder l'état précédent pour pouvoir le restaurer en cas d'erreur
    const previousState = [...notifications];
    
    try {
      // Mettre à jour l'état local immédiatement pour un feedback rapide
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      // Sauvegarder en base de données
      const response = await fetch("/api/client/notifications/read-all", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde");
      }

      toast({
        title: "Toutes les notifications marquées comme lues",
        description: "Toutes vos notifications ont été mises à jour.",
      });
    } catch (error) {
      // En cas d'erreur, restaurer l'état précédent
      setNotifications(previousState);
      toast({
        title: "Erreur",
        description: "Impossible de marquer toutes les notifications comme lues.",
        variant: "destructive",
      });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    // Sauvegarder l'état précédent pour pouvoir le restaurer en cas d'erreur
    const previousState = [...notifications];
    
    try {
      // Mettre à jour l'état local immédiatement pour un feedback rapide
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      
      // Supprimer en base de données
      const response = await fetch(`/api/client/notifications/${notificationId}`, {
        method: "DELETE",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression");
      }

      toast({
        title: "Notification supprimée",
        description: "La notification a été supprimée.",
      });
    } catch (error) {
      // En cas d'erreur, restaurer l'état précédent
      setNotifications(previousState);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la notification.",
        variant: "destructive",
      });
    }
  };

  const saveSettings = async () => {
    try {
      const response = await fetch("/api/client/notification-settings", {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde");
      }

      toast({
        title: "Paramètres sauvegardés",
        description: "Vos préférences de notification ont été mises à jour.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = priority === 'high' ? 'text-red-500' : priority === 'medium' ? 'text-yellow-500' : 'text-blue-500';
    
    switch (type) {
      case 'appointment':
        return <Calendar className={`h-5 w-5 ${iconClass}`} />;
      case 'reminder':
        return <Clock className={`h-5 w-5 ${iconClass}`} />;
      case 'promotion':
        return <Bell className={`h-5 w-5 ${iconClass}`} />;
      case 'system':
        return <Info className={`h-5 w-5 ${iconClass}`} />;
      default:
        return <Bell className={`h-5 w-5 ${iconClass}`} />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Important</Badge>;
      case 'low':
        return <Badge className="bg-blue-100 text-blue-800">Info</Badge>;
      default:
        return null;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des notifications...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">Session expirée</p>
            <Button onClick={() => setLocation("/client-login")}>
              Se reconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
        <ClientNavigation />

        <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Notifications
              </h1>
              <p className="text-muted-foreground">
                Gérez vos notifications et préférences
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                onClick={markAllAsRead}
                variant="outline"
                className="flex items-center"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Tout marquer comme lu
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Notifications List */}
          <div className="lg:col-span-2">
            <Card className="glassmorphism-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bell className="mr-2 h-5 w-5" />
                    Mes Notifications
                    {unreadCount > 0 && (
                      <Badge className="ml-2 bg-primary text-primary-foreground">
                        {unreadCount}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <BellOff className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Aucune notification</h3>
                    <p className="text-muted-foreground">
                      Vous n'avez pas encore de notifications.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border transition-all ${
                          notification.isRead 
                            ? 'bg-muted/30 border-border/20' 
                            : 'bg-primary/5 border-primary/20 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              {getNotificationIcon(notification.type, notification.priority)}
                              <h3 className={`font-semibold ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                                {notification.title}
                              </h3>
                              {getPriorityBadge(notification.priority)}
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                              )}
                            </div>
                            
                            <p className={`text-sm mb-2 ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {notification.message}
                            </p>
                            
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(notification.createdAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                            </p>
                          </div>
                          
                          <div className="flex flex-col space-y-1 ml-4">
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                className="h-8 w-8 p-0"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(notification.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Settings */}
          <div className="lg:col-span-1">
            <Card className="glassmorphism-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  Paramètres
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Notification Types */}
                <div className="space-y-4">
                  <h4 className="font-medium">Types de notifications</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Rappels de rendez-vous</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevoir des rappels avant vos RDV
                      </p>
                    </div>
                    <Switch
                      checked={settings.reminders}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, reminders: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Promotions et offres</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevoir des offres spéciales
                      </p>
                    </div>
                    <Switch
                      checked={settings.promotions}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, promotions: checked }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                {/* Delivery Methods */}
                <div className="space-y-4">
                  <h4 className="font-medium">Moyens de réception</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notifications par email</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevoir par email
                      </p>
                    </div>
                    <Switch
                      checked={settings.email}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, email: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notifications SMS</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevoir par SMS
                      </p>
                    </div>
                    <Switch
                      checked={settings.sms}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, sms: checked }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <Button
                  onClick={saveSettings}
                  className="w-full"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Sauvegarder les paramètres
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
  );
}

// Exporter avec le HOC de protection
export default withClientAuth(ClientNotifications);
