"""
TranscriptionService - Service applicatif pour la gestion des transcriptions
"""

import logging
from typing import List, Optional, Dict, Any
from infrastructure.api.api_client import VocalyxAPIClient

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Service pour la gestion des transcriptions"""
    
    def __init__(self, api_client: VocalyxAPIClient):
        self.api_client = api_client
    
    async def create_transcription(
        self,
        project_name: str,
        api_key: str,
        file_content: bytes,
        filename: str,
        use_vad: bool = True,
        diarization: bool = False,
        whisper_model: str = "small"
    ) -> Optional[Dict[str, Any]]:
        """Crée une nouvelle transcription"""
        try:
            return await self.api_client.create_transcription(
                project_name=project_name,
                api_key=api_key,
                file_content=file_content,
                filename=filename,
                use_vad=use_vad,
                diarization=diarization,
                whisper_model=whisper_model
            )
        except Exception as e:
            logger.error(f"Error creating transcription: {e}")
            return None
    
    def list_transcriptions(
        self,
        token: str,
        page: int = 1,
        limit: int = 25,
        status: Optional[str] = None,
        project: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Liste les transcriptions accessibles à l'utilisateur courant"""
        try:
            return self.api_client.get_user_transcriptions(
                jwt_token=token,
                page=page,
                limit=limit,
                status=status,
                project=project,
                search=search
            )
        except Exception as e:
            logger.error(f"Error listing transcriptions: {e}")
            return []
    
    def count_transcriptions(
        self,
        token: str,
        status: Optional[str] = None,
        project: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, int]:
        """Compte les transcriptions accessibles à l'utilisateur courant"""
        try:
            return self.api_client.count_user_transcriptions(
                jwt_token=token,
                status=status,
                project=project,
                search=search
            )
        except Exception as e:
            logger.error(f"Error counting transcriptions: {e}")
            return {
                "total_filtered": 0,
                "pending": 0, "processing": 0, "done": 0, "error": 0, "total_global": 0
            }
    
    def get_transcription(self, token: str, transcription_id: str) -> Optional[Dict[str, Any]]:
        """Récupère une transcription par son ID"""
        try:
            return self.api_client.get_user_transcription(token, transcription_id)
        except Exception as e:
            logger.error(f"Error getting transcription '{transcription_id}': {e}")
            return None

