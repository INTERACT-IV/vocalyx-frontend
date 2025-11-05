// templates/static/js/events.js
// Gestion des événements utilisateur (adapté pour l'architecture API)

// --- Gestion Modale Upload ---
const uploadModal = document.getElementById("upload-modal");
const uploadModalClose = document.getElementById("upload-modal-close");

document.getElementById("open-upload-modal-btn").addEventListener("click", () => {
    uploadModal.style.display = "block";
    document.getElementById("upload-project-select").dispatchEvent(new Event('change'));
});

uploadModalClose.onclick = () => uploadModal.style.display = "none";

// Auto-remplir la clé API si on choisit le projet par défaut
document.getElementById("upload-project-select").addEventListener("change", (e) => {
    const apiKeyInput = document.getElementById("upload-api-key-input");
    const defaultProjectName = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_NAME;
    const defaultProjectKey = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY;
    
    if (e.target.value === defaultProjectName && defaultProjectKey) {
        apiKeyInput.value = defaultProjectKey;
        apiKeyInput.disabled = true;
    } else {
        apiKeyInput.value = "";
        apiKeyInput.disabled = false;
        apiKeyInput.placeholder = "Collez la clé API (vk_...) du projet";
    }
});

// Logique d'upload (bouton "Soumettre" de la modale)
document.getElementById("upload-submit-btn").addEventListener("click", async () => {
    const fileInput = document.getElementById("upload-file-input");
    const file = fileInput.files[0];
    
    if (!file) {
        showToast("Veuillez sélectionner un fichier.", "warning");
        return;
    }

    const projectName = document.getElementById("upload-project-select").value;
    const apiKey = document.getElementById("upload-api-key-input").value;
    const useVad = document.getElementById("upload-use-vad").checked;

    if (!projectName || !apiKey) {
        showToast("Projet ou Clé API manquant.", "warning");
        return;
    }

    const loadingOverlay = document.getElementById("loading-overlay");
    loadingOverlay.style.display = "flex";
    
    try {
        const result = await api.uploadAudio(file, projectName, apiKey, useVad);
        
        showToast(`✅ Upload (Projet: ${projectName}) réussi !`, "success");
        
        await refreshTranscriptions(1, currentLimit);
        uploadModal.style.display = "none";
        
    } catch (err) {
        showToast(`❌ Erreur: ${err.message}`, "error");
    } finally {
        loadingOverlay.style.display = "none";
        fileInput.value = "";
    }
});

// --- Gestion Modale Projets ---
const projectsModal = document.getElementById("projects-modal");
const projectsModalClose = document.getElementById("projects-modal-close");

document.getElementById("manage-projects-btn").addEventListener("click", () => {
    let adminKey = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY;

    // Si la clé n'est pas déjà chargée dans la session
    if (!adminKey) {
        // Demander la clé à l'utilisateur
        adminKey = prompt("Veuillez entrer la Clé API Admin (affichée dans les logs de 'make install'):");

        if (!adminKey || !adminKey.startsWith("vk_")) {
            showToast("Clé Admin invalide ou annulée.", "warning");
            return;
        }

        // Stocker la clé dans la variable globale pour cette session
        window.VOCALYX_CONFIG.DEFAULT_PROJECT_KEY = adminKey;
        showToast("Clé Admin chargée pour la session.", "success");
    }

    // Maintenant, la clé existe, on peut ouvrir la modale
    projectsModal.style.display = "block";
    loadProjectsTable();
});

projectsModalClose.onclick = () => projectsModal.style.display = "none";

async function loadProjectsTable() {
    const tableBody = document.getElementById("projects-table-body");
    const adminKey = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY;
    
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Chargement...</td></tr>';
    
    try {
        const projects = await api.listProjects(adminKey);
        
        tableBody.innerHTML = "";
        
        if (projects.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Aucun projet créé.</td></tr>';
            return;
        }

        projects.forEach(p => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>
                    <input type="password" value="NON_VISIBLE" 
                           title="Cliquez pour récupérer la clé" 
                           data-project="${p.name}" 
                           class="api-key-reveal" 
                           readonly>
                </td>
                <td>${formatHumanDate(p.created_at)}</td>
            `;
            tableBody.appendChild(row);
        });

        attachApiKeyRevealEvents();

    } catch (err) {
        tableBody.innerHTML = `
            <tr><td colspan="3" style="color:red; text-align: center;">
                Erreur: ${err.message}
            </td></tr>
        `;
    }
}

function attachApiKeyRevealEvents() {
    const adminKey = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY;
    
    document.querySelectorAll(".api-key-reveal").forEach(input => {
        input.addEventListener("click", async (e) => {
            const targetInput = e.target;
            const projectName = targetInput.dataset.project;
            
            if (targetInput.value !== "NON_VISIBLE") {
                targetInput.type = (targetInput.type === 'password' ? 'text' : 'password');
                return;
            }

            targetInput.value = "Chargement...";
            
            try {
                const projectDetails = await api.getProjectDetails(projectName, adminKey);
                targetInput.value = projectDetails.api_key;
                targetInput.type = "text";
            } catch(err) {
                targetInput.value = "Erreur";
                showToast(`Erreur: ${err.message}`, "error");
            }
        });
    });
}

document.getElementById("create-project-btn").addEventListener("click", async () => {
    const input = document.getElementById("new-project-name-input");
    const projectName = input.value;
    const adminKey = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY;
    
    if (!projectName) {
        showToast("Le nom du projet est requis", "warning");
        return;
    }
    
    try {
        const newProject = await api.createProject(projectName, adminKey);
        showToast(`Projet '${newProject.name}' créé !`, "success");
        input.value = "";
        await loadProjectsTable();
        await populateProjectFilters();
        
    } catch (err) {
        showToast(`Erreur: ${err.message}`, "error");
    }
});

// --- Filtres du Header ---

document.getElementById("status-filter").addEventListener("change", () => {
    refreshTranscriptions(1, currentLimit);
});

document.getElementById("project-filter").addEventListener("change", () => {
    refreshTranscriptions(1, currentLimit);
});

document.getElementById("search-input").addEventListener("input", () => {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        refreshTranscriptions(1, currentLimit);
    }, 300);
});

// --- Bouton Export ---
document.getElementById("export-btn").addEventListener("click", async () => {
    showToast("La fonction 'Exporter' n'est pas encore implémentée.", "info");
});