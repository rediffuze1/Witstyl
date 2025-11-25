#!/bin/bash

# Script de test pour vérifier que les routes de notifications sont bien enregistrées
# Usage: ./test-routes-notifications.sh

BASE_URL="${BASE_URL:-http://localhost:5001}"

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 Test des Routes de Notifications"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📡 Test 1: Vérification du serveur..."
if curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Serveur accessible${NC}"
else
    echo -e "${RED}❌ Serveur inaccessible${NC}"
    exit 1
fi

echo ""
echo "🔍 Test 2: Liste des routes enregistrées..."
routes_response=$(curl -s "${BASE_URL}/api/debug/routes")
echo "$routes_response" | jq '.' 2>/dev/null || echo "$routes_response"

echo ""
echo "🔐 Test 3: Test des routes (sans auth = 401 attendu, PAS 404)..."
echo ""

# Test GET /api/owner/notification-templates/versions
echo "Test: GET /api/owner/notification-templates/versions"
response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/owner/notification-templates/versions")
if [ "$response" = "401" ]; then
    echo -e "${GREEN}✅ Route existe (401 = Non autorisé, c'est normal)${NC}"
elif [ "$response" = "404" ]; then
    echo -e "${RED}❌ Route NON trouvée (404) - Le serveur doit être redémarré !${NC}"
else
    echo -e "${YELLOW}⚠️  Code inattendu: $response${NC}"
fi

# Test POST /api/owner/notifications/send-test-email
echo ""
echo "Test: POST /api/owner/notifications/send-test-email"
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/owner/notifications/send-test-email" -H "Content-Type: application/json" -d '{}')
if [ "$response" = "401" ]; then
    echo -e "${GREEN}✅ Route existe (401 = Non autorisé, c'est normal)${NC}"
elif [ "$response" = "404" ]; then
    echo -e "${RED}❌ Route NON trouvée (404) - Le serveur doit être redémarré !${NC}"
else
    echo -e "${YELLOW}⚠️  Code inattendu: $response${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Résumé"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Si vous voyez des 404, le serveur doit être redémarré :"
echo "  1. Arrêter le serveur (Ctrl+C)"
echo "  2. Redémarrer: npm run dev"
echo "  3. Relancer ce script"
echo ""



