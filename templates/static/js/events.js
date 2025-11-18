// templates/static/js/events.js
// Gestion des événements utilisateur (adapté pour l'architecture API)

// --- Gestion Modale Upload ---
const uploadModal = document.getElementById("upload-modal");
const uploadModalClose = document.getElementById("upload-modal-close");

const openUploadBtn = document.getElementById("open-upload-modal-btn");
if (openUploadBtn) {
    openUploadBtn.addEventListener("click", () => {
        if (uploadModal) uploadModal.style.display = "block";
        const projectSelect = document.getElementById("upload-project-select");
        if (projectSelect) {
            projectSelect.dispatchEvent(new Event('change'));
        }
    });
}

if (uploadModalClose) {
    uploadModalClose.onclick = () => {
        if (uploadModal) uploadModal.style.display = "none";
    };
}

// Fonction pour mettre à jour le stepper visuel
function updateUploadStepper(step) {
    document.querySelectorAll('.upload-step-item').forEach((item, index) => {
        const stepNum = index + 1;
        item.classList.remove('active', 'completed');
        if (stepNum < step) {
            item.classList.add('completed');
        } else if (stepNum === step) {
            item.classList.add('active');
        }
    });
}

// Auto-remplir la clé API si on choisit le projet par défaut
const projectSelect = document.getElementById("upload-project-select");
if (projectSelect) {
    projectSelect.addEventListener("change", (e) => {
        const apiKeyInput = document.getElementById("upload-api-key-input");
        if (!apiKeyInput) return;
        
        const projectName = e.target.value;
        const projectDetails = window.VOCALYX_PROJECT_MAP?.[projectName];
        
        updateUploadStepper(projectName ? 2 : 1);
        
        if (projectDetails?.api_key) {
            apiKeyInput.value = projectDetails.api_key;
            apiKeyInput.disabled = true;
            apiKeyInput.placeholder = "";
        } else if (projectName === window.VOCALYX_CONFIG?.DEFAULT_PROJECT_NAME && window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY) {
            apiKeyInput.value = window.VOCALYX_CONFIG.DEFAULT_PROJECT_KEY;
            apiKeyInput.disabled = true;
            apiKeyInput.placeholder = "";
        } else {
            apiKeyInput.value = "";
            apiKeyInput.disabled = false;
            apiKeyInput.placeholder = "Collez la clé API (vk_...) du projet";
        }
    });
}

// Mettre à jour le stepper lors de la saisie de la clé API
const apiKeyInput = document.getElementById("upload-api-key-input");
if (apiKeyInput) {
    apiKeyInput.addEventListener("input", (e) => {
        if (e.target.value.trim()) {
            updateUploadStepper(3);
        } else {
            updateUploadStepper(2);
        }
    });
}

// Mettre à jour le stepper lors de la sélection du fichier
const fileInput = document.getElementById("upload-file-input");
if (fileInput) {
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            updateUploadStepper(4);
        } else {
            const apiKey = document.getElementById("upload-api-key-input")?.value.trim();
            updateUploadStepper(apiKey ? 3 : 2);
        }
    });
}

// Réinitialiser le stepper à l'ouverture de la modale
if (openUploadBtn) {
    openUploadBtn.addEventListener("click", () => {
        updateUploadStepper(1);
    });
}

// Logique d'upload (bouton "Soumettre" de la modale)
const uploadSubmitBtn = document.getElementById("upload-submit-btn");
if (uploadSubmitBtn) {
    uploadSubmitBtn.addEventListener("click", async () => {
        const uploadFileInput = document.getElementById("upload-file-input");
        const file = uploadFileInput?.files[0];
        
        if (!file) {
            showToast("Veuillez sélectionner un fichier.", "warning");
            return;
        }

        const projectName = document.getElementById("upload-project-select")?.value;
        const apiKey = document.getElementById("upload-api-key-input")?.value;
        const useVad = document.getElementById("upload-use-vad")?.checked;

        if (!projectName || !apiKey) {
            showToast("Projet ou Clé API manquant.", "warning");
            return;
        }

        const loadingOverlay = document.getElementById("loading-overlay");
        if (loadingOverlay) loadingOverlay.style.display = "flex";
        
        try {
            // L'upload reste en HTTP, c'est normal
            const result = await api.uploadAudio(file, projectName, apiKey, useVad);
            
            showToast(`✅ Upload (Projet: ${projectName}) réussi !`, "success");
            
            // Le WS s'occupera du rafraîchissement
            if (uploadModal) uploadModal.style.display = "none";
            
        } catch (err) {
            showToast(`❌ Erreur: ${err.message}`, "error");
        } finally {
            if (loadingOverlay) loadingOverlay.style.display = "none";
            if (uploadFileInput) uploadFileInput.value = "";
        }
    });
}

// --- Gestion Modale Projets (SUPPRIMÉ) ---
// La logique de gestion des projets est maintenant dans /admin et admin.js


// --- Filtres du Header (MODIFIÉS) ---

// Fonction pour compter les filtres actifs
function updateFiltersActiveBadge() {
    const statusEl = document.getElementById("status-filter");
    const searchEl = document.getElementById("search-input");
    const projectEl = document.getElementById("project-filter");
    const badge = document.getElementById("filters-active-badge");
    const countEl = document.getElementById("filters-count");
    const resetBtn = document.getElementById("reset-filters-btn");
    
    if (!badge || !countEl || !resetBtn) return;
    
    let count = 0;
    if (statusEl?.value) count++;
    if (searchEl?.value?.trim()) count++;
    if (projectEl?.value) count++;
    
    if (count > 0) {
        countEl.textContent = count;
        badge.style.display = "inline-flex";
        resetBtn.style.display = "inline-block";
    } else {
        badge.style.display = "none";
        resetBtn.style.display = "none";
    }
}

// Fonction pour réinitialiser les filtres
function resetFilters() {
    const statusEl = document.getElementById("status-filter");
    const searchEl = document.getElementById("search-input");
    const projectEl = document.getElementById("project-filter");
    
    if (statusEl) statusEl.value = "";
    if (searchEl) searchEl.value = "";
    if (projectEl) projectEl.value = "";
    
    updateFiltersActiveBadge();
    requestUpdateFromFilters();
}

// Fonction centralisée pour envoyer l'état des filtres au WebSocket
function requestUpdateFromFilters() {
    const statusEl = document.getElementById("status-filter");
    const searchEl = document.getElementById("search-input");
    const projectEl = document.getElementById("project-filter");

    if (!statusEl && !searchEl && !projectEl) {
        return; // Page sans filtres
    }
    
    const status = statusEl?.value || null;
    const search = searchEl?.value || null;
    const project = projectEl?.value || null;
    
    // On demande la page 1 lors d'un changement de filtre
    currentPage = 1;
    
    updateFiltersActiveBadge();

    api.sendWebSocketMessage({
        type: "get_dashboard_state",
        payload: {
            page: currentPage,
            limit: currentLimit,
            status: status,
            project: project,
            search: search
        }
    });
}

const statusFilterEl = document.getElementById("status-filter");
if (statusFilterEl) {
    statusFilterEl.addEventListener("change", () => {
        requestUpdateFromFilters();
    });
}

const projectFilterEl = document.getElementById("project-filter");
if (projectFilterEl) {
    projectFilterEl.addEventListener("change", () => {
        requestUpdateFromFilters();
    });
}

const searchInputEl = document.getElementById("search-input");
if (searchInputEl) {
    // Debounce amélioré (500ms) ou sur Enter
    searchInputEl.addEventListener("input", () => {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            requestUpdateFromFilters();
        }, 500);
    });
    
    searchInputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(window.searchTimeout);
            requestUpdateFromFilters();
        }
    });
}

// Bouton réinitialiser les filtres
const resetFiltersBtn = document.getElementById("reset-filters-btn");
if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", resetFilters);
}

// --- Bouton Export ---
const exportBtn = document.getElementById("export-btn");
if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
        showToast("La fonction 'Exporter' n'est pas encore implémentée.", "info");
    });
}
