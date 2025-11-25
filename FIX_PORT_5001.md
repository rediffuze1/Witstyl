# 🔧 Solution : Port 5001 Déjà Utilisé

## ❌ Erreur

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5001
```

## ✅ Solution

Le port 5001 est déjà utilisé par un autre processus (probablement une ancienne instance du serveur).

### Méthode 1 : Arrêter les processus automatiquement

```bash
# Arrêter tous les processus Node.js/tsx qui utilisent le port 5001
pkill -f "tsx server/index"
pkill -f "node.*server/index"

# Vérifier que le port est libéré
lsof -ti:5001 || echo "Port libéré ✅"
```

### Méthode 2 : Arrêter manuellement

1. **Trouver les processus** :
   ```bash
   lsof -ti:5001
   ```

2. **Arrêter chaque processus** :
   ```bash
   kill -9 <PID>
   ```

3. **Vérifier** :
   ```bash
   lsof -ti:5001 || echo "Port libéré ✅"
   ```

### Méthode 3 : Changer le port (temporaire)

Si vous ne pouvez pas arrêter les processus, changez le port dans `.env` :

```bash
PORT=5002
```

Puis redémarrez :
```bash
npm run dev
```

Et accédez à l'application sur `http://localhost:5002`

## 🚀 Après avoir libéré le port

```bash
npm run dev
```

Le serveur devrait démarrer correctement.

## 💡 Prévention

Pour éviter ce problème à l'avenir :

1. **Toujours arrêter proprement le serveur** avec `Ctrl + C` dans le terminal
2. **Vérifier avant de redémarrer** :
   ```bash
   lsof -ti:5001 && echo "Port occupé !" || echo "Port libre ✅"
   ```



