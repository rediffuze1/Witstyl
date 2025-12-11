#!/bin/bash
# Script pour tester les endpoints en production Vercel
# Usage: ./scripts/test-vercel-production.sh [URL_VERCEL]

set -e

VERCEL_URL="${1:-${VERCEL_URL:-}}"

if [ -z "$VERCEL_URL" ]; then
  echo "❌ Erreur: URL Vercel non fournie"
  echo "Usage: $0 <URL_VERCEL>"
  echo "   ou: VERCEL_URL=<url> $0"
  echo ""
  echo "Exemple: $0 https://witstyl.vercel.app"
  exit 1
fi

# Retirer le trailing slash si présent
VERCEL_URL="${VERCEL_URL%/}"

echo "🧪 Test des endpoints en production Vercel"
echo "📍 URL: $VERCEL_URL"
echo ""

# Fonction pour tester un endpoint
test_endpoint() {
  local method=$1
  local path=$2
  local description=$3
  local body=$4
  
  local url="${VERCEL_URL}${path}"
  local status_code
  local response
  
  echo -n "Testing $description... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url" || echo -e "\n000")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$url" || echo -e "\n000")
  fi
  
  status_code=$(echo "$response" | tail -n1)
  body_response=$(echo "$response" | sed '$d')
  
  if [ "$status_code" = "000" ]; then
    echo "❌ FAILED (erreur réseau)"
    return 1
  elif [ "$status_code" -ge 500 ]; then
    echo "❌ FAILED (Status: $status_code)"
    echo "   Response: ${body_response:0:200}"
    return 1
  else
    echo "✅ OK (Status: $status_code)"
    return 0
  fi
}

# Liste des endpoints à tester
passed=0
failed=0

# Test 1: GET /api/auth/user
if test_endpoint "GET" "/api/auth/user" "GET /api/auth/user (non authentifié)"; then
  ((passed++))
else
  ((failed++))
fi

# Test 2: POST /api/salon/login
if test_endpoint "POST" "/api/salon/login" "POST /api/salon/login" '{"email":"test@example.com","password":"test"}'; then
  ((passed++))
else
  ((failed++))
fi

# Test 3: GET /api/public/salon
if test_endpoint "GET" "/api/public/salon" "GET /api/public/salon"; then
  ((passed++))
else
  ((failed++))
fi

# Test 4: GET /api/public/salon/stylistes
if test_endpoint "GET" "/api/public/salon/stylistes" "GET /api/public/salon/stylistes"; then
  ((passed++))
else
  ((failed++))
fi

echo ""
echo "============================================================"
echo "Résultats: $passed passés, $failed échoués"
echo "============================================================"

if [ $failed -eq 0 ]; then
  echo ""
  echo "✅ Tous les tests sont passés !"
  exit 0
else
  echo ""
  echo "❌ $failed test(s) ont échoué"
  exit 1
fi

