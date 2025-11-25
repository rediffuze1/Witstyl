#!/bin/bash

# Script de test pour créer un rendez-vous
# Récupérer les IDs nécessaires depuis l'API

echo "🔍 Récupération des données nécessaires..."

# Récupérer le salon ID
SALON_ID=$(curl -s http://localhost:5001/api/salon 2>/dev/null | jq -r '.id' 2>/dev/null)
if [ -z "$SALON_ID" ] || [ "$SALON_ID" = "null" ]; then
    echo "❌ Impossible de récupérer le salon ID"
    exit 1
fi
echo "✅ Salon ID: $SALON_ID"

# Récupérer un client ID (premier client disponible)
CLIENT_ID=$(curl -s http://localhost:5001/api/clients 2>/dev/null | jq -r '.[0].id' 2>/dev/null)
if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "null" ]; then
    echo "❌ Impossible de récupérer un client ID"
    exit 1
fi
echo "✅ Client ID: $CLIENT_ID"

# Récupérer un service ID
SERVICE_ID=$(curl -s "http://localhost:5001/api/salons/$SALON_ID/services" 2>/dev/null | jq -r '.[0].id' 2>/dev/null)
if [ -z "$SERVICE_ID" ] || [ "$SERVICE_ID" = "null" ]; then
    echo "❌ Impossible de récupérer un service ID"
    exit 1
fi
echo "✅ Service ID: $SERVICE_ID"

# Récupérer un styliste ID
STYLIST_ID=$(curl -s "http://localhost:5001/api/salons/$SALON_ID/stylistes" 2>/dev/null | jq -r '.[0].id' 2>/dev/null)
if [ -z "$STYLIST_ID" ] || [ "$STYLIST_ID" = "null" ]; then
    echo "❌ Impossible de récupérer un styliste ID"
    exit 1
fi
echo "✅ Styliste ID: $STYLIST_ID"

# Créer une date/heure pour demain à 10h00
START_TIME=$(date -u -v+1d -v10H -v0M -v0S +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+1 day 10:00:00" +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || echo "$(date -u -d 'tomorrow 10:00' +'%Y-%m-%dT%H:%M:%S.000Z')")

echo ""
echo "🧪 Test de création de rendez-vous..."
echo "   Salon: $SALON_ID"
echo "   Client: $CLIENT_ID"
echo "   Service: $SERVICE_ID"
echo "   Styliste: $STYLIST_ID"
echo "   Date/Heure: $START_TIME"
echo ""

# Créer le rendez-vous
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:5001/api/appointments \
  -H "Content-Type: application/json" \
  -d "{
    \"salonId\": \"$SALON_ID\",
    \"clientId\": \"$CLIENT_ID\",
    \"serviceId\": \"$SERVICE_ID\",
    \"stylistId\": \"$STYLIST_ID\",
    \"startTime\": \"$START_TIME\",
    \"status\": \"confirmed\",
    \"notes\": \"Test de création depuis script\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "📊 Code HTTP: $HTTP_CODE"
echo "📄 Réponse:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo ""
    echo "✅ Rendez-vous créé avec succès!"
else
    echo ""
    echo "❌ Erreur lors de la création du rendez-vous"
    echo "   Vérifiez les logs du serveur pour plus de détails"
fi



