"""
Dépendances FastAPI
"""
import secrets
from fastapi import Depends, HTTPException, status, Header, Path
from sqlalchemy.orm import Session
from database import SessionLocal, Project, Config

config = Config()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_project_from_key(
    project_name: str = Path(..., description="Le nom du projet"),
    x_api_key: str = Header(..., description="La clé d'API du projet"),
    db: Session = Depends(get_db)
) -> Project:
    """
    Valide que la clé d'API correspond au projet.
    """
    project = db.query(Project).filter(Project.name == project_name).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Project not found"
        )
    
    if not secrets.compare_digest(project.api_key, x_api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Invalid API Key for this project"
        )
    
    return project

def verify_admin_access(
    x_api_key: str = Header(..., description="La clé d'API du projet technique (admin)"),
    db: Session = Depends(get_db)
) -> bool:
    """
    Valide que la clé API est celle du projet technique configuré
    """
    # Nous avons besoin de récupérer la clé du projet admin
    # (Note: app.state n'est pas accessible ici, nous le chargeons)
    admin_project = db.query(Project).filter(Project.name == config.default_technical_project).first()
    
    if not admin_project:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Admin project not configured correctly"
        )
    
    if not secrets.compare_digest(admin_project.api_key, x_api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin access required"
        )
    
    return True