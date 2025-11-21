"""
AuthService - Service applicatif pour l'authentification
"""

import logging
from typing import Optional, Dict, Any
from infrastructure.api.api_client import VocalyxAPIClient

logger = logging.getLogger(__name__)


class AuthService:
    """Service pour la gestion de l'authentification"""
    
    def __init__(self, api_client: VocalyxAPIClient):
        self.api_client = api_client
    
    async def login(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authentifie un utilisateur et retourne le token JWT"""
        try:
            token_data = await self.api_client.login(username, password)
            access_token = token_data.get("access_token")
            
            if not access_token:
                logger.warning(f"Login failed: No token received for user '{username}'")
                return None
            
            logger.info(f"Login successful for user '{username}'")
            return {
                "access_token": access_token,
                "token_type": token_data.get("token_type", "bearer")
            }
        except Exception as e:
            logger.error(f"Login failed for user '{username}': {e}")
            return None
    
    async def get_user_profile(self, token: str) -> Optional[Dict[str, Any]]:
        """Récupère le profil de l'utilisateur courant"""
        try:
            return await self.api_client.get_user_profile(token)
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return None

