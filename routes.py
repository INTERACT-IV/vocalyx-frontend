"""
vocalyx-dashboard/routes.py
Routes du Dashboard (corrigé pour import circulaire)
"""

import logging
from fastapi import APIRouter, Request, Form, UploadFile, File, HTTPException, Query, Body, Depends
from fastapi.responses import JSONResponse

from api_client import VocalyxAPIClient
from config import Config

# --- MODIFICATION: Importer depuis auth_deps.py ---
from auth_deps import get_current_token
# --- FIN MODIFICATION ---

logger = logging.getLogger(__name__)

dashboard_router = APIRouter()
config = Config()


def ensure_admin_access(api_client: VocalyxAPIClient, token: str):
    """Vérifie que l'utilisateur courant est administrateur."""
    profile = api_client.get_user_profile(token)
    if not profile.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return profile

# ============================================================================
# PAGES HTML
# ============================================================================

# ============================================================================
# PROJETS
# ============================================================================

@dashboard_router.get("/api/projects", tags=["Projects"])
async def list_projects(
    request: Request,
    admin_key: str = Query(...),
    token: str = Depends(get_current_token)
):
    """Liste tous les projets (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        ensure_admin_access(api_client, token)
        projects = api_client.list_projects(admin_key)
        return JSONResponse(content=projects)
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("/api/projects", tags=["Projects"])
async def create_project(
    request: Request,
    project_name: str = Form(...),
    admin_key: str = Form(...),
    token: str = Depends(get_current_token)
):
    """Crée un nouveau projet (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        ensure_admin_access(api_client, token)
        project = api_client.create_project(project_name, admin_key)
        return JSONResponse(content=project, status_code=201)
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/api/projects/{project_name}", tags=["Projects"])
async def get_project_details(
    request: Request,
    project_name: str,
    admin_key: str = Query(...),
    token: str = Depends(get_current_token)
):
    """Récupère les détails d'un projet (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        ensure_admin_access(api_client, token)
        project = api_client.get_project_details(project_name, admin_key)
        return JSONResponse(content=project)
    except Exception as e:
        logger.error(f"Error getting project details: {e}")
        raise HTTPException(status_code=404, detail=str(e))

@dashboard_router.get("/api/user/projects", tags=["Projects"])
async def list_user_projects_proxy(
    request: Request,
    token: str = Depends(get_current_token)
):
    """Liste les projets accessibles par l'utilisateur courant."""
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        projects = api_client.get_user_projects(token)
        return JSONResponse(content=projects)
    except Exception as e:
        logger.error(f"Error getting user projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# TRANSCRIPTIONS
# ============================================================================

@dashboard_router.post("/api/upload", tags=["Transcriptions"])
async def upload_audio(
    request: Request,
    file: UploadFile = File(...),
    project_name: str = Form(...),
    api_key: str = Form(...),
    use_vad: bool = Form(True),
    diarization: bool = Form(False),
    token: str = Depends(get_current_token)
):
    """Upload un fichier audio pour transcription (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        # Lire le contenu du fichier
        file_content = await file.read()
        filename = file.filename or "audio.wav"
        
        # Appeler l'API pour créer la transcription
        result = await api_client.create_transcription(
            project_name=project_name,
            api_key=api_key,
            file_content=file_content,
            filename=filename,
            use_vad=use_vad,
            diarization=diarization
        )
        return JSONResponse(content=result, status_code=201)
    except Exception as e:
        logger.error(f"Error uploading audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/api/transcriptions/recent", tags=["Transcriptions"])
async def get_recent_transcriptions(
    request: Request,
    page: int = 1,
    limit: int = 25,
    status: str = None,
    project: str = None,
    search: str = None,
    token: str = Depends(get_current_token)  # ✅ AJOUT
):
    """Récupère les transcriptions récentes (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        transcriptions = api_client.get_user_transcriptions(
            jwt_token=token,
            page=page,
            limit=limit,
            status=status,
            project=project,
            search=search
        )
        return JSONResponse(content=transcriptions)
    except Exception as e:
        logger.error(f"Error getting transcriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/api/transcriptions/count", tags=["Transcriptions"])
async def count_transcriptions(
    request: Request,
    status: str = None,
    project: str = None,
    search: str = None,
    token: str = Depends(get_current_token)  # ✅ AJOUT
):
    """Compte les transcriptions (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        count = api_client.count_user_transcriptions(
            jwt_token=token,
            status=status,
            project=project,
            search=search
        )
        return JSONResponse(content=count)
    except Exception as e:
        logger.error(f"Error counting transcriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/api/transcriptions/{transcription_id}", tags=["Transcriptions"])
async def get_transcription(
    request: Request, 
    transcription_id: str,
    token: str = Depends(get_current_token)  # ✅ AJOUT
):
    """Récupère une transcription par ID (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        transcription = api_client.get_user_transcription(jwt_token=token, transcription_id=transcription_id)
        return JSONResponse(content=transcription)
    except Exception as e:
        logger.error(f"Error getting transcription: {e}")
        raise HTTPException(status_code=404, detail=str(e))

@dashboard_router.delete("/api/transcriptions/{transcription_id}", tags=["Transcriptions"])
async def delete_transcription(
    request: Request, 
    transcription_id: str,
    token: str = Depends(get_current_token)  # ✅ AJOUT
):
    """Supprime une transcription (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        ensure_admin_access(api_client, token)
        result = api_client.delete_transcription(transcription_id)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Error deleting transcription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WORKERS
# ============================================================================

@dashboard_router.get("/api/workers/status", tags=["Workers"])
async def get_workers_status(
    request: Request,
    token: str = Depends(get_current_token)  # ✅ AJOUT
):
    """Récupère le statut des workers (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        ensure_admin_access(api_client, token)
        status = api_client.get_workers_status()
        return JSONResponse(content=status)
    except Exception as e:
        logger.error(f"Error getting workers status: {e}")
        return JSONResponse(content={
            "worker_count": 0,
            "active_tasks": 0,
            "error": str(e)
        })

# ============================================================================
# GESTION DES UTILISATEURS (NOUVEAU)
# ============================================================================
# Ces routes utilisent Depends(get_current_token) qui est maintenant
# importé proprement.

@dashboard_router.get("/api/admin/users", tags=["Admin"], dependencies=[Depends(get_current_token)])
async def proxy_list_users(request: Request, token: str = Depends(get_current_token)):
    """[Proxy Admin] Liste tous les utilisateurs"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        users = api_client.list_users(admin_token=token)
        return JSONResponse(content=users)
    except Exception as e:
        logger.error(f"Error proxying list_users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("/api/admin/users", tags=["Admin"], dependencies=[Depends(get_current_token)])
async def proxy_create_user(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    is_admin: bool = Form(False),
    token: str = Depends(get_current_token)
):
    """[Proxy Admin] Crée un nouvel utilisateur"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        user = api_client.create_user(
            admin_token=token,
            username=username,
            password=password,
            is_admin=is_admin
        )
        return JSONResponse(content=user, status_code=201)
    except Exception as e:
        logger.error(f"Error proxying create_user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("/api/admin/users/assign-project", tags=["Admin"], dependencies=[Depends(get_current_token)])
async def proxy_assign_project(
    request: Request,
    data: dict = Body(...),
    token: str = Depends(get_current_token)
):
    """[Proxy Admin] Associe un projet à un utilisateur"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        user_id = data.get("user_id")
        project_id = data.get("project_id")
        if not user_id or not project_id:
            raise HTTPException(status_code=400, detail="user_id and project_id requis")
            
        user = api_client.assign_project_to_user(
            admin_token=token,
            user_id=user_id,
            project_id=project_id
        )
        return JSONResponse(content=user)
    except Exception as e:
        logger.error(f"Error proxying assign_project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("/api/admin/users/remove-project", tags=["Admin"], dependencies=[Depends(get_current_token)])
async def proxy_remove_project(
    request: Request,
    data: dict = Body(...),
    token: str = Depends(get_current_token)
):
    """[Proxy Admin] Dissocie un projet d'un utilisateur"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        user_id = data.get("user_id")
        project_id = data.get("project_id")
        if not user_id or not project_id:
            raise HTTPException(status_code=400, detail="user_id and project_id requis")

        user = api_client.remove_project_from_user(
            admin_token=token,
            user_id=user_id,
            project_id=project_id
        )
        return JSONResponse(content=user)
    except Exception as e:
        logger.error(f"Error proxying remove_project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.delete("/api/admin/users/{user_id}", tags=["Admin"], dependencies=[Depends(get_current_token)])
async def proxy_delete_user(
    user_id: str,
    request: Request,
    token: str = Depends(get_current_token)
):
    """[Proxy Admin] Supprime un utilisateur"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    try:
        result = api_client.delete_user(admin_token=token, user_id=user_id)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Error proxying delete_user: {e}")
        raise HTTPException(status_code=500, detail=str(e))