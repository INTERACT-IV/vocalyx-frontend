"""
Point d'entrée principal de l'application FastAPI
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

from config import Config
from database import engine, Base, Transcription, SessionLocal, get_or_create_project
from api.dependencies import get_db
from logging_config import setup_logging, get_uvicorn_log_config, setup_colored_logging
from api.endpoints import router as api_router
from api.endpoints import limiter

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

# Créer TOUTES les tables (y compris Project)
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    app.state.config = config
    app.state.limiter = limiter
    
    # 🆕 Logique de création du projet technique
    logger.info("Vérification du projet technique par défaut...")
    db = SessionLocal()
    try:
        project = get_or_create_project(db, config.default_technical_project)
        app.state.default_project_name = project.name
        app.state.default_project_key = project.api_key
        logger.info(f"Projet technique '{project.name}' chargé et prêt.")
    except Exception as e:
        logger.critical(f"CRITIQUE: Echec de la création du projet technique ! {e}")
        # Stocker des valeurs d'erreur
        app.state.default_project_name = "erreur_projet"
        app.state.default_project_key = "erreur_cle"
    finally:
        db.close()
    
    yield
    # --- Shutdown ---
    logger.info("🛑 Arrêt du Dashboard Vocalyx")

# Créer l'application FastAPI
app = FastAPI(
    title="Vocalyx Dashboard",
    description="Vocalyx Dashboard pour la gestion des transcriptions.",
    version="1.0.0",
    contact={"name": "Guilhem RICHARD", "email": "guilhem.l.richard@gmail.com"},
    lifespan=lifespan
)

# Monter les fichiers statiques
app.mount("/static", StaticFiles(directory="templates/static"), name="static")

# Configurer le limiteur de taux
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Inclure les routes de l'API
app.include_router(api_router, prefix="/api")

# Configurer les templates
templates = Jinja2Templates(directory=config.templates_dir)

def get_base_context(request: Request) -> dict:
    """Donne le contexte de base pour les templates"""
    return {
        "request": request,
        "DEFAULT_PROJECT_NAME": request.app.state.default_project_name,
        "DEFAULT_PROJECT_KEY": request.app.state.default_project_key
    }

@app.get("/", response_class=HTMLResponse, tags=["Root"])
def root(request: Request, context: dict = Depends(get_base_context)):
    """Page d'accueil - redirige vers le dashboard"""
    return templates.TemplateResponse("dashboard.html", context)

@app.get("/dashboard", response_class=HTMLResponse, tags=["Dashboard"])
def dashboard(request: Request, context: dict = Depends(get_base_context)):
    """Affiche le dashboard principal"""
    # Note: 'entries' n'est plus pré-chargé, le JS s'en occupe
    return templates.TemplateResponse("dashboard.html", context)

if __name__ == "__main__":
    log_config = get_uvicorn_log_config(
        log_level=config.log_level
    )
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=log_config
    )