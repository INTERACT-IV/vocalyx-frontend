"""
vocalyx-dashboard/app.py
Point d'entrée principal du Dashboard (corrigé pour import circulaire)
"""

import logging
from contextlib import asynccontextmanager
from fastapi import (
    FastAPI, Request, Depends, HTTPException, status, Form
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

import uvicorn

from config import Config
from api_client import VocalyxAPIClient
from routes import dashboard_router
from logging_config import setup_logging, setup_colored_logging, get_uvicorn_log_config

# --- MODIFICATION: Importer depuis auth_deps ---
from auth_deps import get_current_token, AUTH_COOKIE_NAME
# --- FIN MODIFICATION ---

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
    docs_url=None,
    redoc_url=None
)

# Monter les fichiers statiques
app.mount("/static", StaticFiles(directory="templates/static"), name="static")

# Configurer les templates
templates = Jinja2Templates(directory=config.templates_dir)

# Inclure les routes du dashboard (celles de routes.py)
app.include_router(dashboard_router)


# ============================================================================
# GESTION DE L'AUTHENTIFICATION
# ============================================================================

# --- MODIFICATION: La fonction get_current_token a été déplacée ---
# dans auth_deps.py pour éviter l'import circulaire

@app.get("/login", response_class=HTMLResponse, tags=["Authentication"])
async def login_page(request: Request):
    """Sert la page de login HTML"""
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/auth/login", response_class=JSONResponse, tags=["Authentication"])
async def login_process(
    request: Request,
    username: str = Form(...),
    password: str = Form(...)
):
    """
    Endpoint (côté frontend) que le JS de login.js appelle.
    Il appelle l'API backend pour obtenir le token et le stocke dans un cookie.
    """
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        # 1. Obtenir le token JWT depuis l'API backend
        token_data = await api_client.login_to_api(username, password)
        access_token = token_data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=401, detail="Token non reçu de l'API")

        # 2. Créer la réponse et attacher le cookie
        response = JSONResponse(content={"status": "ok", "message": "Login successful"})
        response.set_cookie(
            key=AUTH_COOKIE_NAME, # Utilise la constante importée
            value=access_token,
            httponly=True,       
            secure=False,        # Mettre True en production (HTTPS)
            samesite="lax",      
            max_age=60 * 60 * 24 * 7 # 7 jours
        )
        return response
        
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects ou erreur API"
        )

@app.get("/auth/logout", tags=["Authentication"])
async def logout(request: Request):
    """Déconnecte l'utilisateur en supprimant le cookie"""
    response = RedirectResponse(url="/login", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.delete_cookie(AUTH_COOKIE_NAME) # Utilise la constante importée
    return response

# --- AJOUT DU NOUVEL ENDPOINT ---
@app.get("/auth/get-token", tags=["Authentication"])
async def get_ws_token(
    request: Request,
    token: str = Depends(get_current_token) # Protégé par le cookie
):
    """
    Fournit au JavaScript le token d'authentification (lu depuis le cookie HttpOnly)
    afin de l'utiliser pour la connexion WebSocket.
    """
    # get_current_token a déjà fait le travail de vérification
    # et a retourné la valeur du token.
    return JSONResponse(content={"access_token": token})
# --- FIN DE L'AJOUT ---


# ============================================================================
# ROUTES PRINCIPALES (MODIFIÉES)
# ============================================================================

@app.get("/", response_class=HTMLResponse, tags=["Root"])
async def root(request: Request, token: str = Depends(get_current_token)):
    """
    Sert le Dashboard principal.
    Protégé par le cookie de login.
    Récupère la clé API Admin et l'injecte dans le JS.
    """
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        # Utiliser le token pour récupérer la vraie clé API Admin
        admin_project_details = await api_client.get_admin_api_key_async(token)
        admin_api_key = admin_project_details.get("api_key")
        
        return templates.TemplateResponse("dashboard.html", {
            "request": request,
            "api_url": config.api_url,
            "DEFAULT_PROJECT_NAME": config.admin_project_name,
            "DEFAULT_PROJECT_KEY": admin_api_key  # Injection de la clé
        })
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la clé admin: {e}")
        # Si la clé admin expire, rediriger vers le login
        return RedirectResponse(url="/auth/logout", status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@app.get("/admin", response_class=HTMLResponse, tags=["Admin"])
async def admin_page(request: Request, token: str = Depends(get_current_token)):
    """
    Sert la nouvelle page d'administration.
    Récupère également la clé API Admin pour la gestion.
    """
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        admin_project_details = await api_client.get_admin_api_key_async(token)
        admin_api_key = admin_project_details.get("api_key")
        
        return templates.TemplateResponse("admin.html", {
            "request": request,
            "ADMIN_API_KEY": admin_api_key
        })
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la clé admin: {e}")
        return RedirectResponse(url="/auth/logout", status_code=status.HTTP_307_TEMPORARY_REDIRECT)


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