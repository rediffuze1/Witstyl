#!/bin/bash

echo "🧪 TEST COMPLET - Sauvegarde des horaires de styliste"
echo "====================================================="
echo ""

BASE_URL="http://localhost:5001"
COOKIE_FILE="/tmp/test_cookies.txt"

# Nettoyer les anciens cookies
rm -f $COOKIE_FILE

echo "📋 Étape 1: Vérification que le serveur répond..."
if ! curl -s "$BASE_URL" > /dev/null; then
  echo "❌ Le serveur ne répond pas sur $BASE_URL"
  exit 1
fi
echo "✅ Serveur accessible"
echo ""

echo "📋 Étape 2: Test de connexion (nécessite des identifiants valides)..."
echo "⚠️  Note: Ce test nécessite des identifiants valides dans la base de données"
echo ""

echo "📋 Étape 3: Vérification de la structure de la route..."
echo "Test de la route PUT /api/salons/:salonId/stylist-hours/:stylistId"
echo ""

# Test avec des IDs de test
SALON_ID="c152118c-478b-497b-98db-db37a4c58898"
STYLIST_ID="stylist-1761567120719-0f2lq2164"

echo "📋 Étape 4: Test de sauvegarde (sans authentification - devrait échouer avec 401)..."
TEST_HOURS='[
  {"day_of_week": 0, "open_time": "09:00", "close_time": "18:00", "is_closed": true},
  {"day_of_week": 1, "open_time": "09:00", "close_time": "18:00", "is_closed": true},
  {"day_of_week": 2, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 3, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 4, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 5, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 6, "open_time": "09:00", "close_time": "12:00", "is_closed": false}
]'

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PUT \
  "$BASE_URL/api/salons/$SALON_ID/stylist-hours/$STYLIST_ID" \
  -H "Content-Type: application/json" \
  -d "{\"hours\": $TEST_HOURS}")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "Code HTTP: $HTTP_CODE"
echo "Réponse: $BODY"
echo ""

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Route accessible (erreur 401 attendue sans authentification)"
elif [ "$HTTP_CODE" = "500" ]; then
  echo "⚠️  Erreur 500 - Vérifiez les logs pour plus de détails"
  echo "Probable cause: Table stylist_schedule n'existe pas"
  echo ""
  echo "📋 SOLUTION: Exécutez le script SQL dans Supabase:"
  echo "   Fichier: supabase_create_stylist_schedule.sql"
elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ SUCCÈS ! La route fonctionne"
else
  echo "⚠️  Code HTTP inattendu: $HTTP_CODE"
fi

echo ""
echo "📊 Vérification des logs du serveur..."
echo "Logs disponibles dans: /tmp/server_test_complete.log"
echo ""
echo "Pour surveiller en temps réel:"
echo "  tail -f /tmp/server_test_complete.log | grep -i 'stylist\|error\|PUT.*stylist-hours'"
echo ""





