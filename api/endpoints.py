"""
Points de terminaison API pour le Dashboard
"""

import json
import logging
import uuid
import httpx
import asyncio
from datetime import datetime
from typing import List, Optional
from pathlib import Path

# Imports FastAPI
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, Form, Path as FastAPIPath, status
from fastapi.responses import HTMLResponse

# Imports Rate Limiting
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Imports DB
from sqlalchemy.orm import Session
from sqlalchemy import exc, func
from config import Config # ❗️ Importation de Config
from database import Transcription, SessionLocal, Project # Importer Project

# Import des nouveaux schémas et dépendances
from models.schemas import TranscriptionResult, ProjectResult, ProjectDetails
from api.dependencies import get_db, get_project_from_key, verify_admin_access, get_config_from_state # ❗️ Ajout de get_config_from_state

config_global = Config() # ❗️ Remplacé par injection de dépendance
logger = logging.getLogger(__name__)

# Fonction clé pour le rate limiting par projet (lit le paramètre de chemin)
def get_project_key(request: Request) -> str:
    project = request.path_params.get("project_name", "default")
    return project

limiter = Limiter(key_func=get_project_key)
RATE_LIMIT = "10/minute" # Cette limite est maintenant PAR PROJET

# ❗️ NOUVEAU: Limiteur pour les endpoints publics (par IP)
limiter_public = Limiter(key_func=get_remote_address)
RATE_LIMIT_PUBLIC = "100/minute"

router = APIRouter()

def sanitize_filename(filename: str) -> str:
    """Nettoie le nom de fichier"""
    return "".join(c for c in filename if c.isalnum() or c in "._-")

# ====================================================================
# ENDPOINTS DE GESTION DE PROJET
# ====================================================================

@router.get("/projects", response_model=List[ProjectResult], tags=["Projects"])
def list_projects(
    db: Session = Depends(get_db),
    admin_access: bool = Depends(verify_admin_access)
):
    """Liste tous les projets (nécessite la clé admin)"""
    projects = db.query(Project).order_by(Project.name).all()
    return projects

@router.get("/projects/{project_name}", response_model=ProjectDetails, tags=["Projects"])
def get_project_details(
    project_name: str,
    db: Session = Depends(get_db),
    admin_access: bool = Depends(verify_admin_access)
):
    """Récupère les détails (avec clé API) d'un projet (nécessite la clé admin)"""
    project = db.query(Project).filter(Project.name == project_name).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/projects", response_model=ProjectDetails, status_code=status.HTTP_201_CREATED, tags=["Projects"])
def create_project(
    project_name: str = Query(..., min_length=3),
    db: Session = Depends(get_db),
    admin_access: bool = Depends(verify_admin_access)
):
    """Crée un nouveau projet (nécessite la clé admin)"""
    new_project = Project(name=project_name)
    db.add(new_project)
    try:
        db.commit()
        db.refresh(new_project)
        return new_project
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Project name already exists")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create project: {e}")

# ====================================================================
# ENDPOINTS DE TRANSCRIPTION (Mis à jour)
# ====================================================================

@router.post("/transcribe/{project_name}", summary="Créer une transcription", tags=["Transcriptions"])
@limiter.limit(RATE_LIMIT)
async def create_transcription(
    request: Request, 
    project: Project = Depends(get_project_from_key), 
    config: Config = Depends(get_config_from_state), # ❗️ AJOUT: Accès à la config
    file: UploadFile = File(...),
    use_vad: Optional[bool] = Form(True)
):
    """
    Accepte un upload, l'enregistre dans le dossier partagé
    et crée une tâche 'pending' dans la DB.
    """
    
    # ❗️ AJOUT: Validation de la taille et de l'extension
    content = await file.read()
    
    # 1. Validation de la taille
    max_size_bytes = config.max_file_size_mb * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(413, f"File size exceeds {config.max_file_size_mb}MB limit")
    
    # 2. Validation de l'extension
    filename = sanitize_filename(file.filename or "upload")
    extension = Path(filename).suffix.lstrip('.').lower()
    if extension not in config.allowed_extensions:
        raise HTTPException(400, f"File type '{extension}' not allowed. Allowed: {config.allowed_extensions}")

    transcription_id = str(uuid.uuid4())
    # ❗️ MODIFICATION: Nom de fichier sécurisé
    safe_filename = f"{transcription_id}_{filename}"
    tmp_path = config.upload_dir.resolve() / safe_filename
    
    with open(tmp_path, "wb") as fh:
        fh.write(content)

    db = SessionLocal()
    try:
        db.add(Transcription(
            id=transcription_id,
            status="pending",
            project_name=project.name,
            vad_enabled=1 if use_vad else 0,
            file_path=safe_filename, # ❗️ MODIFICATION: Stocker uniquement le nom du fichier
            enrichment_requested=1,
            created_at=datetime.utcnow()
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create database entry: {e}")
        raise HTTPException(500, "Failed to create database entry")
    finally:
        db.close()

    logger.info(f"[{transcription_id}] 📥 New job created for project '{project.name}'")
    
    return {"transcription_id": transcription_id, "status": "pending"}

@router.get("/monitoring/status", tags=["Monitoring"])
async def get_monitoring_status(request: Request):
    """
    Interroge tous les workers configurés pour leur statut.
    """
    config: Config = request.app.state.config
    tasks = []
    
    if not hasattr(config, 'worker_urls') or not config.worker_urls:
         logger.warning("Aucun worker configuré dans config.ini ([WORKERS] urls = ...)")
         return []
         
    if not config.internal_api_key:
        logger.error("Clé d'API interne non configurée. Impossible de monitorer les workers.")
        return []
        
    # ❗️ AJOUT: Authentification interne
    headers = {"X-Internal-Api-Key": config.internal_api_key}

    async with httpx.AsyncClient(timeout=3.0) as client:
        for url in config.worker_urls:
            tasks.append(client.get(f"{url.rstrip('/')}/api/worker/status", headers=headers)) # ❗️ Ajout des headers
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    statuses = []
    for i, res in enumerate(results):
        url = config.worker_urls[i]
        if isinstance(res, httpx.Response):
            if res.status_code == 200:
                statuses.append(res.json())
            elif res.status_code == 403:
                 statuses.append({
                    "instance_name": url, "status": "offline", "error": "Auth Error (403)"
                })
            else:
                 statuses.append({
                    "instance_name": url, "status": "offline", "error": f"HTTP Error ({res.status_code})"
                })
        else:
            statuses.append({
                "instance_name": url,
                "status": "offline",
                "max_workers": 0,
                "active_tasks": 0,
                "error": str(res)
            })
            
    return statuses

# === Endpoints de lecture pour l'UI ===

@router.get("/transcribe/count", tags=["Transcriptions"])
@limiter_public.limit(RATE_LIMIT_PUBLIC) # ❗️ AJOUT: Rate limiting public
def get_transcription_count(
    request: Request, # ❗️ AJOUT: Nécessaire pour le rate limiter
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    project_name: Optional[str] = Query(None, alias="project"),
    db: Session = Depends(get_db)
):
    """
    Retourne le nombre total de transcriptions (filtré)
    et la répartition globale par statut.
    """
    
    # 1. Requête pour les comptes filtrés (pour la pagination)
    filtered_query = db.query(Transcription)
    if status:
        filtered_query = filtered_query.filter(Transcription.status == status)
    if search:
        filtered_query = filtered_query.filter(Transcription.text.ilike(f"%{search}%"))
    if project_name:
        filtered_query = filtered_query.filter(Transcription.project_name == project_name)
    
    total_filtered_count = filtered_query.count()

    # 2. Requête pour les comptes globaux (pour les stats du header)
    grouped_counts = (
        db.query(Transcription.status, func.count(Transcription.id))
        .group_by(Transcription.status)
        .all()
    )
    
    result = {
        "total_filtered": total_filtered_count, 
        "pending": 0, 
        "processing": 0, 
        "done": 0, 
        "error": 0,
        "total_global": 0
    }
    
    for s, count in grouped_counts:
        if s in result:
            result[s] = count
            result["total_global"] += count
            
    return result

@router.get("/transcribe/recent", response_model=List[TranscriptionResult], tags=["Transcriptions"])
@limiter_public.limit(RATE_LIMIT_PUBLIC) # ❗️ AJOUT: Rate limiting public
def get_recent_transcriptions(
    request: Request, # ❗️ AJOUT: Nécessaire pour le rate limiter
    limit: int = Query(10, ge=1, le=100), 
    page: int = Query(1, ge=1),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    project_name: Optional[str] = Query(None, alias="project"),
    db: Session = Depends(get_db)
):
    query = db.query(Transcription)
    
    if status:
        query = query.filter(Transcription.status == status)
    if search:
        query = query.filter(Transcription.text.ilike(f"%{search}%"))
    if project_name:
        query = query.filter(Transcription.project_name == project_name)
        
    entries = query.order_by(Transcription.created_at.desc()).limit(limit).offset((page - 1) * limit).all()
    
    results = []
    for entry in entries:
        segments = json.loads(entry.segments) if entry.segments else []
        results.append({
            "id": entry.id,
            "status": entry.status,
            "project_name": entry.project_name,
            "worker_id": entry.worker_id,
            "language": entry.language,
            "processing_time": float(entry.processing_time) if entry.processing_time else None,
            "duration": float(entry.duration) if entry.duration else None,
            "text": entry.text,
            "segments": segments,
            "error_message": entry.error_message,
            "segments_count": entry.segments_count,
            "vad_enabled": bool(entry.vad_enabled),
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "finished_at": entry.finished_at.isoformat() if entry.finished_at else None,
        })
    return results

@router.get("/transcribe/{transcription_id}", response_model=TranscriptionResult, tags=["Transcriptions"])
@limiter_public.limit(RATE_LIMIT_PUBLIC) # ❗️ AJOUT: Rate limiting public
def get_transcription(
    request: Request, # ❗️ AJOUT: Nécessaire pour le rate limiter
    transcription_id: str, 
    db: Session = Depends(get_db)
):
    entry = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    if not entry:
        raise HTTPException(404, "Not found")
    
    segments = json.loads(entry.segments) if entry.segments else []
    return {
        "id": entry.id,
        "status": entry.status,
        "project_name": entry.project_name,
        "worker_id": entry.worker_id,
        "language": entry.language,
        "processing_time": float(entry.processing_time) if entry.processing_time else None,
        "duration": float(entry.duration) if entry.duration else None,
        "text": entry.text,
        "segments": segments,
        "error_message": entry.error_message,
        "segments_count": entry.segments_count,
        "vad_enabled": bool(entry.vad_enabled),
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "finished_at": entry.finished_at.isoformat() if entry.finished_at else None,
    }

@router.delete("/transcribe/{transcription_id}", tags=["Transcriptions"])
@limiter_public.limit(RATE_LIMIT_PUBLIC) # ❗️ AJOUT: Rate limiting public
def delete_transcription(
    request: Request, # ❗️ AJOUT: Nécessaire pour le rate limiter
    transcription_id: str, 
    db: Session = Depends(get_db)
):
    entry = db.query(Transcription).filter(Transcription.id == transcription_id).first()
    if not entry:
        raise HTTPException(404, "Not found")
    
    if entry.file_path:
        try:
            # ❗️ MODIFICATION: Reconstruire le chemin complet pour la suppression
            # Doit utiliser la config du dashboard pour trouver le fichier
            config = request.app.state.config
            file_to_delete = config.upload_dir.resolve() / Path(entry.file_path).name
            file_to_delete.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"Failed to delete audio file {entry.file_path}: {e}")
            
    db.delete(entry)
    db.commit()
    return {"status": "deleted", "id": transcription_id}