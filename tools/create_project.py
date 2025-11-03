"""
Script utilitaire pour créer un nouveau projet et sa clé d'API.
"""

import sys
import logging
from database import engine, Base, Project, SessionLocal

# Configurer un logger basique
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_project(project_name: str):
    """Crée un projet dans la base de données"""
    
    # 1. Créer les tables si elles n'existent pas
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # 2. Vérifier si le projet existe déjà
        existing = db.query(Project).filter(Project.name == project_name).first()
        if existing:
            logger.warning(f"⚠️  Le projet '{project_name}' existe déjà.")
            print("\n--- Informations sur le projet existant ---")
            print(f"  Nom: {existing.name}")
            print(f"  Clé API (X-API-Key): {existing.api_key}")
            print("-------------------------------------------\n")
            return

        # 3. Créer le nouveau projet
        new_project = Project(name=project_name)
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        
        logger.info(f"✅ Projet '{project_name}' créé avec succès !")
        print("\n--- 🚀 Nouveau projet créé ---")
        print(f"  Nom: {new_project.name}")
        print(f"  Clé API (X-API-Key): {new_project.api_key}")
        print("----------------------------------\n")
        print("Gardez cette clé précieusement !")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erreur lors de la création du projet: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3.10 create_project.py <nom_du_projet>")
        sys.exit(1)
        
    project_name = sys.argv[1]
    create_project(project_name)