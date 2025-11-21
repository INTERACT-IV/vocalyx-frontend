"""
ProjectService - Service applicatif pour la gestion des projets
"""

import logging
from typing import List, Optional, Dict, Any
from infrastructure.api.api_client import VocalyxAPIClient

logger = logging.getLogger(__name__)


class ProjectService:
    """Service pour la gestion des projets"""
    
    def __init__(self, api_client: VocalyxAPIClient):
        self.api_client = api_client
    
    async def get_user_projects(self, token: str) -> List[Dict[str, Any]]:
        """Récupère les projets accessibles à l'utilisateur courant"""
        try:
            return await self.api_client.get_user_projects(token)
        except Exception as e:
            logger.error(f"Error getting user projects: {e}")
            return []
    
    def create_project(self, project_name: str, admin_key: str) -> Optional[Dict[str, Any]]:
        """Crée un nouveau projet (nécessite clé admin)"""
        try:
            return self.api_client.create_project(project_name, admin_key)
        except Exception as e:
            logger.error(f"Error creating project '{project_name}': {e}")
            return None
    
    def list_projects(self, admin_key: str) -> List[Dict[str, Any]]:
        """Liste tous les projets (nécessite clé admin)"""
        try:
            return self.api_client.list_projects(admin_key)
        except Exception as e:
            logger.error(f"Error listing projects: {e}")
            return []
    
    def get_default_project(self, projects: List[Dict[str, Any]], admin_project_name: str) -> Optional[Dict[str, Any]]:
        """Récupère le projet par défaut (admin ou premier projet)"""
        # Chercher le projet admin
        admin_project = next((p for p in projects if p.get("name") == admin_project_name), None)
        if admin_project:
            return admin_project
        
        # Sinon, retourner le premier projet
        return projects[0] if projects else None

