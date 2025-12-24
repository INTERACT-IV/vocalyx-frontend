"""
vocalyx-frontend/auth_deps.py
Dépendances d'authentification pour FastAPI (pour éviter l'import circulaire)
"""
from fastapi import Request, HTTPException, status

# Nom du cookie (partagé avec app.py)
AUTH_COOKIE_NAME = "vocalyx_auth_token"

async def get_current_token(request: Request) -> str:
    """
    Dépendance FastAPI : Vérifie le cookie d'authentification.
    Si absent, redirige vers /login.
    """
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        # Utiliser un code 307 (Redirection Temporaire)
        raise HTTPException(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": "/login"}
        )
    return token