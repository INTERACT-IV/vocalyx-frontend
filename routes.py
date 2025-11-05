"""
vocalyx-dashboard/routes.py
Routes du Dashboard (adaptées pour utiliser l'API client)
"""

import logging
from fastapi import APIRouter, Request, Form, UploadFile, File, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from api_client import VocalyxAPIClient
from config import Config

logger = logging.getLogger(__name__)

dashboard_router = APIRouter()
config = Config()
templates = Jinja2Templates(directory=config.templates_dir)

# ============================================================================
# PAGES HTML
# ============================================================================

@dashboard_router.get("/dashboard", response_class=HTMLResponse, tags=["Dashboard"])
async def dashboard_page(request: Request):
    """Page principale du dashboard"""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "api_url": config.api_url,
        "admin_project_name": config.admin_project_name
    })

# ============================================================================
# PROJETS
# ============================================================================

@dashboard_router.get("/api/projects", tags=["Projects"])
async def list_projects(request: Request, admin_key: str = Query(...)):
    """Liste tous les projets (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        projects = api_client.list_projects(admin_key)
        return JSONResponse(content=projects)
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.post("/api/projects", tags=["Projects"])
async def create_project(
    request: Request,
    project_name: str = Form(...),
    admin_key: str = Form(...)
):
    """Crée un nouveau projet (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        project = api_client.create_project(project_name, admin_key)
        return JSONResponse(content=project, status_code=201)
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/api/projects/{project_name}", tags=["Projects"])
async def get_project_details(
    request: Request,
    project_name: str,
    admin_key: str = Query(...)
):
    """Récupère les détails d'un projet (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        project = api_client.get_project_details(project_name, admin_key)
        return JSONResponse(content=project)
    except Exception as e:
        logger.error(f"Error getting project details: {e}")
        raise HTTPException(status_code=404, detail=str(e))

# ============================================================================
# TRANSCRIPTIONS
# ============================================================================

@dashboard_router.post("/api/upload", tags=["Transcriptions"])
async def upload_audio(
    request: Request,
    file: UploadFile = File(...),
    project_name: str = Form(...),
    api_key: str = Form(...),
    use_vad: bool = Form(True)
):
    """Upload un fichier audio et crée une transcription"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        # Lire le contenu du fichier
        content = await file.read()
        
        # Créer la transcription via l'API
        result = await api_client.create_transcription(
            project_name=project_name,
            api_key=api_key,
            file_content=content,
            filename=file.filename or "upload.bin",
            use_vad=use_vad
        )
        
        logger.info(f"✅ Transcription created: {result.get('id')}")
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
    search: str = None
):
    """Récupère les transcriptions récentes (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        transcriptions = api_client.get_transcriptions(
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
    search: str = None
):
    """Compte les transcriptions (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        count = api_client.count_transcriptions(
            status=status,
            project=project,
            search=search
        )
        return JSONResponse(content=count)
    except Exception as e:
        logger.error(f"Error counting transcriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@dashboard_router.get("/api/transcriptions/{transcription_id}", tags=["Transcriptions"])
async def get_transcription(request: Request, transcription_id: str):
    """Récupère une transcription par ID (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        transcription = api_client.get_transcription(transcription_id)
        return JSONResponse(content=transcription)
    except Exception as e:
        logger.error(f"Error getting transcription: {e}")
        raise HTTPException(status_code=404, detail=str(e))

@dashboard_router.delete("/api/transcriptions/{transcription_id}", tags=["Transcriptions"])
async def delete_transcription(request: Request, transcription_id: str):
    """Supprime une transcription (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        result = api_client.delete_transcription(transcription_id)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Error deleting transcription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WORKERS
# ============================================================================

@dashboard_router.get("/api/workers/status", tags=["Workers"])
async def get_workers_status(request: Request):
    """Récupère le statut des workers (proxy vers l'API)"""
    api_client: VocalyxAPIClient = request.app.state.api_client
    
    try:
        status = api_client.get_workers_status()
        return JSONResponse(content=status)
    except Exception as e:
        logger.error(f"Error getting workers status: {e}")
        return JSONResponse(content={
            "worker_count": 0,
            "active_tasks": 0,
            "error": str(e)
        })