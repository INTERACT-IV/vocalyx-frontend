"""
UserService - Service applicatif pour la gestion des utilisateurs (admin)
"""

import logging
from typing import List, Optional, Dict, Any
from infrastructure.api.api_client import VocalyxAPIClient

logger = logging.getLogger(__name__)


class UserService:
    """Service pour la gestion des utilisateurs (admin uniquement)"""
    
    def __init__(self, api_client: VocalyxAPIClient):
        self.api_client = api_client
    
    def list_users(self, admin_token: str) -> List[Dict[str, Any]]:
        """[Admin] Liste tous les utilisateurs"""
        try:
            return self.api_client.list_users(admin_token)
        except Exception as e:
            logger.error(f"Error listing users: {e}")
            return []
    
    def create_user(
        self,
        admin_token: str,
        username: str,
        password: str,
        is_admin: bool = False
    ) -> Optional[Dict[str, Any]]:
        """[Admin] Crée un nouvel utilisateur"""
        try:
            return self.api_client.create_user(admin_token, username, password, is_admin)
        except Exception as e:
            logger.error(f"Error creating user '{username}': {e}")
            return None
    
    def assign_project(self, admin_token: str, user_id: str, project_id: str) -> Optional[Dict[str, Any]]:
        """[Admin] Associe un projet à un utilisateur"""
        try:
            return self.api_client.assign_project_to_user(admin_token, user_id, project_id)
        except Exception as e:
            logger.error(f"Error assigning project to user: {e}")
            return None
    
    def remove_project(self, admin_token: str, user_id: str, project_id: str) -> Optional[Dict[str, Any]]:
        """[Admin] Dissocie un projet d'un utilisateur"""
        try:
            return self.api_client.remove_project_from_user(admin_token, user_id, project_id)
        except Exception as e:
            logger.error(f"Error removing project from user: {e}")
            return None
    
    def delete_user(self, admin_token: str, user_id: str) -> bool:
        """[Admin] Supprime un utilisateur"""
        try:
            self.api_client.delete_user(admin_token, user_id)
            return True
        except Exception as e:
            logger.error(f"Error deleting user '{user_id}': {e}")
            return False

