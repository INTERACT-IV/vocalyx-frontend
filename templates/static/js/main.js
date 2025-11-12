// templates/static/js/main.js
// Point d'entrée principal de l'application (adapté pour l'architecture API)

let currentPage = 1;
let currentLimit = 25;

console.log("🚀 main.js loaded");

/**
 * Récupère tous les projets et remplit les listes <select>
 */
async function populateProjectFilters() {
    const filterSelect = document.getElementById("project-filter");
    const uploadSelect = document.getElementById("upload-project-select");
    
    const adminKey = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY;
    if (!adminKey) {
        console.error("Clé admin non disponible");
        showToast("Erreur: Configuration admin manquante", "error");
        return;
    }

    try {
        const projects = await api.listProjects(adminKey);
        
        // Vider les listes (sauf la première option)
        filterSelect.innerHTML = '<option value="">Tous les projets</option>';
        uploadSelect.innerHTML = '';

        projects.forEach(project => {
            // Ajouter au filtre du header
            const filterOption = document.createElement("option");
            filterOption.value = project.name;
            filterOption.textContent = project.name;
            filterSelect.appendChild(filterOption);
            
            // Ajouter au sélecteur de la modale d'upload
            const uploadOption = document.createElement("option");
            uploadOption.value = project.name;
            uploadOption.textContent = project.name;
            
            // Auto-sélectionner le projet admin
            if (project.name === window.VOCALYX_CONFIG?.DEFAULT_PROJECT_NAME) {
                uploadOption.selected = true;
            }
            uploadSelect.appendChild(uploadOption);
        });

        // Déclencher l'événement change pour pré-remplir la clé API
        uploadSelect.dispatchEvent(new Event('change'));

    } catch (err) {
        console.error("Erreur lors du chargement des projets:", err);
        showToast(`Erreur chargement projets: ${err.message}`, "error");
    }
}

/**
 * Formate une durée en secondes en H:M:S
 */
function formatDuration(seconds) {
    if (seconds == null || isNaN(seconds)) return '-';
    seconds = Math.round(seconds);
    if (seconds < 60) return `${seconds}s`;
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    
    let str = "";
    if (h > 0) str += `${h}h `;
    if (m > 0) str += `${m}m `;
    if (s > 0 || (h === 0 && m === 0)) str += `${s}s`;
    return str.trim();
}

/**
 * Met à jour le statut des workers (depuis l'API)
 */
async function updateWorkerStatus() {
    const headerContainer = document.getElementById("worker-status-container");
    if (!headerContainer) return;

    try {
        const stats = await api.getWorkersStatus();
        
        const workerCount = stats.worker_count || 0;
        const activeTasks = stats.active_tasks || 0;
        
        let statusClass = "status-ok";
        if (workerCount === 0) {
            statusClass = "status-error";
        } else if (activeTasks > 0) {
            statusClass = "status-busy";
        }

        headerContainer.innerHTML = `
            <span class="worker-status-light ${statusClass}"></span>
            <span style="font-weight:600;">Workers: ${activeTasks} actifs (${workerCount} total)</span>
            ${stats.error ? `<span style="color:#dc3545;font-weight:600;">(Erreur: ${stats.error})</span>` : ''}
        `;

    } catch (err) {
        console.error("Failed to fetch worker status:", err);
        headerContainer.innerHTML = `
            <span class="worker-status-light status-error"></span>
            <span style="font-weight:600;">Workers: Indisponible</span>
        `;
    }
}

/**
 * Rafraîchit la grille des transcriptions
 */
async function refreshTranscriptions(page = 1, limit = 25) {
    const status = document.getElementById("status-filter")?.value || null;
    const search = document.getElementById("search-input")?.value || null;
    const project = document.getElementById("project-filter")?.value || null;
    
    currentPage = page;
    currentLimit = limit;
    
    // ✅ AJOUT : Afficher un indicateur de chargement
    const container = document.getElementById("grid-table-body");
    if (container) {
        container.innerHTML = `
            <tr><td colspan="9" style="text-align:center;padding:2rem;">
                <div class="spinner"></div>
                <p>Chargement des transcriptions...</p>
            </td></tr>
        `;
    }
    
    try {
        const filters = {};
        if (status) filters.status = status;
        if (search) filters.search = search;
        if (project) filters.project = project;
        
        // Appels en parallèle
        const [transcriptions, countData] = await Promise.all([
            api.getTranscriptions(page, limit, filters),
            api.countTranscriptions(filters)
        ]);
        
        const totalPages = Math.ceil(countData.total_filtered / limit);
        
        renderTranscriptions(transcriptions);
        updatePagination(page, totalPages);
        
    } catch (err) {
        console.error("❌ Error:", err);
        if (container) {
            container.innerHTML = `
                <tr><td colspan="9" style="color:red;text-align:center;padding:2rem;">
                    Erreur de chargement: ${err.message}
                </td></tr>
            `;
        }
    }
}

/**
 * Affiche les transcriptions dans la grille
 */
function renderTranscriptions(transcriptions) {
    console.log("🎨 renderTranscriptions called with", transcriptions.length, "items");
    
    const container = document.getElementById("grid-table-body");
    if (!container) {
        console.error("❌ Container 'grid-table-body' not found!");
        return;
    }
    
    console.log("✅ Container found:", container);
    
    container.innerHTML = "";
    
    if (transcriptions.length === 0) {
        console.log("ℹ️ No transcriptions to display");
        container.innerHTML = `
            <tr><td colspan="9" style="text-align:center;padding:2rem;">
                Aucune transcription trouvée.
            </td></tr>
        `;
        return;
    }
    
    console.log("🔨 Building table rows...");
    const fragment = document.createDocumentFragment();
    
    transcriptions.forEach((entry, index) => {
        console.log(`  Row ${index}:`, entry.id, entry.status);
        const row = document.createElement("tr");
        row.className = `status-${entry.status || 'unknown'}`;
        row.dataset.id = entry.id;
        
        row.innerHTML = `
            <td class="col-status">
                <span class="status-indicator"></span>
                <span class="status-text">${escapeHtml(entry.status || '-')}</span>
            </td>
            <td class="col-project">${escapeHtml(entry.project_name || 'N/A')}</td>
            <td class="col-id">${escapeHtml(entry.id)}</td>
            <td class="col-instance">${escapeHtml(entry.worker_id || 'N/A')}</td>
            <td class="col-lang">${escapeHtml(entry.language || '...')}</td>
            <td class="col-duree">${entry.duration ? entry.duration.toFixed(1) + 's' : '-'}</td>
            <td class="col-process">${entry.processing_time ? entry.processing_time.toFixed(1) + 's' : '-'}</td>
            <td class="col-date">${formatHumanDate(entry.created_at)}</td>
            <td class="col-actions">
                <button class="btn-delete btn btn-danger">Supprimer</button>
            </td>
        `;
        
        fragment.appendChild(row);
    });
    
    console.log("📦 Appending fragment to container...");
    container.appendChild(fragment);
    console.log("✅ Rows appended");
    
    attachRowClickEvents();
    attachDeleteEvents();
    console.log("✅ renderTranscriptions complete");
}

/**
 * Met à jour la pagination
 */
function updatePagination(currentPage, totalPages) {
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    
    pagination.innerHTML = "";
    
    if (totalPages <= 1) return;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage > 1) {
        pagination.appendChild(createPageButton(1, "«"));
        pagination.appendChild(createPageButton(currentPage - 1, "‹"));
    }

    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(createPageButton(i, i, currentPage === i));
    }

    if (currentPage < totalPages) {
        pagination.appendChild(createPageButton(currentPage + 1, "›"));
        pagination.appendChild(createPageButton(totalPages, "»"));
    }
}

function createPageButton(page, text, isActive = false) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.dataset.page = page;
    if (isActive) btn.classList.add("active");
    btn.addEventListener("click", () => {
        refreshTranscriptions(page, currentLimit);
    });
    return btn;
}

/**
 * Attache les événements de clic sur les lignes
 */
function attachRowClickEvents() {
    document.querySelectorAll("#grid-table-body tr").forEach(row => {
        row.addEventListener("click", async (e) => {
            if (e.target.closest(".btn-delete")) return;
            
            const id = row.dataset.id;
            openModal();
            modalBody.innerHTML = `
                <div style="text-align:center;padding:2rem;">
                    <div class="spinner"></div>
                    <p>Chargement des détails...</p>
                </div>
            `;
            
            try {
                const data = await api.getTranscription(id);
                renderTranscriptionModal(data);
            } catch (err) {
                modalBody.innerHTML = `
                    <div style="text-align:center;padding:2rem;color:red;">
                        <p>❌ Erreur: ${err.message}</p>
                        <button onclick="closeModal()" class="btn btn-danger">Fermer</button>
                    </div>
                `;
            }
        });
    });
}

/**
 * Attache les événements de suppression
 */
function attachDeleteEvents() {
    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const row = e.target.closest("tr");
            const id = row.dataset.id;
            
            if (!confirm(`Supprimer la transcription ${id.substring(0, 8)}... ?`)) return;
            
            try {
                await api.deleteTranscription(id);
                showToast(`Transcription supprimée !`, "success");
                
                row.style.transition = "opacity 0.3s, transform 0.3s";
                row.style.opacity = "0";
                row.style.transform = "scale(0.95)";
                
                setTimeout(() => {
                    refreshTranscriptions(currentPage, currentLimit);
                }, 300);
            } catch (err) {
                showToast(`Erreur: ${err.message}`, "error");
            }
        });
    });
}

// ============================================================================
// INITIALISATION - ✅ CORRECTION PRINCIPALE
// ============================================================================

console.log("🚀 main.js loaded");

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    console.log("✅ DOMContentLoaded fired");
    
    // Démarrer la mise à jour de l'heure
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime();
    
    // Démarrer le monitoring des workers
    setInterval(updateWorkerStatus, 5000);
    updateWorkerStatus();

    // ✅ OPTIMISATION : Charger projets et transcriptions en parallèle
    console.log("📋 Loading projects and transcriptions in parallel...");
    await Promise.all([
        populateProjectFilters(),
        refreshTranscriptions(1, 25)
    ]);
    
    // Démarrer le polling
    console.log("🔄 Starting polling...");
    startPolling();
    
    console.log("✅ Initialization complete");
});