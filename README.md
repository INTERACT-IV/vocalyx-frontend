# vocalyx-dashboard

Interface web pour la gestion des transcriptions audio Vocalyx.

## 🎯 Rôle

- Interface utilisateur web intuitive
- **Client HTTP pur** de `vocalyx-api` (aucun accès direct à la DB)
- Gestion des projets et transcriptions
- Monitoring des workers en temps réel

## 🏗️ Architecture

```
vocalyx-dashboard/
├── templates/
│   ├── dashboard.html
│   └── static/
│       ├── css/
│       │   └── dashboard.css
│       └── js/
│           ├── api.js          # Client API JavaScript
│           ├── cards.js        # Gestion de la grille
│           ├── events.js       # Événements utilisateur
│           ├── main.js         # Point d'entrée
│           ├── modal.js        # Gestion des modales
│           ├── polling.js      # Polling des transcriptions
│           └── utils.js        # Utilitaires
├── app.py                      # Point d'entrée FastAPI
├── api_client.py               # Client HTTP vers vocalyx-api
├── config.py                   # Configuration
├── routes.py                   # Routes du dashboard
├── logging_config.py           # Configuration du logging
├── requirements.txt
├── Dockerfile
└── config.ini
```

## 🚀 Installation

### Prérequis

- Python 3.10+
- vocalyx-api en cours d'exécution

### Installation locale

```bash
# Cloner le dépôt
git clone <repository>
cd vocalyx-dashboard

# Créer un environnement virtuel
python3.10 -m venv venv
source venv/bin/activate  # Linux/Mac

# Installer les dépendances
pip install -r requirements.txt

# Configurer
cp config.ini config.local.ini
# Éditer config.local.ini avec l'URL de votre API

# Lancer le dashboard
python app.py
```

Le Dashboard sera accessible sur http://localhost:8080

## 🐳 Docker

```bash
# Build
docker build -t vocalyx-dashboard .

# Run
docker run -p 8080:8080 \
  -e VOCALYX_API_URL="http://vocalyx-api:8000" \
  vocalyx-dashboard
```

## 📡 Fonctionnalités

### ✅ Gestion des Projets
- Créer de nouveaux projets
- Lister tous les projets
- Récupérer les clés API

### ✅ Gestion des Transcriptions
- Upload de fichiers audio
- Visualisation en grille
- Filtrage (statut, projet, recherche)
- Pagination
- Détails complets avec segments
- Suppression

### ✅ Monitoring
- Statut des workers Celery en temps réel
- Statistiques des transcriptions
- Polling automatique

## 🔒 Sécurité

### Communication avec l'API

Le dashboard utilise une clé interne (`X-Internal-Key`) pour communiquer avec vocalyx-api.

```ini
[SECURITY]
internal_api_key = SECRET_KEY_HERE
```

**⚠️ Cette clé DOIT être identique à celle configurée dans vocalyx-api.**

### Flux d'Authentification

1. **Upload** : Dashboard → API (avec clé projet de l'utilisateur)
2. **Lecture** : Dashboard → API (avec clé interne)
3. **Admin** : Dashboard → API (avec clé projet admin)

## ⚙️ Configuration

Voir `config.ini` pour toutes les options disponibles.

### Variables d'Environnement (optionnel)

```bash
VOCALYX_API_URL=http://vocalyx-api:8000
INTERNAL_API_KEY=your_secret_key
```

## 📊 Monitoring

- **Logs**: `logs/vocalyx-dashboard.log`
- **Health Check**: `GET /health`

## 🎨 Interface Utilisateur

L'interface propose :

- **Dashboard principal** : Vue d'ensemble des transcriptions
- **Filtres avancés** : Par statut, projet, recherche texte
- **Monitoring workers** : Affichage en temps réel
- **Modales** :
  - Upload de fichiers audio
  - Gestion des projets
  - Détails des transcriptions avec segments

## 🔄 Polling

Le dashboard poll automatiquement :
- Les transcriptions toutes les 5 secondes
- Les workers toutes les 5 secondes

Le polling s'arrête automatiquement quand :
- Une modale est ouverte
- L'onglet est en arrière-plan

## 📝 Changelog

### Version 1.0.0
- Architecture microservices (client API pur)
- Plus d'accès direct à la base de données
- Communication HTTP avec vocalyx-api
- Interface modernisée

## 📄 Licence

Propriétaire - Guilhem RICHARD