"""
vocalyx-dashboard/api_client.py
Client HTTP pour communiquer avec vocalyx-api (avec support JWT)
"""

import logging
from typing import List, Optional, Dict, Any
import httpx
from config import Config

logger = logging.getLogger(__name__)

class VocalyxAPIClient:
    """
    Client HTTP pour toutes les interactions avec vocalyx-api.
    Remplace l'accès direct à la base de données.
    """
    
    def __init__(self, config: Config):
        self.base_url = config.api_url.rstrip('/')
        self.internal_key = config.internal_api_key
        self.timeout = httpx.Timeout(30.0, connect=5.0)
        
        # Client synchrone pour les routes FastAPI
        self.client = httpx.Client(timeout=self.timeout)
        
        # Client asynchrone pour les opérations async
        self.async_client = httpx.AsyncClient(timeout=self.timeout)
        
        logger.info(f"API Client initialized: {self.base_url}")
    
    def _get_headers(self, internal: bool = True, jwt_token: str = None) -> Dict[str, str]:
        """Génère les headers d'authentification"""
        headers = {}
        if internal:
            headers["X-Internal-Key"] = self.internal_key
        if jwt_token:
            headers["Authorization"] = f"Bearer {jwt_token}"
        return headers
    
    async def login_to_api(self, username: str, password: str) -> Dict[str, Any]:
        """
        [Async] Appelle l'API backend pour obtenir un token JWT.
        Utilise le format OAuth2PasswordRequestForm (form data).
        """
        try:
            data = {
                "username": username,
                "password": password
            }
            response = await self.async_client.post(
                f"{self.base_url}/api/auth/token",
                data=data
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error logging into API: {e}")
            raise
    
    async def get_admin_api_key_async(self, jwt_token: str) -> Dict[str, Any]:
        """
        [Async] Appelle l'API backend pour obtenir la clé API admin en utilisant un JWT.
        """
        try:
            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = await self.async_client.get(
                f"{self.base_url}/api/admin/admin-api-key",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting admin API key: {e}")
            raise

    async def get_user_profile_async(self, jwt_token: str) -> Dict[str, Any]:
        """
        [Async] Récupère les informations du profil utilisateur courant.
        """
        try:
            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = await self.async_client.get(
                f"{self.base_url}/api/user/me",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting user profile (async): {e}")
            raise

    def get_user_profile(self, jwt_token: str) -> Dict[str, Any]:
        """
        Récupère les informations du profil utilisateur (synchrone).
        """
        try:
            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = self.client.get(
                f"{self.base_url}/api/user/me",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting user profile: {e}")
            raise

    async def get_user_projects_async(self, jwt_token: str) -> List[Dict[str, Any]]:
        """
        [Async] Récupère la liste des projets (et leurs clés) accessibles pour l'utilisateur courant.
        """
        try:
            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = await self.async_client.get(
                f"{self.base_url}/api/user/projects",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting user projects: {e}")
            raise

    def get_user_projects(self, jwt_token: str) -> List[Dict[str, Any]]:
        """
        [Sync] Version synchrone utilisée par les routes proxy du dashboard.
        """
        try:
            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = self.client.get(
                f"{self.base_url}/api/user/projects",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting user projects (sync): {e}")
            raise
    
    # ========================================================================
    # PROJETS
    # ========================================================================
    
    def create_project(self, project_name: str, admin_key: str) -> Dict[str, Any]:
        """Crée un nouveau projet (nécessite clé admin)"""
        try:
            response = self.client.post(
                f"{self.base_url}/api/projects",
                json={"name": project_name},
                headers={"X-API-Key": admin_key}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error creating project: {e}")
            raise
    
    def list_projects(self, admin_key: str) -> List[Dict[str, Any]]:
        """Liste tous les projets (nécessite clé admin)"""
        try:
            response = self.client.get(
                f"{self.base_url}/api/projects",
                headers={"X-API-Key": admin_key}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error listing projects: {e}")
            raise
    
    def get_project_details(self, project_name: str, admin_key: str) -> Dict[str, Any]:
        """Récupère les détails d'un projet avec sa clé API"""
        try:
            response = self.client.get(
                f"{self.base_url}/api/projects/{project_name}",
                headers={"X-API-Key": admin_key}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting project details: {e}")
            raise
    
    # ========================================================================
    # TRANSCRIPTIONS
    # ========================================================================
    
    async def create_transcription(
        self,
        project_name: str,
        api_key: str,
        file_content: bytes,
        filename: str,
        use_vad: bool = True
    ) -> Dict[str, Any]:
        """Crée une nouvelle transcription"""
        try:
            files = {"file": (filename, file_content)}
            data = {
                "project_name": project_name,
                "use_vad": str(use_vad).lower()
            }
            headers = {"X-API-Key": api_key}
            
            response = await self.async_client.post(
                f"{self.base_url}/api/transcriptions",
                files=files,
                data=data,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error creating transcription: {e}")
            raise
    
    def get_transcriptions(
        self,
        page: int = 1,
        limit: int = 25,
        status: Optional[str] = None,
        project: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Liste les transcriptions avec filtres et pagination"""
        try:
            params = {"page": page, "limit": limit}
            if status:
                params["status"] = status
            if project:
                params["project"] = project
            if search:
                params["search"] = search
            
            response = self.client.get(
                f"{self.base_url}/api/transcriptions",
                params=params,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting transcriptions: {e}")
            raise

    def get_user_transcriptions(
        self,
        jwt_token: str,
        page: int = 1,
        limit: int = 25,
        status: Optional[str] = None,
        project: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Liste les transcriptions accessibles à l'utilisateur courant."""
        try:
            params = {"page": page, "limit": limit}
            if status:
                params["status"] = status
            if project:
                params["project"] = project
            if search:
                params["search"] = search

            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = self.client.get(
                f"{self.base_url}/api/user/transcriptions",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting user transcriptions: {e}")
            raise
    
    def get_transcription(self, transcription_id: str) -> Dict[str, Any]:
        """Récupère une transcription par son ID"""
        try:
            response = self.client.get(
                f"{self.base_url}/api/transcriptions/{transcription_id}",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting transcription: {e}")
            raise

    def get_user_transcription(self, jwt_token: str, transcription_id: str) -> Dict[str, Any]:
        """Récupère une transcription à laquelle l'utilisateur peut accéder."""
        try:
            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = self.client.get(
                f"{self.base_url}/api/user/transcriptions/{transcription_id}",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting user transcription: {e}")
            raise
    
    def delete_transcription(self, transcription_id: str) -> Dict[str, Any]:
        """Supprime une transcription"""
        try:
            response = self.client.delete(
                f"{self.base_url}/api/transcriptions/{transcription_id}",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error deleting transcription: {e}")
            raise
    
    def count_transcriptions(
        self,
        status: Optional[str] = None,
        project: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, int]:
        """Compte les transcriptions avec filtres"""
        try:
            params = {}
            if status:
                params["status"] = status
            if project:
                params["project"] = project
            if search:
                params["search"] = search
            
            response = self.client.get(
                f"{self.base_url}/api/transcriptions/count",
                params=params,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error counting transcriptions: {e}")
            raise

    def count_user_transcriptions(
        self,
        jwt_token: str,
        status: Optional[str] = None,
        project: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, int]:
        """Compte les transcriptions accessibles à l'utilisateur courant."""
        try:
            params = {}
            if status:
                params["status"] = status
            if project:
                params["project"] = project
            if search:
                params["search"] = search

            headers = self._get_headers(internal=False, jwt_token=jwt_token)
            response = self.client.get(
                f"{self.base_url}/api/user/transcriptions/count",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error counting user transcriptions: {e}")
            raise
    
    # ========================================================================
    # WORKERS & CELERY
    # ========================================================================
    
    def get_workers_status(self) -> Dict[str, Any]:
        """Récupère le statut des workers Celery"""
        try:
            response = self.client.get(
                f"{self.base_url}/api/workers",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting workers status: {e}")
            return {
                "worker_count": 0,
                "active_tasks": 0,
                "error": str(e)
            }
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Récupère le statut d'une tâche Celery"""
        try:
            response = self.client.get(
                f"{self.base_url}/api/tasks/{task_id}",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error getting task status: {e}")
            raise
    
    def cancel_task(self, task_id: str) -> Dict[str, Any]:
        """Annule une tâche Celery"""
        try:
            response = self.client.post(
                f"{self.base_url}/api/tasks/{task_id}/cancel",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error cancelling task: {e}")
            raise

    # ========================================================================
    # ADMIN USER MANAGEMENT (avec JWT)
    # ========================================================================

    def list_users(self, admin_token: str) -> List[Dict[str, Any]]:
        """[Admin] Liste tous les utilisateurs"""
        try:
            headers = self._get_headers(internal=False, jwt_token=admin_token)
            response = self.client.get(
                f"{self.base_url}/api/admin/users",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error listing users: {e}")
            raise

    def create_user(self, admin_token: str, username: str, password: str, is_admin: bool) -> Dict[str, Any]:
        """[Admin] Crée un nouvel utilisateur"""
        try:
            headers = self._get_headers(internal=False, jwt_token=admin_token)
            data = {
                "username": username,
                "password": password,
                "is_admin": is_admin
            }
            response = self.client.post(
                f"{self.base_url}/api/admin/users",
                json=data,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error creating user: {e}")
            raise

    def assign_project_to_user(self, admin_token: str, user_id: str, project_id: str) -> Dict[str, Any]:
        """[Admin] Associe un projet à un utilisateur"""
        try:
            headers = self._get_headers(internal=False, jwt_token=admin_token)
            data = {"user_id": user_id, "project_id": project_id}
            response = self.client.post(
                f"{self.base_url}/api/admin/users/assign-project",
                json=data,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error assigning project: {e}")
            raise
            
    def remove_project_from_user(self, admin_token: str, user_id: str, project_id: str) -> Dict[str, Any]:
        """[Admin] Dissocie un projet d'un utilisateur"""
        try:
            headers = self._get_headers(internal=False, jwt_token=admin_token)
            data = {"user_id": user_id, "project_id": project_id}
            response = self.client.post(
                f"{self.base_url}/api/admin/users/remove-project",
                json=data,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error removing project: {e}")
            raise

    def delete_user(self, admin_token: str, user_id: str) -> Dict[str, Any]:
        """[Admin] Supprime un utilisateur"""
        try:
            headers = self._get_headers(internal=False, jwt_token=admin_token)
            response = self.client.delete(
                f"{self.base_url}/api/admin/users/{user_id}",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error deleting user: {e}")
            raise
    
    # ========================================================================
    # HEALTH CHECK
    # ========================================================================
    
    def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé de l'API"""
        try:
            response = self.client.get(
                f"{self.base_url}/health",
                timeout=httpx.Timeout(5.0)
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def close(self):
        """Ferme les clients HTTP"""
        self.client.close()
    
    async def aclose(self):
        """Ferme les clients HTTP (async)"""
        await self.async_client.aclose()