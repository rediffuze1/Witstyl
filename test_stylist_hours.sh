#!/bin/bash

echo "🧪 Test de sauvegarde des horaires de styliste"
echo "=============================================="
echo ""

# Configuration
BASE_URL="http://localhost:5001"
SALON_EMAIL="pierre@example.com"
SALON_PASSWORD="password123"

echo "1️⃣ Connexion en tant qu'owner..."
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt -X POST "$BASE_URL/api/salon/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SALON_EMAIL\",\"password\":\"$SALON_PASSWORD\"}")

echo "Réponse login: $LOGIN_RESPONSE"
echo ""

# Extraire le salonId de la réponse (si disponible)
SALON_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"salonId":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$SALON_ID" ]; then
  echo "⚠️ Impossible d'extraire le salonId, utilisation d'un ID par défaut"
  SALON_ID="c152118c-478b-497b-98db-db37a4c58898"
fi

echo "2️⃣ Salon ID: $SALON_ID"
echo ""

echo "3️⃣ Récupération de la liste des stylistes..."
STYLISTS_RESPONSE=$(curl -s -b /tmp/cookies.txt "$BASE_URL/api/salons/$SALON_ID/stylistes")
echo "Stylistes: $STYLISTS_RESPONSE"
echo ""

# Extraire le premier stylistId
STYLIST_ID=$(echo "$STYLISTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$STYLIST_ID" ]; then
  echo "⚠️ Aucun styliste trouvé, utilisation d'un ID de test"
  STYLIST_ID="stylist-1761567120719-0f2lq2164"
fi

echo "4️⃣ Stylist ID: $STYLIST_ID"
echo ""

echo "5️⃣ Récupération des horaires du salon pour validation..."
SALON_HOURS_RESPONSE=$(curl -s -b /tmp/cookies.txt "$BASE_URL/api/salons/$SALON_ID/hours")
echo "Horaires salon: $SALON_HOURS_RESPONSE"
echo ""

echo "6️⃣ Préparation des horaires de test pour le styliste..."
# Horaires de test : fermé dimanche/lundi, ouvert mardi-samedi
HOURS_JSON='[
  {"day_of_week": 0, "open_time": "09:00", "close_time": "18:00", "is_closed": true},
  {"day_of_week": 1, "open_time": "09:00", "close_time": "18:00", "is_closed": true},
  {"day_of_week": 2, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 3, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 4, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 5, "open_time": "09:00", "close_time": "18:00", "is_closed": false},
  {"day_of_week": 6, "open_time": "09:00", "close_time": "12:00", "is_closed": false}
]'

echo "Horaires à sauvegarder: $HOURS_JSON"
echo ""

echo "7️⃣ Envoi de la requête PUT pour sauvegarder les horaires..."
PUT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -b /tmp/cookies.txt -X PUT \
  "$BASE_URL/api/salons/$SALON_ID/stylist-hours/$STYLIST_ID" \
  -H "Content-Type: application/json" \
  -d "{\"hours\": $HOURS_JSON}")

HTTP_CODE=$(echo "$PUT_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PUT_RESPONSE" | sed '/HTTP_CODE:/d')

echo "Code HTTP: $HTTP_CODE"
echo "Réponse: $RESPONSE_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ SUCCÈS ! Les horaires ont été sauvegardés avec succès"
  echo ""
  echo "8️⃣ Vérification : récupération des horaires sauvegardés..."
  GET_RESPONSE=$(curl -s -b /tmp/cookies.txt "$BASE_URL/api/salons/$SALON_ID/stylist-hours")
  echo "Horaires sauvegardés: $GET_RESPONSE"
else
  echo "❌ ERREUR ! Code HTTP: $HTTP_CODE"
  echo "Détails: $RESPONSE_BODY"
  echo ""
  echo "Vérifiez les logs du serveur: tail -f /tmp/server_final_stylist_hours.log"
fi

echo ""
echo "Test terminé."






