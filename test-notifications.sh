#!/bin/bash

# Script de test pour vérifier les notifications
# Ce script crée un rendez-vous de test et affiche les logs

echo "🧪 Test des notifications SalonPilot"
echo "===================================="
echo ""

# Vérifier que le serveur tourne
if ! curl -s http://localhost:5001/api/public/salon > /dev/null; then
    echo "❌ Le serveur n'est pas accessible sur http://localhost:5001"
    echo "   Veuillez démarrer le serveur avec: npm run dev"
    exit 1
fi

echo "✅ Serveur accessible"
echo ""
echo "📋 Instructions pour voir les logs de notifications:"
echo ""
echo "1. Ouvrez le terminal où vous avez lancé 'npm run dev'"
echo "2. Créez un rendez-vous depuis http://localhost:5001/calendar"
echo "3. Regardez immédiatement le terminal du serveur"
echo ""
echo "Vous devriez voir des logs comme:"
echo "  [POST /api/appointments] ✅ Rendez-vous créé: ..."
echo "  [POST /api/appointments] 📧 Envoi des notifications de confirmation..."
echo "  [SmsUp] [DRY RUN] SMS qui serait envoyé:"
echo "  [Resend] [DRY RUN] Email qui serait envoyé:"
echo "  [POST /api/appointments] ✅ Notifications envoyées avec succès"
echo ""
echo "⚠️  IMPORTANT: Les logs apparaissent dans le TERMINAL DU SERVEUR,"
echo "   PAS dans la console du navigateur (F12)!"
echo ""



