"""
vocalyx-dashboard/config.py
Configuration du Dashboard (adapté pour l'architecture microservices)
"""

import os
import logging
import configparser
from pathlib import Path

class Config:
    """Charge et gère la configuration depuis config.ini"""
    
    def __init__(self, config_file: str = "config.ini"):
        self.config = configparser.ConfigParser()
        self.config_file = config_file
        
        if not os.path.exists(config_file):
            self._create_default_config()
        
        self.config.read(config_file)
        self._load_settings()
        
    def _create_default_config(self):
        """Crée un fichier de configuration par défaut"""
        config = configparser.ConfigParser()
        
        config['API'] = {
            'url': 'http://localhost:8000',
            'timeout': '30'
        }
        
        config['SECURITY'] = {
            'internal_api_key': 'CHANGE_ME_SECRET_INTERNAL_KEY_12345',
            'admin_project_name': 'ISICOMTECH'
        }
        
        config['PATHS'] = {
            'templates_dir': 'templates'
        }
        
        config['LOGGING'] = {
            'level': 'INFO',
            'file_enabled': 'true',
            'file_path': 'logs/vocalyx-dashboard.log',
            'colored': 'true'
        }
        
        with open(self.config_file, 'w') as f:
            config.write(f)
        
        logging.info(f"✅ Created default config file: {self.config_file}")
    
    def _load_settings(self):
        """Charge les paramètres dans des attributs"""
        
        # API
        self.api_url = self.config.get('API', 'url')
        self.api_timeout = self.config.getint('API', 'timeout', fallback=30)
        
        # SECURITY
        self.internal_api_key = self.config.get('SECURITY', 'internal_api_key')
        self.admin_project_name = self.config.get('SECURITY', 'admin_project_name')
        
        if self.internal_api_key == 'CHANGE_ME_SECRET_INTERNAL_KEY_12345':
            logging.warning("⚠️ SECURITY: Internal API key is using default value. Please change it!")
        
        # PATHS
        self.templates_dir = self.config.get('PATHS', 'templates_dir')
        
        # LOGGING
        self.log_level = self.config.get('LOGGING', 'level', fallback='INFO')
        self.log_file_enabled = self.config.getboolean('LOGGING', 'file_enabled', fallback=True)
        self.log_file_path = self.config.get('LOGGING', 'file_path', fallback='logs/vocalyx-dashboard.log')
        self.log_colored = self.config.getboolean('LOGGING', 'colored', fallback=True)
    
    def reload(self):
        """Recharge la configuration depuis le fichier"""
        self.config.read(self.config_file)
        self._load_settings()
        logging.info("🔄 Configuration reloaded")