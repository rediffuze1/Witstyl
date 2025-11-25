#!/bin/bash

# Script de test automatisé pour le système de notifications
# Usage: ./test-notifications-audit.sh

set -e

BASE_URL="${BASE_URL:-http://localhost:5001}"
SALON_ID="${SALON_ID:-salon-c152118c-478b-497b-98db-db37a4c58898}"

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 Tests Automatisés du Système de Notifications"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Couleurs pour les résultats
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

test_result() {
    test_count=$((test_count + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ Test $test_count: $2${NC}"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}❌ Test $test_count: $2${NC}"
        fail_count=$((fail_count + 1))
    fi
}

# Test 1: Vérifier que le serveur répond
echo "📡 Test 1: Vérification du serveur..."
if curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
    test_result 0 "Serveur accessible"
else
    test_result 1 "Serveur inaccessible"
    echo "⚠️  Assurez-vous que le serveur est démarré sur ${BASE_URL}"
    exit 1
fi

# Test 2: Vérifier que les endpoints existent (sans auth, on s'attend à 401)
echo ""
echo "🔐 Test 2: Vérification des endpoints (sans auth = 401 attendu)..."
response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/owner/notification-settings")
if [ "$response" = "401" ]; then
    test_result 0 "GET /api/owner/notification-settings existe et protégé"
else
    test_result 1 "GET /api/owner/notification-settings (code: $response)"
fi

response=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${BASE_URL}/api/owner/notification-settings" -H "Content-Type: application/json" -d '{}')
if [ "$response" = "401" ]; then
    test_result 0 "PUT /api/owner/notification-settings existe et protégé"
else
    test_result 1 "PUT /api/owner/notification-settings (code: $response)"
fi

response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/owner/notifications/send-test-email" -H "Content-Type: application/json" -d '{}')
if [ "$response" = "401" ]; then
    test_result 0 "POST /api/owner/notifications/send-test-email existe et protégé"
else
    test_result 1 "POST /api/owner/notifications/send-test-email (code: $response)"
fi

response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/owner/notification-templates/versions")
if [ "$response" = "401" ]; then
    test_result 0 "GET /api/owner/notification-templates/versions existe et protégé"
else
    test_result 1 "GET /api/owner/notification-templates/versions (code: $response)"
fi

# Test 3: Vérifier l'endpoint de test dev (peut être accessible sans auth)
echo ""
echo "🧪 Test 3: Vérification de l'endpoint de test dev..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/dev/send-test-notification" -H "Content-Type: application/json" -d '{"salonId":"'${SALON_ID}'"}')
if [ "$response" = "200" ] || [ "$response" = "207" ]; then
    test_result 0 "POST /api/dev/send-test-notification accessible"
else
    test_result 1 "POST /api/dev/send-test-notification (code: $response)"
fi

# Test 4: Vérifier l'endpoint de rappels
echo ""
echo "⏰ Test 4: Vérification de l'endpoint de rappels..."
response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/notifications/send-reminders")
if [ "$response" = "200" ]; then
    test_result 0 "GET /api/notifications/send-reminders accessible"
else
    test_result 1 "GET /api/notifications/send-reminders (code: $response)"
fi

# Résumé
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Résumé des Tests"
echo "═══════════════════════════════════════════════════════════════"
echo "Total: $test_count"
echo -e "${GREEN}✅ Réussis: $pass_count${NC}"
echo -e "${RED}❌ Échoués: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les tests sont passés !${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Certains tests ont échoué. Vérifiez les logs ci-dessus.${NC}"
    exit 1
fi



