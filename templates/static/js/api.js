// templates/static/js/api.js
// Client JavaScript pour communiquer avec le dashboard (qui proxie vers l'API)

/**
 * Client API pour le Dashboard Vocalyx
 * Tous les appels passent par le backend du dashboard
 */
class VocalyxDashboardAPI {
    constructor() {
        this.baseURL = window.location.origin;
        // this.wsURL = this.baseURL.replace(/^http/, 'ws'); // Plus utilisé
        this.websocket = null;
        this.pendingMessages = [];
        console.log("🔧 API Client initialized, baseURL:", this.baseURL);
    }
    
    /**
     * Gère les erreurs HTTP
     */
    async _handleResponse(response) {
        console.log("📡 Response received:", response.status, response.url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Response error:", errorText);
            let errorMessage = errorText;
            
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.detail || errorJson.message || errorText;
            } catch (e) {
                // Pas JSON, garder le texte brut
            }
            
            throw new Error(errorMessage);
        }
        
        // Gérer les réponses non-JSON (comme pour get-token)
        try {
            const data = await response.json();
            console.log("✅ Response data:", data);
            return data;
        } catch (e) {
            console.log("✅ Response data (non-JSON):", e);
            return null; // ou response.text() si tu attends du texte
        }
    }
    
    // ========================================================================
    // WEBSOCKET
    // ========================================================================

    sendWebSocketMessage(message) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not ready, message en file:", message?.type);
            this.pendingMessages.push(message);
            return;
        }
        this._internalSend(message);
    }
    
    _internalSend(message) {
        try {
            this.websocket.send(JSON.stringify(message));
        } catch (err) {
            console.error("Failed to send WebSocket message:", err);
        }
    }
    
    _flushPendingMessages() {
        if (!this.pendingMessages.length) return;
        console.log(`⬆️ Envoi de ${this.pendingMessages.length} message(s) en attente`);
        const queue = [...this.pendingMessages];
        this.pendingMessages = [];
        queue.forEach(msg => this._internalSend(msg));
    }
    
    async connectWebSocket(onMessageCallback, onErrorCallback, onOpenCallback) {
        // Assure une seule connexion
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            console.warn("WebSocket déjà connecté.");
            return;
        }

        let token;
        try {
            // 1. Appeler notre nouvel endpoint frontend (/auth/get-token)
            // Cet appel enverra le cookie HttpOnly
            const response = await fetch(`${this.baseURL}/auth/get-token`);
            if (!response.ok) {
                throw new Error("Autorisation refusée pour le WebSocket.");
            }
            const data = await response.json();
            token = data.access_token;
            
        } catch (err) {
            console.error("Erreur lors de la récupération du token WS:", err);
            if (onErrorCallback) onErrorCallback(err);
            // Rediriger vers le login si le token n'est pas obtenu
            window.location.href = "/login";
            return;
        }

        // 2. Construire l'URL de l'API (ws://<hostname>:<port>)
        // Le hostname vient toujours du navigateur, seul le port est configurable via config.ini
        const wsPort = (window.VOCALYX_CONFIG && window.VOCALYX_CONFIG.WS_PORT) || 8000;
        const apiWsUrl = `ws://${window.location.hostname}:${wsPort}`; 
        
        // 3. Construire l'URL finale avec le token en query param
        const finalWsUrl = `${apiWsUrl}/api/ws/updates?token=${token}`;
        
        console.log(`🔌 Connexion WebSocket à: ${apiWsUrl}/api/ws/updates`);
        
        this.websocket = new WebSocket(finalWsUrl);

        this.websocket.onopen = (event) => {
            console.log("✅ WebSocket connecté !");
            this._flushPendingMessages();
            if (onOpenCallback) {
                try {
                    onOpenCallback();
                } catch (err) {
                    console.error("Erreur onOpenCallback:", err);
                }
            }
        };

        this.websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log("📬 Message WebSocket reçu:", message);
                onMessageCallback(message);
            } catch (e) {
                console.error("Erreur parsing JSON WebSocket:", e);
            }
        };

        this.websocket.onerror = (event) => {
            console.error("❌ Erreur WebSocket:", event);
            if (onErrorCallback) onErrorCallback(event);
        };

        this.websocket.onclose = (event) => {
            console.warn("ℹ️ WebSocket déconnecté. Tentative de reconnexion dans 5s...");
            this.websocket = null;
            setTimeout(() => {
                this.connectWebSocket(onMessageCallback, onErrorCallback);
            }, 5000);
        };
    }
    // --- FIN MODIFICATION ---
    
    
    // ========================================================================
    // PROJETS
    // ========================================================================
    
    async listUserProjects() {
        const response = await fetch(`${this.baseURL}/api/user/projects`, {
            method: 'GET',
            credentials: 'include'
        });
        return this._handleResponse(response);
    }
    
    async listProjects(adminKey) {
        const params = new URLSearchParams({ admin_key: adminKey });
        
        const response = await fetch(`${this.baseURL}/api/projects?${params}`, {
            method: 'GET'
        });
        return this._handleResponse(response);
    }
    
    async createProject(projectName, adminKey) {
        const formData = new FormData();
        formData.append('project_name', projectName);
        formData.append('admin_key', adminKey);
        
        const response = await fetch(`${this.baseURL}/api/projects`, {
            method: 'POST',
            body: formData
        });
        return this._handleResponse(response);
    }
    
    async getProjectDetails(projectName, adminKey) {
        const params = new URLSearchParams({ admin_key: adminKey });
        
        const response = await fetch(`${this.baseURL}/api/projects/${projectName}?${params}`, {
            method: 'GET'
        });
        return this._handleResponse(response);
    }
    
    // ========================================================================
    // TRANSCRIPTIONS
    // ========================================================================
    
    async uploadAudio(file, projectName, apiKey, useVad = true, useDiarization = false, whisperModel = "large-v3", enrichment = false, llmModel = null, initialPrompt = null) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_name', projectName);
        formData.append('api_key', apiKey);
        formData.append('use_vad', useVad);
        formData.append('diarization', useDiarization);
        formData.append('whisper_model', whisperModel);
        formData.append('enrichment', enrichment || false);
        
        if (enrichment && llmModel) {
            formData.append('llm_model', llmModel);
        }
        
        // Ajouter initial_prompt seulement s'il n'est pas vide
        if (initialPrompt && initialPrompt.trim().length > 0) {
            formData.append('initial_prompt', initialPrompt.trim());
        }
        
        const response = await fetch(`${this.baseURL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        return this._handleResponse(response);
    }
    
    async getTranscriptions(page = 1, limit = 25, filters = {}) {
        console.log("📞 Calling getTranscriptions:", { page, limit, filters });
        
        const params = new URLSearchParams({
            page: page,
            limit: limit
        });
        
        if (filters.status) params.append('status', filters.status);
        if (filters.project) params.append('project', filters.project);
        if (filters.search) params.append('search', filters.search);
        
        const url = `${this.baseURL}/api/transcriptions/recent?${params}`;
        console.log("🌐 Fetching URL:", url);
        
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        return this._handleResponse(response);
    }
    
    async getTranscription(transcriptionId) {
        const response = await fetch(`${this.baseURL}/api/transcriptions/${transcriptionId}`, {
            credentials: 'include'
        });
        return this._handleResponse(response);
    }

    async deleteTranscription(transcriptionId) {
        const response = await fetch(`${this.baseURL}/api/transcriptions/${transcriptionId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        return this._handleResponse(response);
    }
    
    async countTranscriptions(filters = {}) {
        console.log("📞 Calling countTranscriptions:", filters);
        
        const params = new URLSearchParams();
        
        if (filters.status) params.append('status', filters.status);
        if (filters.project) params.append('project', filters.project);
        if (filters.search) params.append('search', filters.search);
        
        const url = `${this.baseURL}/api/transcriptions/count?${params}`;
        console.log("🌐 Fetching URL:", url);
        
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        return this._handleResponse(response);
    }
    
    // ========================================================================
    // WORKERS
    // ========================================================================
    
    async getWorkersStatus() {
        const response = await fetch(`${this.baseURL}/api/workers/status`, {
            credentials: 'include'
        });
        return this._handleResponse(response);
    }

    // ========================================================================
    // GESTION DES UTILISATEURS (NOUVEAU)
    // ========================================================================
    
    async listUsers() {
        const response = await fetch(`${this.baseURL}/api/admin/users`, {
            method: 'GET',
            credentials: 'include' // Ajout pour les appels /admin
        });
        return this._handleResponse(response);
    }
    
    async createUser(username, password, isAdmin) {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('is_admin', isAdmin);
        
        const response = await fetch(`${this.baseURL}/api/admin/users`, {
            method: 'POST',
            body: formData,
            credentials: 'include' // Ajout pour les appels /admin
        });
        return this._handleResponse(response);
    }
    
    async assignProjectToUser(userId, projectId) {
        const response = await fetch(`${this.baseURL}/api/admin/users/assign-project`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId, project_id: projectId }),
            credentials: 'include' // Ajout pour les appels /admin
        });
        return this._handleResponse(response);
    }
    
    async removeProjectFromUser(userId, projectId) {
        const response = await fetch(`${this.baseURL}/api/admin/users/remove-project`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId, project_id: projectId }),
            credentials: 'include' // Ajout pour les appels /admin
        });
        return this._handleResponse(response);
    }
    
    async deleteUser(userId) {
        const response = await fetch(`${this.baseURL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include' // Ajout pour les appels /admin
        });
        return this._handleResponse(response);
    }

    // ========================================================================
    // MÉTRIQUES (NOUVEAU)
    // ========================================================================
    
    async getTranscriptionMetrics(startDate = null, endDate = null, project = null) {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (project) params.append('project', project);
        
        const response = await fetch(`${this.baseURL}/api/transcriptions/metrics?${params}`, {
            method: 'GET',
            credentials: 'include'
        });
        return this._handleResponse(response);
    }
    
    async getTTLHealth(transcriptionId) {
        const response = await fetch(`${this.baseURL}/api/transcriptions/${transcriptionId}/ttl-health`, {
            method: 'GET',
            credentials: 'include'
        });
        return this._handleResponse(response);
    }
}

// Exporter l'instance globale
const api = new VocalyxDashboardAPI();
console.log("✅ Global API instance created");