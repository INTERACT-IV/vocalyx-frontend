# Vocalyx Frontend

Interface web dashboard pour la gestion et le suivi des transcriptions audio.

## Description

Module frontend de Vocalyx fournissant une interface web complète pour l'administration des transcriptions, projets et utilisateurs. Communique avec l'API centrale via HTTP et WebSocket pour les mises à jour en temps réel.

## Architecture

### Structure

```
vocalyx-frontend/
├── api_client.py              # Client API (compatibilité)
├── infrastructure/
│   └── api/
│       └── api_client.py      # Client API refactorisé
├── application/
│   └── services/              # Services applicatifs
│       ├── auth_service.py
│       ├── project_service.py
│       ├── transcription_service.py
│       └── user_service.py
├── routes.py                  # Routes FastAPI
├── auth_deps.py               # Dépendances d'authentification
├── app.py                     # Point d'entrée FastAPI
└── templates/                 # Templates HTML
    ├── dashboard.html
    ├── login.html
    └── static/                # Assets statiques (CSS, JS)
```

### Fonctionnalités

- **Dashboard** : Vue d'ensemble des transcriptions avec filtres et pagination
- **Authentification** : Système de login avec cookies HttpOnly
- **Gestion des transcriptions** : Upload, visualisation, suppression
- **Administration** : Gestion des utilisateurs et projets
- **Temps réel** : Mises à jour via WebSocket
- **Interface responsive** : Design adaptatif

## Dépendances principales

### FastAPI
Framework web pour servir l'interface HTML et gérer les routes. Utilisé également pour le rendu des templates Jinja2.

### Uvicorn
Serveur ASGI pour exécuter l'application FastAPI. Gère les requêtes HTTP et les connexions WebSocket.

### Jinja2
Moteur de templates pour générer les pages HTML. Utilisé pour le rendu des templates du dashboard.

### httpx
Client HTTP asynchrone pour communiquer avec l'API centrale. Supporte les requêtes synchrones et asynchrones.

### python-multipart
Support pour le parsing des formulaires multipart. Nécessaire pour l'upload de fichiers audio.

### python-dotenv
Chargement des variables d'environnement depuis les fichiers `.env`. Utilisé pour la configuration.

## Configuration

Variables d'environnement principales :

- `VOCALYX_API_URL` : URL de l'API centrale
- `INTERNAL_API_KEY` : Clé pour la communication interne
- `ADMIN_PROJECT_NAME` : Nom du projet administrateur
- `LOG_LEVEL` : Niveau de logging
- `LOG_FILE_PATH` : Chemin du fichier de logs

## Routes principales

### Pages HTML
- `GET /` : Page d'accueil (redirige vers le dashboard)
- `GET /dashboard` : Dashboard principal
- `GET /admin` : Interface d'administration
- `GET /login` : Page de connexion

### Authentification
- `POST /auth/login` : Connexion utilisateur
- `GET /auth/logout` : Déconnexion
- `GET /auth/get-token` : Récupération du token pour WebSocket

### API Proxy
Le frontend fait office de proxy pour certaines routes de l'API :
- Gestion des transcriptions
- Gestion des projets
- Gestion des utilisateurs (admin)
- Statut des workers

## Authentification

Système d'authentification basé sur :
- Cookies HttpOnly pour stocker le token JWT
- Vérification du token via dépendance FastAPI
- Redirection automatique vers `/login` si non authentifié
- Support des utilisateurs administrateurs

## Interface utilisateur

### Dashboard
- Liste des transcriptions avec filtres (statut, projet, recherche)
- Pagination des résultats
- Statistiques en temps réel (workers, transcriptions)
- Actions : visualiser, télécharger, supprimer

### Administration
- Gestion des utilisateurs (création, modification, suppression)
- Attribution de projets aux utilisateurs
- Gestion des projets

### Upload
- Interface d'upload de fichiers audio
- Configuration des options (VAD, diarisation, modèle Whisper)
- Suivi de la progression via WebSocket

## WebSocket

Le frontend se connecte à l'API via WebSocket pour :
- Recevoir les mises à jour de transcriptions en temps réel
- Mettre à jour les statistiques des workers
- Rafraîchir automatiquement le dashboard

## Assets statiques

Les fichiers statiques (CSS, JavaScript) sont servis via FastAPI :
- `static/css/` : Feuilles de style
- `static/js/` : Scripts JavaScript pour l'interactivité

## Logs

Les logs sont écrits dans `./shared/logs/vocalyx-frontend.log` avec le format :

```
%(asctime)s [%(levelname)s] %(name)s: %(message)s
```

Voir `DOCUMENTATION_LOGS.md` pour la documentation complète des logs.

