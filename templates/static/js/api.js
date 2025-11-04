// templates/static/js/api.js
// Client JavaScript pour communiquer avec le dashboard (qui proxie vers l'API)

/**
 * Client API pour le Dashboard Vocalyx
 * Tous les appels passent par le backend du dashboard
 */
class VocalyxDashboardAPI {
    constructor() {
        this.baseURL = window.location.origin; // Dashboard URL
    }
    
    /**
     * Gère les erreurs HTTP
     */
    async _handleResponse(response) {
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = errorText;
            
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.detail || errorJson.message || errorText;
            } catch (e) {
                // Pas JSON, garder le texte brut
            }
            
            throw new Error(errorMessage);
        }
        return response.json();
    }
    
    // ========================================================================
    // PROJETS
    // ========================================================================
    
    async listProjects(adminKey) {
        const formData = new FormData();
        formData.append('admin_key', adminKey);
        
        const response = await fetch(`${this.baseURL}/api/projects`, {
            method: 'GET',
            body: formData
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
        const formData = new FormData();
        formData.append('admin_key', adminKey);
        
        const response = await fetch(`${this.baseURL}/api/projects/${projectName}`, {
            method: 'GET',
            body: formData
        });
        return this._handleResponse(response);
    }
    
    // ========================================================================
    // TRANSCRIPTIONS
    // ========================================================================
    
    async uploadAudio(file, projectName, apiKey, useVad = true) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_name', projectName);
        formData.append('api_key', apiKey);
        formData.append('use_vad', useVad);
        
        const response = await fetch(`${this.baseURL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        return this._handleResponse(response);
    }
    
    async getTranscriptions(page = 1, limit = 25, filters = {}) {
        const params = new URLSearchParams({
            page: page,
            limit: limit
        });
        
        if (filters.status) params.append('status', filters.status);
        if (filters.project) params.append('project', filters.project);
        if (filters.search) params.append('search', filters.search);
        
        const response = await fetch(`${this.baseURL}/api/transcriptions/recent?${params}`);
        return this._handleResponse(response);
    }
    
    async getTranscription(transcriptionId) {
        const response = await fetch(`${this.baseURL}/api/transcriptions/${transcriptionId}`);
        return this._handleResponse(response);
    }
    
    async deleteTranscription(transcriptionId) {
        const response = await fetch(`${this.baseURL}/api/transcriptions/${transcriptionId}`, {
            method: 'DELETE'
        });
        return this._handleResponse(response);
    }
    
    async countTranscriptions(filters = {}) {
        const params = new URLSearchParams();
        
        if (filters.status) params.append('status', filters.status);
        if (filters.project) params.append('project', filters.project);
        if (filters.search) params.append('search', filters.search);
        
        const response = await fetch(`${this.baseURL}/api/transcriptions/count?${params}`);
        return this._handleResponse(response);
    }
    
    // ========================================================================
    // WORKERS
    // ========================================================================
    
    async getWorkersStatus() {
        const response = await fetch(`${this.baseURL}/api/workers/status`);
        return this._handleResponse(response);
    }
}

// Exporter l'instance globale
const api = new VocalyxDashboardAPI();