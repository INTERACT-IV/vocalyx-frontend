"""
vocalyx-dashboard/app.py
Point d'entrée principal du Dashboard (adapté pour architecture microservices)
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

import uvicorn

from config import Config
from api_client import VocalyxAPIClient
from routes import dashboard_router
from logging_config import setup_logging, setup_colored_logging, get_uvicorn_log_config

# Initialiser la configuration
config = Config()

# Configurer le logging
if config.log_colored:
    logger = setup_colored_logging(
        log_level=config.log_level,
        log_file=config.log_file_path if config.log_file_enabled else None
    )
else:
    logger = setup_logging(
        log_level=config.log_level,
        log_file=config.log_file_path if config.log_file_enabled else None
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    # --- Startup ---
    logger.info("🚀 Démarrage de Vocalyx Dashboard")
    logger.info(f"🔗 API URL: {config.api_url}")
    
    # Initialiser le client API
    api_client = VocalyxAPIClient(config)
    
    # Vérifier la connexion à l'API
    health = api_client.health_check()
    if health.get("status") == "healthy":
        logger.info("✅ API connection successful")
    else:
        logger.error(f"❌ API connection failed: {health.get('error')}")
    
    # Stocker dans app.state pour accès dans les routes
    app.state.config = config
    app.state.api_client = api_client
    
    # Récupérer les informations du projet admin
    try:
        # Note: On ne peut pas récupérer la clé admin au démarrage
        # Elle sera fournie par l'utilisateur dans l'interface
        logger.info(f"📋 Admin project name: {config.admin_project_name}")
    except Exception as e:
        logger.warning(f"⚠️ Could not verify admin project: {e}")
    
    yield
    
    # --- Shutdown ---
    logger.info("🛑 Arrêt de Vocalyx Dashboard")
    api_client.close()
    await api_client.aclose()

# Créer l'application FastAPI
app = FastAPI(
    title="Vocalyx Dashboard",
    description="Interface web pour la gestion des transcriptions audio",
    version="2.0.0",
    contact={
        "name": "Guilhem RICHARD",
        "email": "guilhem.l.richard@gmail.com"
    },
    lifespan=lifespan,
    docs_url=None,  # Pas besoin de docs pour le dashboard
    redoc_url=None
)

# Monter les fichiers statiques
app.mount("/static", StaticFiles(directory="templates/static"), name="static")

# Configurer les templates
templates = Jinja2Templates(directory=config.templates_dir)

# Inclure les routes du dashboard
app.include_router(dashboard_router)

@app.get("/", response_class=HTMLResponse, tags=["Root"])
async def root(request: Request):
    """Redirection vers le dashboard"""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "api_url": config.api_url,
        "admin_project_name": config.admin_project_name
    })

@app.get("/health", tags=["System"])
def health_check(request: Request):
    """Endpoint de santé du dashboard"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    api_health = api_client.health_check()
    
    return {
        "status": "healthy" if api_health.get("status") == "healthy" else "degraded",
        "service": "vocalyx-dashboard",
        "api_status": api_health.get("status"),
        "api_url": config.api_url
    }

if __name__ == "__main__":
    log_config = get_uvicorn_log_config(log_level=config.log_level)
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        log_config=log_config
    )