import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Brain, Clock, Shield, Send, Scissors, Home } from "lucide-react";
import FloatingChatbot from "@/components/floating-chatbot";

type ChatMessage = { 
  type: 'user' | 'ai', 
  message: string,
  timestamp: Date 
};

export default function Voice() {
  const [, setLocation] = useLocation();
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fonction pour obtenir ou créer un sessionId
  function getSessionId() {
    let id = localStorage.getItem("sp_session_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      localStorage.setItem("sp_session_id", id);
    }
    return id;
  }

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  // Utiliser un conteneur ref pour scroller uniquement la zone de chat, pas la page entière
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Toujours scroller vers le bas quand la conversation change (nouveau message)
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Utiliser scrollTo au lieu de scrollIntoView pour éviter de scroller la page entière
      // Utiliser setTimeout pour s'assurer que le DOM est mis à jour
      setTimeout(() => {
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
          });
        }
      }, 100);
    }
  }, [conversation]);

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) {
      console.warn('Message vide, ignoré');
      return;
    }

    console.log('[Voice] Envoi message:', message);

    const userMessage: ChatMessage = {
      type: 'user',
      message: message.trim(),
      timestamp: new Date()
    };

    setConversation(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      // Envoyer le message à l'IA
      const response = await fetch("/api/voice-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include', // Inclure les cookies
        body: JSON.stringify({ 
          message: message.trim(), 
          sessionId: getSessionId()
        }),
      });

      let aiResponse = "Désolé, j'ai eu un souci. On reprend : quel jour vous arrange ?";
      
      if (response.ok) {
        try {
          const data = await response.json();
          console.log('[Voice] Réponse reçue:', data);
          aiResponse = data.reply || data.message || "Bonjour ! Comment puis-je vous aider ?";
          console.log('[Voice] Réponse AI:', aiResponse);
        } catch (parseError) {
          console.error('Erreur lors du parsing JSON:', parseError);
          const textResponse = await response.text();
          console.error('Réponse texte:', textResponse);
          aiResponse = "Désolé, la réponse du serveur n'est pas au bon format. Veuillez réessayer.";
        }
      } else {
        console.error('[Voice] Réponse non OK:', response.status, response.statusText);
        // Si la réponse n'est pas OK, essayer de lire le message d'erreur
        try {
          const errorData = await response.json();
          aiResponse = errorData.message || errorData.error || `Erreur ${response.status}: ${response.statusText}`;
        } catch (parseError) {
          aiResponse = `Erreur ${response.status}: ${response.statusText}. Veuillez réessayer.`;
        }
        console.error('Erreur HTTP:', response.status, response.statusText);
      }

      const aiMessage: ChatMessage = {
        type: 'ai',
        message: aiResponse,
        timestamp: new Date()
      };

      setConversation(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      const errorMessage: ChatMessage = {
        type: 'ai',
        message: error instanceof Error ? `Erreur: ${error.message}` : "Désolé, j'ai eu un souci. On reprend : quel jour vous arrange ?",
        timestamp: new Date()
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async () => {
    const message = textInput.trim();
    console.log('[Voice] handleTextSubmit appelé, message:', message, 'textInput:', textInput);
    if (!message) {
      console.warn('[Voice] Message vide, abandon');
      return;
    }
    
    if (isProcessing) {
      console.warn('[Voice] Une requête est déjà en cours, attente...');
      return;
    }
    
    // Réinitialiser le champ avant d'envoyer
    setTextInput("");
    await handleUserMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header avec logo */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center space-x-3 text-foreground hover:text-primary transition-colors group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                <Scissors className="text-white text-sm" />
              </div>
              <span className="text-xl font-bold">SalonPilot</span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-primary"
            >
              <Home className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Réceptionniste IA
            </h1>
            <p className="text-lg text-muted-foreground">
              Réservez votre rendez-vous en écrivant
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {/* Conversation History */}
            <Card className="glassmorphism-card shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-foreground">
                  <Brain className="mr-2 h-5 w-5 text-primary" />
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={messagesContainerRef}
                  className="space-y-4 max-h-[500px] overflow-y-auto mb-4 pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
                >
                  {conversation.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Brain className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-xl font-semibold text-foreground mb-2">Bonjour ! Comment puis-je vous aider ?</p>
                      <p className="text-sm">Tapez votre message ci-dessous pour commencer la conversation</p>
                    </div>
                  ) : (
                    conversation.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                      >
                        <div
                          className={`max-w-[75%] sm:max-w-xs p-4 rounded-2xl shadow-sm ${
                            message.type === 'user'
                              ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
                              : 'bg-muted/80 text-foreground rounded-bl-md border border-border/50'
                          }`}
                          data-testid={`message-${message.type}-${index}`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {isProcessing && (
                    <div className="flex justify-start animate-in fade-in duration-200">
                      <div className="bg-muted/80 text-foreground rounded-2xl rounded-bl-md p-4 border border-border/50 shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                          <span className="text-sm">L'IA réfléchit...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Élément invisible à la fin pour le scroll */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Text Input */}
                <div className="flex gap-3 pt-4 border-t border-border/50">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      console.log('[Voice] Input onChange, nouvelle valeur:', newValue);
                      setTextInput(newValue);
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder="Tapez votre message ici..."
                    disabled={isProcessing}
                    className="flex-1 h-10 rounded-md border-2 border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary transition-colors"
                  />
                  <Button 
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim() || isProcessing}
                    size="default"
                    className="px-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-md hover:shadow-lg transition-all"
                    title={!textInput.trim() ? 'Veuillez entrer un message' : isProcessing ? 'Traitement en cours...' : 'Envoyer'}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <Card className="text-center hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Compréhension naturelle</h3>
                <p className="text-sm text-muted-foreground">
                  L'IA comprend le langage naturel et les nuances
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Réponse instantanée</h3>
                <p className="text-sm text-muted-foreground">
                  Temps de réponse &lt; 1.5 seconde
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">100% sécurisé</h3>
                <p className="text-sm text-muted-foreground">
                  Données chiffrées et conformes RGPD
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Example Commands */}
          <Card className="mt-10 border-0 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Exemples de commandes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                    Réservations
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span>"Je voudrais une coupe femme carrée jeudi après-midi"</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span>"As-tu une dispo demain avec Sarah pour un balayage ?"</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span>"Réserve-moi un brushing vendredi matin"</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                    Modifications
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span>"Décale mon rendez-vous de 16h à 17h"</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span>"J'annule ma couleur de samedi"</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span>"Peut-on changer de coiffeur·euse ?"</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Chatbot flottant */}
      <FloatingChatbot />
    </div>
  );
}