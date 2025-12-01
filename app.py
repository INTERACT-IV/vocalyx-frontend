"""
vocalyx-dashboard/app.py
Point d'entrée principal du Dashboard (corrigé pour import circulaire)
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import (
    FastAPI, Request, Depends, HTTPException, status, Form
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

import uvicorn

from config import Config
from api_client import VocalyxAPIClient  # Compatibilité
from infrastructure.api.api_client import VocalyxAPIClient as VocalyxAPIClientRefactored
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
    
    # Initialiser le client API (version refactorisée)
    api_client = VocalyxAPIClientRefactored(config)
    
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

async def render_dashboard(request: Request, token: str, default_view: str = "transcriptions"):
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        user_projects = await api_client.get_user_projects_async(token)
        user_profile = await api_client.get_user_profile_async(token)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des données utilisateur: {e}")
        return RedirectResponse(url="/auth/logout", status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    admin_project_name = config.admin_project_name
    user_is_admin = bool(user_profile.get("is_admin"))
    admin_project = next((p for p in user_projects if p.get("name") == admin_project_name), None)
    default_project = admin_project or (user_projects[0] if user_projects else None)

    default_project_name = default_project.get("name") if default_project else None
    default_project_key = default_project.get("api_key") if default_project else None

    last_login_at = user_profile.get("last_login_at")
    last_login_display = None
    if last_login_at:
        try:
            dt = datetime.fromisoformat(last_login_at)
            last_login_display = dt.strftime("%d/%m/%Y %H:%M:%S")
        except ValueError:
            last_login_display = last_login_at

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "api_url": config.api_url,
        "flower_url": config.flower_url,
        "DEFAULT_PROJECT_NAME": default_project_name or "",
        "DEFAULT_PROJECT_KEY": default_project_key or "",
        "active_page": default_view,
        "user_is_admin": user_is_admin,
        "current_username": user_profile.get("username"),
        "user_last_login": last_login_display,
        "raw_last_login": last_login_at
    })


@app.get("/", tags=["Root"], response_class=HTMLResponse)
async def root(request: Request, token: str = Depends(get_current_token)):
    return await render_dashboard(request, token)


@app.get("/dashboard", tags=["Dashboard"], response_class=HTMLResponse)
async def dashboard_page(request: Request, token: str = Depends(get_current_token)):
    return await render_dashboard(request, token)

@app.get("/admin", response_class=HTMLResponse, tags=["Admin"])
async def admin_page(request: Request, token: str = Depends(get_current_token)):
    """Compatibilité: ouvre le dashboard sur l'onglet Utilisateurs."""
    return await render_dashboard(request, token, default_view="users")


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