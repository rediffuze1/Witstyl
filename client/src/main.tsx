import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Theme } from "./lib/theme";

// Debug: vérifier que le DOM est prêt
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("❌ Element #root introuvable dans le DOM!");
  document.body.innerHTML = '<div style="padding: 2rem; font-family: system-ui;"><h1>Erreur de configuration</h1><p>L\'élément #root est introuvable. Vérifiez le fichier index.html.</p></div>';
} else {
  console.log("✅ Element #root trouvé");
  
  try {
    // Initialiser le thème avant le rendu
    Theme.init();
    console.log("✅ Thème initialisé");
    
    // Rendre l'application
    createRoot(rootElement).render(<App />);
    console.log("✅ Application React rendue");
  } catch (error) {
    console.error("❌ Erreur lors du rendu de l'application:", error);
    const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
    rootElement.innerHTML = 
      '<div style="padding: 2rem; font-family: system-ui; max-width: 600px; margin: 0 auto;">' +
        '<h1 style="color: #dc2626;">⚠️ Erreur de chargement</h1>' +
        '<p>Une erreur est survenue lors du chargement de l\'application.</p>' +
        '<details style="margin-top: 1rem;">' +
          '<summary style="cursor: pointer; color: #6b7280;">Détails techniques</summary>' +
          '<pre style="background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow: auto; margin-top: 0.5rem; font-size: 0.875rem; white-space: pre-wrap;">' +
            escapeHtml(errorMessage) +
          '</pre>' +
        '</details>' +
      '</div>';
  }
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
