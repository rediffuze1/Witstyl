#!/bin/bash

echo "🧪 TEST - Validation des horaires du styliste (Julie le samedi)"
echo "=============================================================="
echo ""

BASE_URL="http://localhost:5001"
JULIE_STYLIST_ID="stylist-1761504151845-kgglkv8h3"

# Test: Essayer de créer un rendez-vous le samedi avec Julie
# Le samedi = day_of_week 6, et Julie est indisponible ce jour-là

# Date: Samedi 22 novembre 2025 (day_of_week = 6)
SATURDAY_DATE="2025-11-22T10:30:00Z"

echo "📋 Test 1: Création d'un rendez-vous le samedi avec Julie (devrait échouer)"
echo "Date: $SATURDAY_DATE"
echo "Styliste: Julie Moulin ($JULIE_STYLIST_ID)"
echo ""

# Simuler une requête POST (sans authentification complète, mais on teste la logique)
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "$BASE_URL/api/appointments" \
  -H "Content-Type: application/json" \
  -d "{
    \"startTime\": \"$SATURDAY_DATE\",
    \"stylistId\": \"$JULIE_STYLIST_ID\",
    \"serviceId\": \"service-test\",
    \"clientId\": \"client-test\",
    \"duration\": 30
  }")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "Code HTTP: $HTTP_CODE"
echo "Réponse: $BODY"
echo ""

if echo "$BODY" | grep -q "n'est pas disponible le samedi\|n'est pas disponible"; then
  echo "✅ SUCCÈS: La validation fonctionne ! Le rendez-vous est rejeté car Julie n'est pas disponible le samedi."
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "500" ]; then
  echo "⚠️  Erreur d'authentification ou serveur, mais la route est accessible"
else
  echo "❌ ÉCHEC: Le rendez-vous devrait être rejeté mais ne l'est pas"
fi

echo ""
echo "📊 Vérification des logs du serveur..."
echo "Pour voir les logs: tail -f /tmp/server_stylist_validation.log | grep -i 'julie\|samedi\|stylist.*available'"





