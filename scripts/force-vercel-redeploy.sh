#!/bin/bash

# Script pour forcer un redeploy Vercel sans cache
# Usage: ./scripts/force-vercel-redeploy.sh

set -e

echo "🚀 Force redeploy Vercel sans cache..."
echo ""

# Vérifier que le code est correct
echo "1️⃣ Vérification des imports ESM..."
npm run check:esm

echo ""
echo "2️⃣ Vérification des imports critiques..."
node scripts/verify-vercel-build.mjs

echo ""
echo "3️⃣ Vérification TypeScript..."
npm run check

echo ""
echo "4️⃣ Build local (test)..."
npm run build

echo ""
echo "✅ Toutes les vérifications passent"
echo ""
echo "5️⃣ Déploiement Vercel sans cache..."
echo "   Commande: npx vercel --prod --force"
echo ""
read -p "Continuer avec le déploiement ? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  npx vercel --prod --force
  echo ""
  echo "✅ Déploiement terminé"
  echo "💡 Vérifiez les logs Vercel pour confirmer que les imports .js sont présents"
else
  echo "❌ Déploiement annulé"
  exit 1
fi

