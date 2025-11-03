// events.js
// Gestion des événements utilisateur

// --- Gestion Modale Upload ---
const uploadModal = document.getElementById("upload-modal");
const uploadModalClose = document.getElementById("upload-modal-close");

// Ligne 4 : Le bouton qui OUVRE la modale
document.getElementById("open-upload-modal-btn").addEventListener("click", () => {
    uploadModal.style.display = "block";
    // S'assurer que le sélecteur est à jour
    document.getElementById("upload-project-select").dispatchEvent(new Event('change'));
});
uploadModalClose.onclick = () => uploadModal.style.display = "none";

// Auto-remplir la clé API si on choisit le projet 'default_internal'
document.getElementById("upload-project-select").addEventListener("change", (e) => {
    const apiKeyInput = document.getElementById("upload-api-key-input");
    if (e.target.value === window.VOCALYX_CONFIG.DEFAULT_PROJECT_NAME) {
        apiKeyInput.value = window.VOCALYX_CONFIG.DEFAULT_PROJECT_KEY;
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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("use_vad", useVad ? "true" : "false");

    const loadingOverlay = document.getElementById("loading-overlay");
    loadingOverlay.style.display = "flex";
    
    try {
        const resp = await fetch(`/api/transcribe/${encodeURIComponent(projectName)}`, {
            method: "POST",
            body: formData,
            headers: {
                'X-API-Key': apiKey
            }
        });
        
        if (!resp.ok) {
            let errorMsg = await resp.text();
            try {
                const errorJson = JSON.parse(errorMsg);
                if (errorJson.detail) {
                    if (typeof errorJson.detail === 'string') {
                        errorMsg = errorJson.detail;
                    } else if (Array.isArray(errorJson.detail) && errorJson.detail[0].msg) {
                        errorMsg = errorJson.detail[0].msg;
                    } else {
                        errorMsg = JSON.stringify(errorJson.detail);
                    }
                }
            } catch(e) {}
            throw new Error(errorMsg);
        }

        const data = await resp.json();
        showToast(`✅ Upload (Projet: ${projectName}) réussi !`, "success");
        
        await refreshCards(1, currentLimit);
        uploadModal.style.display = "none"; // Fermer la modale
        
    } catch (err) {
        showToast(`❌ Erreur: ${err.message}`, "error");
    } finally {
        loadingOverlay.style.display = "none";
        fileInput.value = ""; // Réinitialiser le champ fichier
    }
});


// --- Gestion Modale Projets ---
const projectsModal = document.getElementById("projects-modal");
const projectsModalClose = document.getElementById("projects-modal-close");
const adminKey = window.VOCALYX_CONFIG.DEFAULT_PROJECT_KEY;

document.getElementById("manage-projects-btn").addEventListener("click", () => {
    if (!adminKey || adminKey === "erreur_cle") {
        showToast("Erreur: Clé Admin non chargée", "error");
        return;
    }
    projectsModal.style.display = "block";
    loadProjectsTable();
});
projectsModalClose.onclick = () => projectsModal.style.display = "none";

async function loadProjectsTable() {
    const tableBody = document.getElementById("projects-table-body");
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Chargement...</td></tr>';
    
    try {
        const resp = await fetch("/api/projects", {
            headers: { 'X-API-Key': adminKey }
        });
        
        if (!resp.ok) {
             let errorMsg = await resp.text();
             try { errorMsg = JSON.parse(errorMsg).detail; } catch(e) {}
             throw new Error(errorMsg);
        }
        
        const projects = await resp.json();
        
        tableBody.innerHTML = ""; // Vider
        if (projects.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Aucun projet créé.</td></tr>';
            return;
        }

        projects.forEach(p => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td><input type="password" value="NON_VISIBLE" title="Cliquez pour récupérer la clé" data-project="${p.name}" class="api-key-reveal" readonly></td>
                <td>${formatHumanDate(p.created_at)}</td>
            `;
            tableBody.appendChild(row);
        });

        // Ajouter l'événement pour révéler la clé
        attachApiKeyRevealEvents();

    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="3" style="color:red; text-align: center;">Erreur: ${err.message}</td></tr>`;
    }
}

function attachApiKeyRevealEvents() {
    document.querySelectorAll(".api-key-reveal").forEach(input => {
        input.addEventListener("click", async (e) => {
            const targetInput = e.target;
            const projectName = targetInput.dataset.project;
            if (targetInput.value !== "NON_VISIBLE") {
                targetInput.type = (targetInput.type === 'password' ? 'text' : 'password');
                return; // Ne pas re-fetcher
            }

            targetInput.value = "Chargement...";
            try {
                const resp = await fetch(`/api/projects/${projectName}`, {
                    headers: { 'X-API-Key': adminKey }
                });
                if (!resp.ok) throw new Error(await resp.text());
                const projectDetails = await resp.json();
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
    if (!projectName) {
        showToast("Le nom du projet est requis", "warning");
        return;
    }
    
    try {
        const resp = await fetch(`/api/projects?project_name=${encodeURIComponent(projectName)}`, {
            method: 'POST',
            headers: { 'X-API-Key': adminKey }
        });
        
        if (!resp.ok) {
             let errorMsg = await resp.text();
             try { errorMsg = JSON.parse(errorMsg).detail; } catch(e) {}
             throw new Error(errorMsg);
        }
        
        const newProject = await resp.json();
        showToast(`Projet '${newProject.name}' créé !`, "success");
        input.value = "";
        await loadProjectsTable(); // Recharger la table
        await populateProjectFilters(); // Recharger les filtres globaux
        
    } catch (err) {
        showToast(`Erreur: ${err.message}`, "error");
    }
});


// --- Filtres du Header (existants) ---

document.getElementById("status-filter").addEventListener("change", () => {
    refreshCards(1, currentLimit);
});

document.getElementById("project-filter").addEventListener("change", () => {
    refreshCards(1, currentLimit);
});

document.getElementById("search-input").addEventListener("input", () => {
    // Ajout d'un debounce pour éviter trop d'appels
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        refreshCards(1, currentLimit);
    }, 300);
});

// --- Bouton Export (non fonctionnel) ---
document.getElementById("export-btn").addEventListener("click", async () => {
    showToast("La fonction 'Exporter' n'est pas encore implémentée.", "info");
});