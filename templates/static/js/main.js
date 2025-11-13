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
 * ---------------------------------------------------------------------------
 * ✅ MODIFICATION : Lecture de health.total_audio_processed_s
 * ---------------------------------------------------------------------------
 * Remplit la grille de monitoring des workers
 */
function renderWorkerMonitoringGrid(stats) {
    const gridBody = document.getElementById("worker-monitoring-grid");
    if (!gridBody) return;

    const workerStats = stats.stats || {};
    const activeWorkers = stats.workers || {};
    const registeredWorkers = stats.registered_tasks || {};

    gridBody.innerHTML = "";

    const allWorkerNames = new Set(Object.keys(workerStats));
    Object.keys(registeredWorkers).forEach(name => allWorkerNames.add(name));

    if (allWorkerNames.size === 0) {
        gridBody.innerHTML = `<tr><td colspan="11" style="text-align:center;">Aucun worker Celery n'est actuellement connecté au broker.</td></tr>`;
        return;
    }

    allWorkerNames.forEach(workerName => {
        const row = document.createElement("tr");
        const workerData = workerStats[workerName];
        const activeTasks = activeWorkers[workerName] || [];
        
        const health = workerData?.health;
        
        // --- AJOUT LECTURE DB_STATS ---
        // 'db_stats' est maintenant ajouté par l'API
        const db_stats = workerData?.db_stats;
        // --- FIN AJOUT ---
        
        let status = "offline";
        let statusClass = "status-offline";
        let statusIndicator = "status-error";
        
        if (workerData) {
            if (activeTasks.length > 0) {
                status = "busy";
                statusClass = "status-processing";
                statusIndicator = "status-busy";
            } else {
                status = "idle";
                statusClass = "status-done";
                statusIndicator = "status-ok";
            }
        }

        // Tâches (corrigé)
        let tasksDone = 0;
        const totalData = workerData?.total;
        if (typeof totalData === 'number') {
            tasksDone = totalData;
        } else if (typeof totalData === 'object' && totalData !== null) {
            tasksDone = Object.values(totalData).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
        }
        
        // --- Exploitation des données 'health' ---
        const cpuPercent = health?.cpu_percent;
        const ramPercent = health?.memory_percent;
        const ramRss = health?.memory_rss_bytes;
        const uptime = health?.uptime_seconds;
        
        // --- MODIFICATION : Lire depuis db_stats ---
        const totalAudio = db_stats?.total_audio_processed_s;
        
        const activeTaskCount = activeTasks.length;
        const chargeBar = "N/A"; 

        row.className = statusClass;
        row.innerHTML = `
            <td class="col-instance">${workerName.split('@')[0]}</td>
            <td class="col-status"><span class="worker-status-light ${statusIndicator}"></span> ${status}</td>
            <td class="col-charge-num">${activeTaskCount}</td>
            <td class="col-charge-bar">${chargeBar}</td>
            <td class="col-cpu-num">${cpuPercent != null ? cpuPercent.toFixed(1) + '%' : 'N/A'}</td>
            <td class="col-cpu-bar">${createProgressBar(cpuPercent)}</td>
            <td class="col-ram-num">${bytesToHuman(ramRss)}</td>
            <td class="col-ram-bar">${createProgressBar(ramPercent)}</td>
            <td class="col-uptime">${formatUptime(uptime)}</td>
            <td class="col-jobs">${tasksDone}</td>
            <td class="col-audio">${formatDuration(totalAudio)}</td> 
        `;
        
        gridBody.appendChild(row);
    });
}


/**
 * Met à jour le header avec les stats workers
 */
function updateWorkerHeader(stats) {
    const headerContainer = document.getElementById("worker-status-container");
    if (!headerContainer) return;

    const workerCount = stats.worker_count || 0;
    const activeTasks = stats.active_tasks || 0;
    
    let statusClass = "status-ok";
    if (workerCount === 0) statusClass = "status-error";
    else if (activeTasks > 0) statusClass = "status-busy";

    headerContainer.innerHTML = `
        <span class="worker-status-light ${statusClass}"></span>
        <span style="font-weight:600;">Workers: ${activeTasks} actifs (${workerCount} total)</span>
        ${stats.error ? `<span style="color:#dc3545;font-weight:600;">(Erreur: ${stats.error})</span>` : ''}
    `;
}

/**
 * Rafraîchit la grille des transcriptions
 */
async function refreshTranscriptions(page = 1, limit = 25) {
    console.log("🔄 refreshTranscriptions called:", { page, limit });
    
    const status = document.getElementById("status-filter")?.value || null;
    const search = document.getElementById("search-input")?.value || null;
    const project = document.getElementById("project-filter")?.value || null;
    
    console.log("📋 Filters:", { status, search, project });
    
    currentPage = page;
    currentLimit = limit;
    
    try {
        const filters = {};
        if (status) filters.status = status;
        if (search) filters.search = search;
        if (project) filters.project = project;
        
        console.log("⏳ Fetching transcriptions...");
        const transcriptions = await api.getTranscriptions(page, limit, filters);
        console.log("✅ Transcriptions received:", transcriptions.length, "items");
        
        console.log("⏳ Fetching count...");
        const countData = await api.countTranscriptions(filters);
        console.log("✅ Count received:", countData);
        
        const totalPages = Math.ceil(countData.total_filtered / limit);
        
        console.log("🎨 Rendering transcriptions...");
        renderTranscriptions(transcriptions);
        console.log("🎨 Updating pagination...");
        updatePagination(page, totalPages);
        console.log("✅ refreshTranscriptions complete");
        
    } catch (err) {
        console.error("❌ Error in refreshTranscriptions:", err);
        const container = document.getElementById("grid-table-body");
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
// GESTIONNAIRE WEBSOCKET
// ============================================================================

/**
 * Gère les messages entrants du WebSocket
 * @param {object} msg - L'objet JSON reçu du serveur
 */
function handleWebSocketMessage(msg) {
    // --- NOUVEAU : GESTION DES DONNÉES INITIALES ---
    if (msg.type === "initial_worker_stats") {
        console.log("📊 Données initiales (workers) reçues via WS");
        renderWorkerMonitoringGrid(msg.data); // Remplir la grille
        updateWorkerHeader(msg.data); // Mettre à jour le header

    } else if (msg.type === "initial_transcription_count") {
        console.log("📊 Données initiales (count) reçues via WS");
        const countData = msg.data;
        const totalPages = Math.ceil(countData.total_filtered / currentLimit);
        updatePagination(currentPage, totalPages); // Mettre à jour la pagination

    } else if (msg.type === "initial_transcriptions") {
        console.log("📊 Données initiales (transcriptions) reçues via WS");
        renderTranscriptions(msg.data); // Remplir la grille

    // --- GESTION DES MISES À JOUR (POLLING) ---
    } else if (msg.type === "worker_stats") {
        console.log("📊 Données worker_stats (update) reçues via WS");
        const stats = msg.data;
        updateWorkerHeader(stats); // Mettre à jour le header
        renderWorkerMonitoringGrid(stats); // Mettre à jour la grille
        
    } else if (msg.type === "transcription_update") {
        console.log("🔄 Données transcription_update reçues via WS, rafraîchissement...");
        
        // Le plus simple et le plus robuste est de tout rafraîchir
        refreshTranscriptions(currentPage, currentLimit);
    }
}

// ============================================================================
// INITIALISATION
// ============================================================================

console.log("🚀 main.js loaded");

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    console.log("✅ DOMContentLoaded fired");
    
    // Démarrer la mise à jour de l'heure
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime();
    
    // Lancer le chargement des filtres (synchrone, non dépendant du WS)
    console.log("🚀 Lancement du chargement des filtres projets...");
    await populateProjectFilters();
    console.log("✅ Filtres projets chargés.");
    
    // Démarrer la connexion WebSocket
    // Le serveur enverra les données initiales dès la connexion.
    console.log("🔄 Connexion au WebSocket pour les données initiales et les mises à jour...");
    api.connectWebSocket(
        handleWebSocketMessage, // Callback pour les messages
        (error) => { // Callback pour les erreurs
            console.error("Échec de la connexion WebSocket initiale:", error);
            showToast("Connexion temps réel échouée", "error");
        }
    );
    
    console.log("✅ Initialization complete. En attente des données WebSocket.");
});