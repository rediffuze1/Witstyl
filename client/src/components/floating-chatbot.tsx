import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, MessageCircle, Zap, MessageSquare, Heart } from "lucide-react";

type ChatMessage = { 
  type: 'user' | 'ai', 
  message: string,
  timestamp: Date 
};

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const previousMessageCountRef = useRef(0);

  // Fonction pour obtenir ou créer un sessionId
  function getSessionId() {
    try {
      let id = localStorage.getItem("sp_session_id");
      if (!id) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          id = crypto.randomUUID();
        } else {
          // Générer un UUID-like string manuellement
          id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }
        localStorage.setItem("sp_session_id", id);
      }
      return id;
    } catch (error) {
      console.warn("Erreur lors de la génération du sessionId:", error);
      // Fallback simple
      return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - (scrollTop + clientHeight) <= 60;
      setIsAtBottom(nearBottom);
      if (nearBottom) {
        setHasUnread(false);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  useEffect(() => {
    const messageCount = conversation.length;
    if (messageCount === 0) {
      previousMessageCountRef.current = 0;
      return;
    }

    if (isAtBottom) {
      scrollToBottom();
      setHasUnread(false);
    } else if (messageCount > previousMessageCountRef.current) {
      setHasUnread(true);
    }

    previousMessageCountRef.current = messageCount;
  }, [conversation, isAtBottom]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      scrollToBottom("auto");
      setIsAtBottom(true);
      setHasUnread(false);
      inputRef.current?.focus();
    });
  }, [isOpen]);

  // Écouter l'événement personnalisé pour ouvrir le chatbot depuis le header
  useEffect(() => {
    const handleOpenChat = () => {
      if (!isOpen) {
        setIsOpen(true);
        if (!hasWelcomed && conversation.length === 0) {
          const welcomeMessage: ChatMessage = {
            type: 'ai',
            message: "👋 Salut ! Je suis votre assistant personnel Witstyl. Je suis là pour vous simplifier la vie ! 😊\n\nJe peux vous aider à :\n✨ Réserver un rendez-vous en quelques secondes\n📅 Vérifier nos horaires d'ouverture\n💇 Découvrir nos services et tarifs\n💬 Répondre à toutes vos questions\n\nAlors, par quoi commençons-nous ?",
            timestamp: new Date()
          };
          setConversation([welcomeMessage]);
          setHasWelcomed(true);
        }
      }
    };

    window.addEventListener('openChatbot', handleOpenChat);
    return () => {
      window.removeEventListener('openChatbot', handleOpenChat);
    };
  }, [isOpen, hasWelcomed, conversation.length]);

  useEffect(() => {
    if (!isExpanded) return;
    if (typeof window === "undefined") return;
    const isSmallScreen = window.matchMedia("(max-width: 640px)").matches;
    if (!isSmallScreen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isExpanded]);

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      type: 'user',
      message: message.trim(),
      timestamp: new Date()
    };

    setConversation(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      // Envoyer le message à l'IA
      const requestUrl = "/api/voice-agent";
      console.log('[FloatingChatbot] 📤 Envoi message:', { message: message.trim().substring(0, 50), sessionId: getSessionId() });
      
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Inclure les cookies pour la session
        body: JSON.stringify({ 
          message: message.trim(), 
          sessionId: getSessionId()
        }),
      });

      console.log('[FloatingChatbot] 📥 Réponse reçue:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: requestUrl,
      });

      let aiResponse = "Désolé, j'ai eu un souci. Comment puis-je vous aider ?";
      
      if (response.ok) {
        try {
          const data = await response.json();
          aiResponse = data.reply || data.message || "Bonjour ! Comment puis-je vous aider ?";
          console.log('[FloatingChatbot] ✅ Réponse IA reçue:', aiResponse.substring(0, 100));
        } catch (parseError) {
          console.error('[FloatingChatbot] ❌ Erreur parsing JSON:', parseError);
          const text = await response.text();
          console.error('[FloatingChatbot] ❌ Réponse texte brute:', text.substring(0, 200));
          aiResponse = "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?";
        }
      } else {
        // Erreur HTTP
        console.error('[FloatingChatbot] ❌ Erreur API:', {
          status: response.status,
          statusText: response.statusText,
          url: requestUrl,
        });
        
        let errorData = {};
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            errorData = await response.json();
          } else {
            const text = await response.text();
            console.error('[FloatingChatbot] ❌ Réponse non-JSON:', text.substring(0, 200));
            errorData = { message: text.substring(0, 100) };
          }
        } catch (parseError) {
          console.error('[FloatingChatbot] ❌ Erreur parsing erreur:', parseError);
        }
        
        console.error('[FloatingChatbot] ❌ Détails erreur:', errorData);
        
        // Message d'erreur plus spécifique selon le code
        if (response.status === 503) {
          aiResponse = errorData.message || "Le service IA est temporairement indisponible. Veuillez réessayer dans quelques instants.";
        } else if (response.status === 500) {
          aiResponse = "Une erreur serveur est survenue. Veuillez réessayer plus tard.";
        } else {
          aiResponse = "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?";
        }
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
        message: "Désolé, j'ai eu un souci. Comment puis-je vous aider ?",
        timestamp: new Date()
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      handleUserMessage(textInput);
      setTextInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const toggleChat = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && !hasWelcomed && conversation.length === 0) {
      const welcomeMessage: ChatMessage = {
        type: 'ai',
        message: "👋 Salut ! Je suis votre assistant personnel Witstyl. Je suis là pour vous simplifier la vie ! 😊\n\nJe peux vous aider à :\n✨ Réserver un rendez-vous en quelques secondes\n📅 Vérifier nos horaires d'ouverture\n💇 Découvrir nos services et tarifs\n💬 Répondre à toutes vos questions\n\nAlors, par quoi commençons-nous ?",
        timestamp: new Date()
      };
      setConversation([welcomeMessage]);
      setHasWelcomed(true);
    }
  };

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  const chatCardClassName = [
    "fixed z-40 bg-white/95 backdrop-blur-md border border-border/40 shadow-xl flex flex-col",
    isExpanded
      ? "bottom-4 right-4 left-4 top-4 w-auto h-auto max-h-[95vh] sm:left-auto sm:top-auto sm:right-12 sm:bottom-10 sm:w-[420px] sm:h-[80vh]"
      : "bottom-20 sm:bottom-24 right-4 sm:right-6 w-[calc(100%-2rem)] sm:w-80 h-[520px] sm:right-12 sm:w-96 sm:h-[520px]"
  ].join(" ");

  return (
    <>
      {/* Bouton flottant amélioré */}
      {!isOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-12 z-40">
          {/* Badge de notification animé */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg border-2 border-white" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75" />
          
          <Button
            onClick={toggleChat}
            className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary via-primary/90 to-accent hover:from-primary hover:to-accent transition-all duration-500 shadow-2xl hover:shadow-primary/50 hover:scale-110 active:scale-95 flex items-center justify-center overflow-hidden"
            aria-label="Ouvrir le chatbot"
          >
            {/* Effet de brillance animé */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            {/* Effet de glow pulsant */}
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-pulse blur-xl" />
            
            {/* Container pour les icônes */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              {/* Icône principale avec animation */}
              <div className="relative">
                <Sparkles className="h-5 w-5 sm:h-7 sm:w-7 text-white absolute -top-1 -right-1 animate-pulse" />
                <MessageCircle className="h-6 w-6 sm:h-8 sm:w-8 text-white animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              
              {/* Texte sous l'icône */}
              <span className="text-[9px] sm:text-[10px] font-bold text-white mt-0.5 opacity-90 group-hover:opacity-100 transition-opacity">
                IA
              </span>
            </div>
            
            {/* Effet de particules animées */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 left-2 w-1 h-1 bg-white rounded-full animate-ping opacity-75" style={{ animationDelay: '0s', animationDuration: '2s' }} />
              <div className="absolute top-3 right-3 w-1 h-1 bg-white rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s', animationDuration: '2s' }} />
              <div className="absolute bottom-2 left-3 w-1 h-1 bg-white rounded-full animate-ping opacity-75" style={{ animationDelay: '1s', animationDuration: '2s' }} />
              <div className="absolute bottom-3 right-2 w-1 h-1 bg-white rounded-full animate-ping opacity-75" style={{ animationDelay: '1.5s', animationDuration: '2s' }} />
            </div>
          </Button>
        </div>
      )}

      {/* Chat window */}
      {isOpen && (
        <Card className={chatCardClassName}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <div className="relative mr-2">
                  <Sparkles className="h-5 w-5 text-primary absolute -top-0.5 -right-0.5 animate-pulse" />
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <span className="text-foreground font-semibold">
                  Salomé
                </span>
              </CardTitle>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleExpand}
                  className="h-8 w-8 p-0"
                  aria-label={isExpanded ? "Réduire la fenêtre du chat" : "Agrandir la fenêtre du chat"}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleChat}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 relative">
              <div
                ref={messagesContainerRef}
                className="h-full overflow-y-auto pr-2 space-y-3 pb-6"
              >
                {conversation.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    <div className="relative mx-auto mb-4 w-fit">
                      <div className="relative">
                        <Sparkles className="h-10 w-10 mx-auto text-primary/60 animate-pulse" />
                        <MessageCircle className="h-8 w-8 absolute top-1 left-1/2 -translate-x-1/2 text-primary/40" />
                      </div>
                    </div>
                    <p className="font-semibold text-foreground mb-2">Bonjour 👋</p>
                    <p className="text-sm text-foreground mb-1">Je suis Salomé</p>
                    <p className="text-xs text-muted-foreground">Votre assistante Witstyl</p>
                    <p className="text-xs mt-3 text-muted-foreground">Comment puis-je vous aider aujourd'hui ?</p>
                  </div>
                ) : (
                  conversation.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs p-3 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          message.type === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}
                      >
                        {message.message}
                      </div>
                    </div>
                  ))
                )}
                
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground rounded-2xl rounded-bl-md p-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin w-3 h-3 border-2 border-primary border-t-transparent rounded-full" />
                        <span>L'IA réfléchit...</span>
                      </div>
                    </div>
                  </div>
                )}
                
              </div>
              {hasUnread && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md text-xs px-4 py-1"
                  onClick={() => {
                    scrollToBottom();
                    setHasUnread(false);
                    setIsAtBottom(true);
                  }}
                >
                  Nouveaux messages
                </Button>
              )}
            </div>

            {/* Input - Toujours visible en bas */}
            <div className="flex gap-2 flex-shrink-0 pt-2 border-t border-border/40">
              <Input
                ref={inputRef}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Écrivez votre message..."
                className="flex-1 text-sm"
                disabled={isProcessing}
              />
              <Button 
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || isProcessing}
                size="sm"
                className="px-3 bg-primary hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

