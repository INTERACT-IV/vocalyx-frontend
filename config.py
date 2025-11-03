"""
Gestion de la configuration de l'application
"""

import os
import logging
import configparser
from pathlib import Path
from typing import List, Set # ❗️ Ajout de Set

class Config:
    """Charge et gère la configuration depuis config.ini"""
    
    def __init__(self, config_file: str = "config.ini"):
        self.config = configparser.ConfigParser()
        self.config_file = config_file
        
        # Créer config par défaut si n'existe pas
        if not os.path.exists(config_file):
            self._create_default_config()
        
        self.config.read(config_file)
        self._load_settings()
        
    def _create_default_config(self):
        """Crée un fichier de configuration par défaut"""
        config = configparser.ConfigParser()

        config['APP'] = {
            'default_technical_project': 'default_internal'
        }

        config['PATHS'] = {
            'upload_dir': './tmp_uploads',
            'database_path': 'sqlite:///./transcriptions.db',
            'templates_dir': 'templates'
        }
        
        config['LOGGING'] = {
            'level': 'INFO',
            'file_enabled': 'true',
            'file_path': 'logs/vocalyx.log',
            'colored': 'false'
        }

        config['WORKERS'] = {
            'urls': 'http://localhost:8001'
        }
        
        # ❗️ AJOUT
        config['SECURITY'] = {
            'internal_api_key': 'change_me_to_a_secure_secret_key'
        }
        
        # ❗️ AJOUT
        config['LIMITS'] = {
            'max_file_size_mb': '100',
            'allowed_extensions': 'wav,mp3,m4a,flac,ogg,webm'
        }
        
        with open(self.config_file, 'w') as f:
            config.write(f)
        
        logging.info(f"✅ Created default config file: {self.config_file}")
    
    def _load_settings(self):
        """Charge les paramètres dans des attributs"""
        # APP
        self.default_technical_project = self.config.get('APP', 'default_technical_project', fallback='default_internal')

        # PATHS
        self.upload_dir = Path(self.config.get('PATHS', 'upload_dir'))
        self.database_path = self.config.get('PATHS', 'database_path')
        self.templates_dir = self.config.get('PATHS', 'templates_dir')
        
        # LOGGING
        self.log_level = self.config.get('LOGGING', 'level', fallback='INFO')
        self.log_file_enabled = self.config.getboolean('LOGGING', 'file_enabled', fallback=True)
        self.log_file_path = self.config.get('LOGGING', 'file_path', fallback='logs/vocalyx.log')
        self.log_colored = self.config.getboolean('LOGGING', 'colored', fallback=False)

        # WORKERS
        worker_urls_str = self.config.get('WORKERS', 'urls', fallback='')
        self.worker_urls: List[str] = [
            url.strip() for url in worker_urls_str.split(',') if url.strip()
        ]
        
        # ❗️ AJOUT: SECURITY
        self.internal_api_key = self.config.get('SECURITY', 'internal_api_key', fallback=None)
        if not self.internal_api_key or self.internal_api_key == 'change_me_to_a_secure_secret_key':
            logging.warning("⚠️ Clé d'API interne non définie ou par défaut. Communication inter-services non sécurisée.")
            self.internal_api_key = None
            
        # ❗️ AJOUT: LIMITS
        self.max_file_size_mb = self.config.getint('LIMITS', 'max_file_size_mb', fallback=100)
        self.allowed_extensions: Set[str] = set(
            ext.strip().lower() for ext in self.config.get('LIMITS', 'allowed_extensions', fallback='wav,mp3').split(',')
        )
        
        # Créer les répertoires
        self.upload_dir.mkdir(exist_ok=True)
    
    def reload(self):
        """Recharge la configuration depuis le fichier"""
        self.config.read(self.config_file)
        self._load_settings()
        logging.info("🔄 Configuration reloaded")