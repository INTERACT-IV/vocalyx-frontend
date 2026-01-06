// templates/static/js/main.js
// Point d'entrée principal de l'application (adapté pour l'architecture API)

let currentPage = 1;
let currentLimit = 25;
let currentView = document.body?.dataset?.page || window.VOCALYX_PAGE || "transcriptions";
let navButtons = [];
let quickViewButtons = [];
let viewWrappers = [];
let allProjects = [];
window.VOCALYX_PROJECT_MAP = window.VOCALYX_PROJECT_MAP || {};

console.log("🚀 main.js loaded");

// Stockage des valeurs pour les sparklines
let sparklineData = {
    projects: [],
    users: [],
    workers: [],
    transcriptions: []
};

function updateStatValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value === undefined || value === null || value === "") {
        el.textContent = "—";
        return;
    }
    if (typeof value === "number") {
        el.textContent = value.toLocaleString("fr-FR");
        
        // Mettre à jour les données sparkline
        const statType = id.replace("stat-", "");
        if (sparklineData[statType]) {
            sparklineData[statType].push(value);
            // Garder seulement les 20 dernières valeurs
            if (sparklineData[statType].length > 20) {
                sparklineData[statType].shift();
            }
            drawSparkline(statType);
        }
    } else {
        el.textContent = value;
    }
}

// Fonction pour dessiner une sparkline
function drawSparkline(type) {
    const canvas = document.getElementById(`sparkline-${type}`);
    if (!canvas || !sparklineData[type] || sparklineData[type].length < 2) return;
    
    const ctx = canvas.getContext('2d');
    const data = sparklineData[type];
    const width = canvas.width;
    const height = canvas.height;
    
    // Effacer le canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculer les valeurs min/max
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    // Dessiner la ligne
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
}

function formatApiKeyPreview(key) {
    if (!key) return "—";
    const trimmed = String(key).trim();
    if (trimmed.length <= 12) return trimmed;
    return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

/**
 * Récupère tous les projets et remplit les listes <select>
 */
async function populateProjectFilters() {
    const filterSelect = document.getElementById("project-filter");
    const uploadSelect = document.getElementById("upload-project-select");
    const projectsGrid = document.getElementById("projects-grid");
    
    if (projectsGrid) {
        projectsGrid.innerHTML = `<div class="section-empty">Chargement des projets...</div>`;
    }
    
    try {
        let projectsFetcher = api?.listUserProjects;
        let projects;

        if (typeof projectsFetcher === "function") {
            projects = await projectsFetcher.call(api);
        } else {
            console.warn("api.listUserProjects indisponible, fallback fetch direct utilisé.");
            const response = await fetch(`${window.location.origin}/api/user/projects`, {
                method: "GET",
                credentials: "include"
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            projects = await response.json();
        }

        allProjects = Array.isArray(projects) ? projects : [];

        window.VOCALYX_PROJECT_MAP = {};
        allProjects.forEach(project => {
            if (project?.name) {
                window.VOCALYX_PROJECT_MAP[project.name] = project;
            }
        });
        
        if ((!window.VOCALYX_CONFIG?.DEFAULT_PROJECT_NAME || !window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY) && allProjects.length) {
            window.VOCALYX_CONFIG = window.VOCALYX_CONFIG || {};
            window.VOCALYX_CONFIG.DEFAULT_PROJECT_NAME = window.VOCALYX_CONFIG.DEFAULT_PROJECT_NAME || allProjects[0].name;
            window.VOCALYX_CONFIG.DEFAULT_PROJECT_KEY = window.VOCALYX_CONFIG.DEFAULT_PROJECT_KEY || allProjects[0].api_key;
        }
        
        if (filterSelect) {
            filterSelect.innerHTML = allProjects.length
                ? '<option value="">Tous les projets</option>'
                : '<option value="">Aucun projet disponible</option>';
        }
        if (uploadSelect) {
            uploadSelect.innerHTML = '';
            uploadSelect.disabled = allProjects.length === 0;
        }

        if (!allProjects.length) {
            showToast("Aucun projet n'est associé à votre compte.", "warning");
            if (uploadSelect) {
                const emptyOption = document.createElement("option");
                emptyOption.value = "";
                emptyOption.textContent = "Aucun projet disponible";
                uploadSelect.appendChild(emptyOption);
            }
            updateStatValue("stat-projects", 0);
            renderProjectsBoard([]);
            renderProjectsTable([]);
            return;
        }

        allProjects.forEach(project => {
            if (filterSelect) {
                const filterOption = document.createElement("option");
                filterOption.value = project.name;
                filterOption.textContent = project.name;
                filterSelect.appendChild(filterOption);
            }
            
            if (uploadSelect) {
                const uploadOption = document.createElement("option");
                uploadOption.value = project.name;
                uploadOption.textContent = project.name;
                if (project.name === window.VOCALYX_CONFIG?.DEFAULT_PROJECT_NAME) {
                    uploadOption.selected = true;
                }
                uploadSelect.appendChild(uploadOption);
            }
        });

        if (uploadSelect) {
            uploadSelect.dispatchEvent(new Event('change'));
        }

        updateStatValue("stat-projects", allProjects.length);
        renderProjectsBoard(allProjects);
        renderProjectsTable(allProjects);

    } catch (err) {
        console.error("Erreur lors du chargement des projets:", err);
        showToast(`Erreur chargement projets: ${err.message}`, "error");
        updateStatValue("stat-projects", 0);
        renderProjectsBoard([]);
        renderProjectsTable([]);
    }
}

function renderProjectsBoard(projects) {
    const grid = document.getElementById("projects-grid");
    if (!grid) return;
    
    if (!Array.isArray(projects) || projects.length === 0) {
        grid.innerHTML = `<div class="section-empty">Aucun projet actif pour le moment.</div>`;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    const defaultProjectName = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_NAME;
    
    projects.forEach(project => {
        const card = document.createElement("article");
        card.className = "project-card";
        
        const createdAt = project.created_at ? formatHumanDate(project.created_at) : "—";
        const isAdmin = window.VOCALYX_CONFIG?.USER_IS_ADMIN && project.name === defaultProjectName;
        
        card.innerHTML = `
            <div class="project-card-header">
                <h3>${escapeHtml(project.name || "Sans nom")}</h3>
                ${isAdmin ? '<span class="badge badge-admin">Admin</span>' : ''}
            </div>
            <p class="project-meta">Créé le ${escapeHtml(createdAt)}</p>
            <div class="project-key">${escapeHtml(formatApiKeyPreview(project.api_key))}</div>
            <div class="project-card-actions">
                <button class="btn btn-primary btn-copy-key" data-project="${escapeHtml(project.name)}" title="Copier la clé API">
                    📋 Copier clé
                </button>
                <button class="btn btn-success btn-view-details" data-project="${escapeHtml(project.name)}" title="Voir les détails">
                    👁️ Détails
                </button>
            </div>
        `;
        
        fragment.appendChild(card);
    });
    
    grid.innerHTML = "";
    grid.appendChild(fragment);
    
    // Attacher les événements des boutons
    attachProjectCardEvents();
}

function attachProjectCardEvents() {
    // Copier la clé API
    document.querySelectorAll(".btn-copy-key").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const projectName = btn.dataset.project;
            if (!projectName) return;
            
            const project = window.VOCALYX_PROJECT_MAP?.[projectName];
            if (!project?.api_key) {
                showToast("Clé API non disponible", "error");
                return;
            }
            
            try {
                await navigator.clipboard.writeText(project.api_key);
                showToast(`Clé API de "${projectName}" copiée !`, "success");
            } catch (err) {
                showToast("Erreur lors de la copie", "error");
            }
        });
    });
    
    // Voir les détails
    document.querySelectorAll(".btn-view-details").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const projectName = btn.dataset.project;
            if (!projectName) return;
            
            const project = window.VOCALYX_PROJECT_MAP?.[projectName];
            if (!project) {
                showToast("Projet non trouvé", "error");
                return;
            }
            
            openModal();
            modalBody.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2>Détails du Projet</h2>
                    <button class="btn btn-primary" onclick="closeModal()">← Retour</button>
                </div>
                <div style="background:#f9f9f9;padding:1.5rem;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                    <h3>${escapeHtml(project.name || 'Sans nom')}</h3>
                    <p><strong>Clé API:</strong> <code style="background:#fff;padding:0.3rem 0.6rem;border-radius:4px;display:inline-block;margin-left:0.5rem;">${escapeHtml(project.api_key || 'N/A')}</code></p>
                    <p><strong>Créé le:</strong> ${escapeHtml(formatHumanDate(project.created_at))}</p>
                    ${project.description ? `<p><strong>Description:</strong> ${escapeHtml(project.description)}</p>` : ''}
                </div>
            `;
        });
    });
}

function attachApiKeyRevealEvents() {
    document.querySelectorAll(".api-key-reveal").forEach(input => {
        input.addEventListener("click", (e) => {
            const target = e.currentTarget;
            const projectName = target.dataset.project;
            if (!projectName) return;

            const projectDetails = window.VOCALYX_PROJECT_MAP?.[projectName];
            if (!projectDetails?.api_key) {
                target.value = "Clé indisponible";
                target.type = "text";
                return;
            }

            if (target.dataset.loaded === "true") {
                target.type = target.type === "password" ? "text" : "password";
                return;
            }

            target.value = projectDetails.api_key;
            target.type = "text";
            target.dataset.loaded = "true";
        });
    });
}

function renderProjectsTable(projects) {
    const tableBody = document.getElementById("projects-table-body");
    if (!tableBody) return;

    if (!Array.isArray(projects)) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:red;">Erreur de chargement</td></tr>`;
        return;
    }

    if (projects.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Aucun projet créé.</td></tr>`;
        return;
    }

    tableBody.innerHTML = "";
    projects.forEach(p => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>
                <input type="password"
                       value="••••••••"
                       title="Cliquez pour récupérer la clé"
                       data-project="${escapeHtml(p.name)}"
                       class="api-key-reveal"
                       readonly>
            </td>
            <td>${escapeHtml(formatHumanDate(p.created_at))}</td>
        `;
        tableBody.appendChild(row);
    });

    attachApiKeyRevealEvents();
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
        gridBody.innerHTML = `<tr><td colspan="12" style="text-align:center;">Aucun worker Celery n'est actuellement connecté au broker.</td></tr>`;
        return;
    }

    allWorkerNames.forEach(workerName => {
        const row = document.createElement("tr");
        const workerData = workerStats[workerName];
        const activeTasks = activeWorkers[workerName] || [];
        
        const health = workerData?.health;
        const db_stats = workerData?.db_stats;
        
        // Déterminer le type de worker (transcription ou enrichissement)
        const simpleName = workerName.split('@')[0];
        let workerType = "transcription";
        let workerTypeLabel = "📝 Transcription";
        if (simpleName.startsWith('enrichment-worker-') || simpleName.includes('enrichment')) {
            workerType = "enrichment";
            workerTypeLabel = "✨ Enrichissement";
        }
        
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

        // Tâches
        let tasksDone = 0;
        const totalData = workerData?.total;
        if (typeof totalData === 'number') {
            tasksDone = totalData;
        } else if (typeof totalData === 'object' && totalData !== null) {
            tasksDone = Object.values(totalData).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
        }
        
        // Exploitation des données 'health'
        const cpuPercent = health?.cpu_percent;
        const ramPercent = health?.memory_percent;
        const ramRss = health?.memory_rss_bytes;
        const uptime = health?.uptime_seconds;
        
        // "TPS audio traité"
        const totalAudio = db_stats?.total_audio_processed_s;
        
        console.log(`Worker ${workerName}:`, {
            health_exists: !!health,
            db_stats_exists: !!db_stats,
            totalAudio: totalAudio,
            db_stats_content: db_stats
        });
        
        const activeTaskCount = activeTasks.length;
        let chargeBar = "N/A";
        let maxConcurrency = 0;

        if (workerData && workerData.pool && workerData.pool.hasOwnProperty('max-concurrency')) {
            maxConcurrency = parseInt(workerData.pool['max-concurrency'], 10);
        }
        
        if (maxConcurrency > 0) {
            // Calculer le pourcentage
            const chargePercent = (activeTaskCount / maxConcurrency) * 100;
            chargeBar = createProgressBar(chargePercent); // Utiliser la fonction utilitaire
        } else if (workerData) {
            // Si le worker est en ligne mais n'a pas de max-concurrency, afficher 0%
            chargeBar = createProgressBar(0);
        }

        // Déterminer les classes de coloration selon CPU/RAM
        row.className = statusClass;
        row.dataset.workerType = workerType;
        row.innerHTML = `
            <td class="col-instance">${simpleName}</td>
            <td class="col-type">
                <span class="worker-type-badge worker-type-${workerType}">${workerTypeLabel}</span>
            </td>
            <td class="col-status"><span class="worker-status-light ${statusIndicator}"></span> ${status}</td>
            <td class="col-charge-num">${activeTaskCount}</td>
            <td class="col-charge-bar">${chargeBar}</td>
            <td class="col-cpu-num"><span class="worker-cpu-icon"></span>${cpuPercent != null ? cpuPercent.toFixed(1) + '%' : 'N/A'}</td>
            <td class="col-cpu-bar">${createProgressBar(cpuPercent)}</td>
            <td class="col-ram-num"><span class="worker-ram-icon"></span>${bytesToHuman(ramRss)}</td>
            <td class="col-ram-bar">${createProgressBar(ramPercent)}</td>
            <td class="col-uptime">${formatUptime(uptime)}</td>
            <td class="col-jobs">${tasksDone}</td>
            <td class="col-audio">${formatDuration(totalAudio)}</td>
        `;
        
        // Ajouter les attributs data pour le CSS
        if (cpuPercent != null) {
            if (cpuPercent > 80) row.setAttribute('data-cpu-critical', 'true');
            else if (cpuPercent > 70) row.setAttribute('data-cpu-high', 'true');
        }
        if (ramPercent != null) {
            if (ramPercent > 80) row.setAttribute('data-ram-critical', 'true');
            else if (ramPercent > 70) row.setAttribute('data-ram-high', 'true');
        }
        
        gridBody.appendChild(row);
    });
}


/**
 * Met à jour le header avec les stats workers
 */
function updateWorkerHeader(stats) {
    const headerContainer = document.getElementById("worker-status-container");
    if (!headerContainer) return;

    const transcriptionWorkerCount = stats.transcription_worker_count || 0;
    const enrichmentWorkerCount = stats.enrichment_worker_count || 0;
    const transcriptionActiveTasks = stats.transcription_active_tasks || 0;
    const enrichmentActiveTasks = stats.enrichment_active_tasks || 0;
    const totalWorkerCount = (transcriptionWorkerCount || 0) + (enrichmentWorkerCount || 0);
    const totalActiveTasks = (transcriptionActiveTasks || 0) + (enrichmentActiveTasks || 0);
    
    updateStatValue("stat-workers", totalWorkerCount);

    // Déterminer le statut pour chaque type de worker
    let transcriptionStatusClass = "status-ok";
    if (transcriptionWorkerCount === 0) transcriptionStatusClass = "status-error";
    else if (transcriptionActiveTasks > 0) transcriptionStatusClass = "status-busy";

    let enrichmentStatusClass = "status-ok";
    if (enrichmentWorkerCount === 0) enrichmentStatusClass = "status-error";
    else if (enrichmentActiveTasks > 0) enrichmentStatusClass = "status-busy";

    headerContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.3rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="worker-status-light ${transcriptionStatusClass}"></span>
                <span style="font-weight:600;">
                    Transcription: ${transcriptionActiveTasks} actifs (${transcriptionWorkerCount} workers)
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="worker-status-light ${enrichmentStatusClass}"></span>
                <span style="font-weight:600;">
                    Enrichissement: ${enrichmentActiveTasks} actifs (${enrichmentWorkerCount} workers)
                </span>
            </div>
        </div>
        ${stats.error ? `<span style="color:#dc3545;font-weight:600;margin-top:0.3rem;display:block;">(Erreur: ${stats.error})</span>` : ''}
    `;
}

/**
 * Met à jour une transcription spécifique dans l'UI sans rafraîchir toute la liste
 */
function updateTranscriptionInUI(transcription) {
    const container = document.getElementById("grid-table-body");
    if (!container) return;
    
    const row = container.querySelector(`tr[data-id="${transcription.id}"]`);
    if (row) {
        // La transcription est visible, mettre à jour la ligne
        row.className = `status-${transcription.status || 'unknown'}`;
        
        // Mettre à jour le statut
        const statusCell = row.querySelector('.col-status');
        if (statusCell) {
            statusCell.innerHTML = statusToBadge(transcription.status);
        }
        
        // Mettre à jour les autres champs si nécessaire
        const instanceCell = row.querySelector('.col-instance');
        if (instanceCell && transcription.worker_id) {
            instanceCell.textContent = transcription.worker_id;
        }
        
        const langCell = row.querySelector('.col-lang');
        if (langCell && transcription.language) {
            langCell.textContent = transcription.language;
        }
        
        const durationCell = row.querySelector('.col-duree');
        if (durationCell && transcription.duration !== undefined) {
            durationCell.textContent = transcription.duration ? transcription.duration.toFixed(1) + 's' : '-';
        }
        
        // ✅ NOUVEAU : Mettre à jour le temps d'attente
        const waitCell = row.querySelector('.col-wait');
        if (waitCell) {
            waitCell.textContent = transcription.queue_wait_time ? formatDuration(transcription.queue_wait_time) : '-';
        }
        
        const processCell = row.querySelector('.col-process');
        if (processCell) {
            const transcriptionTime = transcription.processing_time || 0;
            // Utiliser enrichment_data.timing.total_time si disponible, sinon enrichment_processing_time
            let enrichmentTime = 0;
            if (transcription.enrichment_data && transcription.enrichment_data.timing && transcription.enrichment_data.timing.total_time) {
                enrichmentTime = transcription.enrichment_data.timing.total_time;
            } else if (transcription.enrichment_processing_time) {
                enrichmentTime = transcription.enrichment_processing_time;
            }
            const totalProcessingTime = transcriptionTime + enrichmentTime;
            
            let processingTimeDisplay;
            if (transcription.enrichment_requested) {
              if (enrichmentTime > 0) {
                processingTimeDisplay = `${totalProcessingTime.toFixed(1)}s`;
              } else {
                processingTimeDisplay = transcriptionTime ? `${transcriptionTime.toFixed(1)}s` : '-';
              }
            } else {
              processingTimeDisplay = transcriptionTime ? `${transcriptionTime.toFixed(1)}s` : '-';
            }
            processCell.textContent = processingTimeDisplay;
        }
        
        // Mettre à jour les colonnes workers
        const transcribeWorkerCell = row.querySelector('.col-worker-transcribe');
        if (transcribeWorkerCell) {
            transcribeWorkerCell.textContent = transcription.worker_id || 'N/A';
        }
        const enrichmentWorkerCell = row.querySelector('.col-worker-enrichment');
        if (enrichmentWorkerCell) {
            enrichmentWorkerCell.textContent = transcription.enrichment_worker_id || '-';
        }
        
        console.log(`✅ Transcription ${transcription.id} mise à jour dans l'UI`);
    } else {
        // La transcription n'est pas visible (peut-être filtrée ou sur une autre page)
        // Vérifier si elle devrait être visible avec les filtres actuels
        const status = document.getElementById("status-filter")?.value || null;
        const project = document.getElementById("project-filter")?.value || null;
        const search = document.getElementById("search-input")?.value || null;
        
        // Si les filtres correspondent, rafraîchir la page actuelle
        const matchesFilters = (!status || transcription.status === status) &&
                              (!project || transcription.project_name === project) &&
                              (!search || transcription.id.includes(search) || 
                                      (transcription.text && transcription.text.includes(search)));
        
        if (matchesFilters) {
            // La transcription devrait être visible, rafraîchir la page
            console.log(`🔄 Transcription ${transcription.id} devrait être visible, rafraîchissement...`);
            requestDashboardUpdate(currentPage);
        } else {
            // La transcription est filtrée, juste mettre à jour les compteurs si nécessaire
            console.log(`ℹ️ Transcription ${transcription.id} filtrée, pas de mise à jour UI`);
        }
    }
}

/**
 * Rafraîchit la grille des transcriptions via WebSocket uniquement
 */
async function refreshTranscriptions(page = 1, limit = 25) {
    console.log("🔄 refreshTranscriptions called (via WebSocket):", { page, limit });
    
    currentPage = page;
    currentLimit = limit;
    
    try {
        // Vérifier que le WebSocket est connecté
        if (!api.websocket || api.websocket.readyState !== WebSocket.OPEN) {
            console.warn("⚠️ WebSocket non connecté, attente de la connexion...");
            // Attendre jusqu'à 5 secondes que le WebSocket se connecte
            let attempts = 0;
            while ((!api.websocket || api.websocket.readyState !== WebSocket.OPEN) && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!api.websocket || api.websocket.readyState !== WebSocket.OPEN) {
                throw new Error("WebSocket non connecté après 5 secondes d'attente");
            }
            console.log("✅ WebSocket connecté, continuation...");
        }
        
        // Utiliser le WebSocket pour récupérer les données
        console.log("⏳ Demande de données via WebSocket...");
        const state = await requestDashboardUpdate(page);
        console.log("✅ Données reçues via WebSocket");
        
        if (!state) {
            throw new Error("Aucune donnée reçue du serveur");
        }
        
        // Extraire les données
        const transcriptions = state.transcriptions || [];
        const countData = state.transcription_count || {};
        
        console.log("✅ Transcriptions received:", transcriptions.length, "items");
        console.log("✅ Count received:", countData);
        
        const totalPages = Math.ceil((countData.total_filtered || 0) / limit);
        
        // Préparer les filtres pour l'affichage
        const status = document.getElementById("status-filter")?.value || null;
        const search = document.getElementById("search-input")?.value || null;
        const project = document.getElementById("project-filter")?.value || null;
        const filters = { status, search, project };
        
        console.log("🎨 Rendering transcriptions...");
        renderTranscriptions(transcriptions, countData, filters);
        console.log("🎨 Updating pagination...");
        updatePagination(page, totalPages);
        console.log("✅ refreshTranscriptions complete");
        
    } catch (err) {
        console.error("❌ Error in refreshTranscriptions:", err);
        const container = document.getElementById("grid-table-body");
        if (container) {
            container.innerHTML = `
                <tr><td colspan="10" style="color:red;text-align:center;padding:2rem;">
                    Erreur de chargement: ${err.message}
                </td></tr>
            `;
        }
    }
}

function statusToBadge(status) {
  let label = '-', cls = 'badge-status';
  switch (status) {
    case 'pending': label='En attente'; cls+=' badge-pending'; break;
    case 'queued': label='En file'; cls+=' badge-queued'; break;  // ✅ NOUVEAU
    case 'processing': label='En cours'; cls+=' badge-processing'; break;
    case 'transcribed': label='Transcrit'; cls+=' badge-transcribed'; break;
    case 'done': label='Terminé'; cls+=' badge-done'; break;
    case 'error': label='Erreur'; cls+=' badge-error'; break;
    default: label = (status || '-');
  }
  return `<span class="${cls}">${label}</span>`;
}

function formatFiltersBanner(count, { project, status, search }) {
  let f = [];
  if (project) f.push(`Projet: <strong>${escapeHtml(project)}</strong>`);
  if (status) {
    let s = statusToBadge(status);
    f.push(`Statut: ${s}`);
  }
  if (search) f.push(`Recherche: <em>${escapeHtml(search)}</em>`);
  return `${count} éléments${f.length ? ' · ' + f.join(', ') : ''}`;
}

let lastUpdateTime;
let _latestFilters = {};
function setContextBanner(options={}) {
  const banner = document.getElementById('context-banner');
  if (!banner) return;
  const page = currentView || 'transcriptions';
  let title = '';
  switch (page) {
    case 'transcriptions': title = 'Transcriptions · Vue temps réel'; break;
    case 'projects': title = 'Projets · Gestion & API'; break;
    case 'users': title = 'Utilisateurs · Administration'; break;
    case 'workers': title = 'Workers · Statut Celery'; break;
    case 'statistics': title = 'Statistiques · Synthèse'; break;
    default: title = page;
  }
  let extra = (options.extraContext || '');
  if (page === 'transcriptions' && !extra) {
    // Récupérer les filtres actuels
    const status = document.getElementById("status-filter")?.value || null;
    const search = document.getElementById("search-input")?.value || null;
    const project = document.getElementById("project-filter")?.value || null;
    _latestFilters = { project, status, search };
    const count = document.getElementById("grid-table-body")?.querySelectorAll("tr").length || 0;
    extra = formatFiltersBanner(count, _latestFilters);
  }
  banner.innerHTML = `<span>${title}</span><span class="context-filters">${extra}</span>`;
  banner.style.display = '';
}

// Patch renderTranscriptions — badges statut et context-banner couplé au count/filters
function renderTranscriptions(transcriptions, countData, filters) {
  const container = document.getElementById("grid-table-body");
  if (!container) return;
  container.innerHTML = "";
  if (!Array.isArray(transcriptions)) {
    container.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:red;">Erreur: Les données reçues ne sont pas au bon format</td></tr>`;
    return;
  }
  const totalCount = countData?.total_filtered ?? countData?.total ?? transcriptions.length;
  if (transcriptions.length === 0) {
    container.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;">Aucune transcription trouvée.</td></tr>`;
    setContextBanner({ extraContext: formatFiltersBanner(0, filters||{}) });
    return;
  }
  const fragment = document.createDocumentFragment();
  transcriptions.forEach((entry) => {
    const row = document.createElement("tr");
    row.className = `status-${entry.status || 'unknown'}`;
    row.dataset.id = entry.id;
    // Calculer le temps de traitement total (transcription + enrichissement)
    // Toujours inclure le temps d'enrichissement s'il est disponible (même si pas encore terminé)
    const transcriptionTime = entry.processing_time || 0;
    // Utiliser enrichment_data.timing.total_time si disponible, sinon enrichment_processing_time
    let enrichmentTime = 0;
    if (entry.enrichment_data && entry.enrichment_data.timing && entry.enrichment_data.timing.total_time) {
        enrichmentTime = entry.enrichment_data.timing.total_time;
    } else if (entry.enrichment_processing_time) {
        enrichmentTime = entry.enrichment_processing_time;
    }
    const totalProcessingTime = transcriptionTime + enrichmentTime;
    
    // Si enrichissement demandé mais pas encore terminé, utiliser le temps de transcription seulement
    // Si enrichissement terminé, utiliser le temps total
    let processingTimeDisplay;
    if (entry.enrichment_requested) {
      if (enrichmentTime > 0) {
        // Enrichissement terminé : afficher le temps total
        processingTimeDisplay = `${totalProcessingTime.toFixed(1)}s`;
      } else {
        // Enrichissement en cours ou en attente : afficher seulement transcription pour l'instant
        processingTimeDisplay = entry.processing_time ? `${transcriptionTime.toFixed(1)}s` : '-';
      }
    } else {
      // Pas d'enrichissement demandé : afficher seulement le temps de transcription
      processingTimeDisplay = entry.processing_time ? `${transcriptionTime.toFixed(1)}s` : '-';
    }
    
    // ✅ NOUVEAU : Afficher le temps d'attente dans la file
    const queueWaitTimeDisplay = entry.queue_wait_time ? formatDuration(entry.queue_wait_time) : '-';
    
    row.innerHTML = `
      <td class="col-status">${statusToBadge(entry.status)}</td>
      <td class="col-project">${escapeHtml(entry.project_name || 'N/A')}</td>
      <td class="col-id">${escapeHtml(entry.id)}</td>
      <td class="col-worker-transcribe">${escapeHtml(entry.worker_id || 'N/A')}</td>
      <td class="col-worker-enrichment">${escapeHtml(entry.enrichment_worker_id || '-')}</td>
      <td class="col-lang">${escapeHtml(entry.language || '...')}</td>
      <td class="col-duree dur-group" title="Durée totale de l'audio en secondes">${entry.duration ? entry.duration.toFixed(1) + 's' : '-'}</td>
      <td class="col-wait dur-group" title="Temps d'attente dans la file Celery (secondes)">${queueWaitTimeDisplay}</td>
      <td class="col-process dur-group" title="Temps de traitement réel (sans attente) en secondes">${processingTimeDisplay}</td>
      <td class="col-date" title="${formatHumanDate(entry.created_at)}">${formatHumanDate(entry.created_at)}</td>
      <td class="col-actions"><button class="btn-delete btn btn-danger" title="Supprimer la transcription">Supprimer</button></td>`;
    fragment.appendChild(row);
  });
  container.appendChild(fragment);
  setContextBanner({ extraContext: formatFiltersBanner(totalCount, filters||{}) });
  attachRowClickEvents();
  attachDeleteEvents();
  
  // Rendre aussi en mode cards pour mobile
  renderTranscriptionsCards(transcriptions);
}

/**
 * Rend les transcriptions en mode cards pour mobile
 */
function renderTranscriptionsCards(transcriptions) {
  const cardsContainer = document.getElementById("transcriptions-cards");
  if (!cardsContainer) return;
  
  cardsContainer.innerHTML = "";
  
  if (!Array.isArray(transcriptions) || transcriptions.length === 0) {
    cardsContainer.innerHTML = `<div style="text-align:center;padding:2rem;color:#666;">Aucune transcription trouvée.</div>`;
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  transcriptions.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "transcription-card";
    card.dataset.id = entry.id;
    
    card.innerHTML = `
      <div class="transcription-card-header">
        <div class="transcription-card-title">${statusToBadge(entry.status)} ${escapeHtml(entry.project_name || 'N/A')}</div>
      </div>
      <div class="transcription-card-meta">
        <span><strong>ID:</strong> ${escapeHtml(entry.id.substring(0, 12))}...</span>
        <span><strong>Durée:</strong> ${entry.duration ? entry.duration.toFixed(1) + 's' : '-'}</span>
        <span><strong>Créé:</strong> ${formatHumanDate(entry.created_at)}</span>
      </div>
      <div class="transcription-card-actions">
        <button class="btn btn-primary btn-view-details-card" data-id="${escapeHtml(entry.id)}">Voir détails</button>
        <button class="btn btn-danger btn-delete-card" data-id="${escapeHtml(entry.id)}">Supprimer</button>
      </div>
    `;
    
    fragment.appendChild(card);
  });
  
  cardsContainer.appendChild(fragment);
  
  // Attacher les événements
  document.querySelectorAll(".btn-view-details-card").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      openModal();
      if (modalBody) {
        modalBody.innerHTML = `
          <div style="text-align:center;padding:2rem;">
            <div class="spinner"></div>
            <p>Chargement des détails...</p>
          </div>
        `;
      }
      try {
        const data = await api.getTranscription(id);
        renderTranscriptionModal(data);
      } catch (err) {
        if (modalBody) {
          modalBody.innerHTML = `
            <div style="text-align:center;padding:2rem;color:red;">
              <p>❌ Erreur: ${err.message}</p>
              <button onclick="closeModal()" class="btn btn-danger">Fermer</button>
            </div>
          `;
        }
      }
    });
  });
  
  document.querySelectorAll(".btn-delete-card").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm(`Supprimer la transcription ${id.substring(0, 8)}... ?`)) return;
      
      try {
        await api.deleteTranscription(id);
        showToast("Transcription supprimée", "success");
        const card = btn.closest(".transcription-card");
        if (card) {
          card.style.transition = "opacity 0.3s, transform 0.3s";
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";
          setTimeout(() => {
            requestDashboardUpdate(currentPage);
          }, 300);
        }
      } catch (err) {
        showToast(`Erreur lors de la suppression: ${err.message}`, "error");
      }
    });
  });
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
        requestDashboardUpdate(page);
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
                if (modalBody) {
                    modalBody.innerHTML = `
                        <div style="text-align:center;padding:2rem;color:red;">
                            <p>❌ Erreur: ${err.message}</p>
                            <button onclick="closeModal()" class="btn btn-danger">Fermer</button>
                        </div>
                    `;
                }
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

// Flag pour éviter les appels en double
let pendingDashboardUpdate = false;
// Promesses en attente pour les mises à jour
let pendingDashboardUpdatePromise = null;
let pendingDashboardUpdateResolve = null;

/**
 * Fonction centralisée pour demander une mise à jour au WS
 * Utilise les filtres et la page actuels.
 * Retourne une promesse qui se résout quand les données arrivent.
 */
function requestDashboardUpdate(page = null) {
    // Si une mise à jour est déjà en cours, retourner la même promesse
    if (pendingDashboardUpdate && pendingDashboardUpdatePromise) {
        console.log("⏭️ Mise à jour déjà en cours, réutilisation de la promesse");
        return pendingDashboardUpdatePromise;
    }
    
    if (page) {
        currentPage = page;
    }
    
    const status = document.getElementById("status-filter")?.value || null;
    const search = document.getElementById("search-input")?.value || null;
    const project = document.getElementById("project-filter")?.value || null;

    console.log(`WS -> C: Demande de mise à jour (Page: ${currentPage}, Filtres: ${status}, ${project}, ${search})`);
    
    pendingDashboardUpdate = true;
    
    // Créer une nouvelle promesse
    pendingDashboardUpdatePromise = new Promise((resolve, reject) => {
        pendingDashboardUpdateResolve = resolve;
        
        // Timeout après 10 secondes
        setTimeout(() => {
            if (pendingDashboardUpdate) {
                pendingDashboardUpdate = false;
                pendingDashboardUpdatePromise = null;
                pendingDashboardUpdateResolve = null;
                reject(new Error("Timeout: pas de réponse du serveur"));
            }
        }, 10000);
    });
    
    api.sendWebSocketMessage({
        type: "get_dashboard_state",
        payload: {
            page: currentPage,
            limit: currentLimit,
            status: status,
            project: project,
            search: search,
            view: currentView
        }
    });
    
    return pendingDashboardUpdatePromise;
}

/**
 * Gère les messages entrants du WebSocket
 * @param {object} msg - L'objet JSON reçu du serveur
 */
// Flag pour indiquer si les données initiales ont déjà été chargées via HTTP
let initialDataLoaded = false;

function handleWebSocketMessage(msg) {
    
    let state; // Variable pour stocker les données d'état

    if (msg.type === "initial_dashboard_state") {
        // Cas 1: L'état initial complet à la connexion
        console.log("WS <- S: 📊 Données initiales (état complet) reçues");
        initialDataLoaded = true;
        state = msg.data;
        
        // Résoudre la promesse en attente si elle existe (pour refreshTranscriptions)
        if (pendingDashboardUpdateResolve) {
            pendingDashboardUpdateResolve(state);
            pendingDashboardUpdate = false;
            pendingDashboardUpdatePromise = null;
            pendingDashboardUpdateResolve = null;
        }
    } else if (msg.type === "dashboard_state_update") {
        // Cas 2: Une mise à jour complète en réponse à notre demande
        console.log("WS <- S: 🔄 Mise à jour de l'état (filtré) reçue");
        state = msg.data;
        
        // Résoudre la promesse en attente si elle existe
        if (pendingDashboardUpdateResolve) {
            pendingDashboardUpdateResolve(state);
            pendingDashboardUpdate = false;
            pendingDashboardUpdatePromise = null;
            pendingDashboardUpdateResolve = null;
        }
    } else if (msg.type === "transcription_updated") {
        // Cas 3a: Une transcription spécifique a été mise à jour (données directes)
        console.log("WS <- S: ✅ Transcription mise à jour reçue directement");
        const updatedTranscription = msg.data?.transcription;
        if (updatedTranscription) {
            updateTranscriptionInUI(updatedTranscription);
        }
        return;
    } else if (msg.type === "transcription_update_trigger") {
        // Cas 3b: Un broadcast nous dit que "quelque chose" a changé (trigger général)
        console.log("WS <- S: 🔔 Trigger de mise à jour reçu. Demande des données...");
        // On demande une mise à jour avec nos filtres actuels
        requestDashboardUpdate(currentPage); 
        return; // Pas de données à afficher
    } else if (msg.type === "worker_stats") {
        // Cas 4: Juste les stats des workers (du poller interne de l'API)
        console.log("WS <- S: 📊 Données worker_stats (update) reçues");
        const stats = msg.data;
        updateWorkerHeader(stats);
        renderWorkerMonitoringGrid(stats);
        return;
    } else if (msg.type === "error") {
        console.error(`WS <- S: Erreur WebSocket: ${msg.message}`);
        showToast(`Erreur serveur: ${msg.message}`, "error");
        return;
    } else {
        return; // Message inconnu
    }

    // Si on a reçu un état complet (initial ou update)
    if (state) {
        // 1. Mettre à jour les workers (grille et header)
        if (state.worker_stats) {
            renderWorkerMonitoringGrid(state.worker_stats);
            updateWorkerHeader(state.worker_stats);
        }
        // 2. Mettre à jour la pagination (basé sur le compte)
        if (state.transcription_count) {
            const countData = state.transcription_count;
            const totalPages = Math.ceil(countData.total_filtered / currentLimit);
            updatePagination(currentPage, totalPages);
            updateStatValue("stat-transcriptions", countData.total_filtered ?? countData.total ?? 0);
        }
        // 3. Mettre à jour la grille des transcriptions
        if (state.transcriptions) {
            // Mettre à jour les filtres pour le context banner
            const status = document.getElementById("status-filter")?.value || null;
            const search = document.getElementById("search-input")?.value || null;
            const project = document.getElementById("project-filter")?.value || null;
            _latestFilters = { project, status, search };
            renderTranscriptions(state.transcriptions, state.transcription_count, _latestFilters);
        }
    }
}

// ============================================================================
// INITIALISATION
// ============================================================================

console.log("🚀 main.js loaded");

// Initialisation au chargement de la page
async function setActiveView(view) {
    const targetView = view || "transcriptions";
    // Vérifier les permissions pour les vues admin (sauf users qui affiche un message)
    const adminOnlyViews = ["projects", "workers"];
    if (adminOnlyViews.includes(targetView) && !window.VOCALYX_CONFIG?.USER_IS_ADMIN) {
        showToast("Section réservée aux administrateurs.", "warning");
        return;
    }
    currentView = targetView;
    document.body?.setAttribute("data-page", currentView);
    
    navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === currentView);
    });
    
    viewWrappers.forEach(wrapper => {
        if (wrapper.dataset.view === currentView) {
            wrapper.classList.add("active");
        } else {
            wrapper.classList.remove("active");
        }
    });

    // ✅ CHARGEMENT IMMÉDIAT selon la vue active
    if (currentView === "transcriptions") {
        console.log("⚡ Chargement immédiat des transcriptions...");
        await refreshTranscriptions(currentPage, currentLimit);
    } else if (currentView === "workers") {
        console.log("⚡ Chargement immédiat des stats workers...");
        try {
            const stats = await api.getWorkersStatus();
            updateWorkerHeader(stats);
            renderWorkerMonitoringGrid(stats);
        } catch (err) {
            console.error("Erreur lors du chargement des workers:", err);
        }
    } else if (currentView === "users") {
        if (!window.VOCALYX_CONFIG?.USER_IS_ADMIN) {
            showToast("Accès réservé aux administrateurs. Contactez un administrateur pour gérer les comptes.", "warning");
            return;
        }
        await loadUsersList();
    } else if (currentView === "projects") {
        await populateProjectFilters();
    } else if (currentView === "statistics") {
        await loadPerformanceMetrics();
    }
    
    let now = new Date();
    lastUpdateTime = now;
    const viewNames = {
        'transcriptions': 'Transcriptions',
        'projects': 'Projets',
        'users': 'Utilisateurs',
        'workers': 'Workers',
        'statistics': 'Statistiques'
    };
    const viewName = viewNames[currentView] || currentView;
    showToast(`Vue : ${viewName} · ${now.toLocaleTimeString('fr-FR',{hour: '2-digit', minute: '2-digit', second:'2-digit'})}`, "info");
    setContextBanner();
}

function createProjectSelector(user) {
    const userProjectIds = new Set(user.projects.map(p => p.id));
    const availableProjects = allProjects.filter(p => !userProjectIds.has(p.id));

    if (availableProjects.length === 0) {
        return `<small>Tous les projets sont assignés.</small>`;
    }

    const options = availableProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    return `
        <div class="form-group-inline">
            <select class="project-assign-select" data-user-id="${user.id}">
                ${options}
            </select>
            <button class="btn btn-small btn-success btn-assign-project" data-user-id="${user.id}">Assigner</button>
        </div>
    `;
}

async function loadUsersList() {
    if (!window.VOCALYX_CONFIG?.USER_IS_ADMIN) {
        return;
    }
    const container = document.getElementById("users-list-container");
    if (!container) return;

    container.innerHTML = "<p>Chargement des utilisateurs...</p>";
    try {
        const users = await api.listUsers();

        if (!users.length) {
            container.innerHTML = "<p>Aucun utilisateur créé.</p>";
            return;
        }

        container.innerHTML = "";
        users.forEach(user => {
            const card = document.createElement("div");
            card.className = "user-card";

            const projectsList = user.projects.map(p => `
                <li>
                    <span>${escapeHtml(p.name)}</span>
                    <button class="btn btn-small btn-danger btn-remove-project"
                            data-user-id="${user.id}"
                            data-project-id="${p.id}">
                        Retirer
                    </button>
                </li>
            `).join("");

            card.innerHTML = `
                <div class="user-header">
                    <div>
                        <strong>${escapeHtml(user.username)}</strong>
                        ${user.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
                    </div>
                    ${user.username !== 'admin'
                        ? `<button class="btn btn-danger btn-delete-user" data-user-id="${user.id}">Supprimer</button>`
                        : ''}
                </div>
                <div class="user-projects">
                    <strong>Projets assignés:</strong>
                    <ul class="user-projects-list">
                        ${projectsList || '<li><small>Aucun projet assigné.</small></li>'}
                    </ul>
                    ${!user.is_admin ? createProjectSelector(user) : '<small>Les administrateurs ont accès à tous les projets.</small>'}
                </div>
            `;
            container.appendChild(card);
        });

        attachUserCardEvents();
    } catch (err) {
        container.innerHTML = `<p style="color:red;">Erreur: ${err.message}</p>`;
    }
}

function attachUserCardEvents() {
    document.querySelectorAll(".btn-delete-user").forEach(btn => {
        btn.addEventListener("click", async (event) => {
            const userId = event.currentTarget.dataset.userId;
            if (!userId) return;

            if (!confirm("Supprimer cet utilisateur ?")) return;
            try {
                await api.deleteUser(userId);
                showToast("Utilisateur supprimé", "success");
                await loadUsersList();
            } catch (err) {
                showToast(`Erreur: ${err.message}`, "error");
            }
        });
    });

    document.querySelectorAll(".btn-assign-project").forEach(btn => {
        btn.addEventListener("click", async (event) => {
            const userId = event.currentTarget.dataset.userId;
            if (!userId) return;
            const select = document.querySelector(`.project-assign-select[data-user-id="${userId}"]`);
            const projectId = select?.value;
            if (!projectId) return;

            try {
                await api.assignProjectToUser(userId, projectId);
                showToast("Projet assigné", "success");
                await loadUsersList();
            } catch (err) {
                showToast(`Erreur: ${err.message}`, "error");
            }
        });
    });

    document.querySelectorAll(".btn-remove-project").forEach(btn => {
        btn.addEventListener("click", async (event) => {
            const userId = event.currentTarget.dataset.userId;
            const projectId = event.currentTarget.dataset.projectId;
            if (!userId || !projectId) return;

            try {
                await api.removeProjectFromUser(userId, projectId);
                showToast("Projet retiré", "success");
                await loadUsersList();
            } catch (err) {
                showToast(`Erreur: ${err.message}`, "error");
            }
        });
    });
}

async function handleCreateProject() {
    if (!window.VOCALYX_CONFIG?.USER_IS_ADMIN) {
        showToast("Fonction réservée aux administrateurs.", "warning");
        return;
    }

    const input = document.getElementById("new-project-name-input");
    if (!input) return;
    const projectName = input.value.trim();
    const adminKey = window.VOCALYX_CONFIG?.DEFAULT_PROJECT_KEY;

    if (!projectName) {
        showToast("Le nom du projet est requis", "warning");
        return;
    }
    if (!adminKey) {
        showToast("Clé admin indisponible", "error");
        return;
    }

    try {
        const newProject = await api.createProject(projectName, adminKey);
        showToast(`Projet '${newProject.name}' créé`, "success");
        input.value = "";
        await populateProjectFilters();
        await loadUsersList();
    } catch (err) {
        showToast(`Erreur: ${err.message}`, "error");
    }
}

// Fonction pour calculer la force du mot de passe
function calculatePasswordStrength(password) {
    if (!password) return { strength: 'none', score: 0 };
    
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;
    
    if (score <= 2) return { strength: 'weak', score };
    if (score <= 3) return { strength: 'medium', score };
    return { strength: 'strong', score };
}

// Fonction pour mettre à jour le password strength meter
function updatePasswordStrength(password) {
    const strengthBar = document.getElementById("password-strength-bar");
    if (!strengthBar) return;
    
    const { strength } = calculatePasswordStrength(password);
    strengthBar.className = `password-strength-bar ${strength}`;
}

async function handleCreateUser() {
    if (!window.VOCALYX_CONFIG?.USER_IS_ADMIN) {
        showToast("Fonction réservée aux administrateurs.", "warning");
        return;
    }
    const usernameInput = document.getElementById("new-user-username");
    const passwordInput = document.getElementById("new-user-password");
    const isAdminInput = document.getElementById("new-user-is-admin");
    if (!usernameInput || !passwordInput || !isAdminInput) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const isAdmin = isAdminInput.checked;

    // Validations visuelles
    if (!username) {
        showToast("Nom d'utilisateur requis", "warning");
        usernameInput.focus();
        return;
    }
    if (username.length < 3) {
        showToast("Le nom d'utilisateur doit contenir au moins 3 caractères", "warning");
        usernameInput.focus();
        return;
    }
    if (!password) {
        showToast("Mot de passe requis", "warning");
        passwordInput.focus();
        return;
    }
    if (password.length < 6) {
        showToast("Le mot de passe doit contenir au moins 6 caractères", "warning");
        passwordInput.focus();
        return;
    }
    
    const { strength } = calculatePasswordStrength(password);
    if (strength === 'weak') {
        if (!confirm("Le mot de passe est faible. Voulez-vous continuer ?")) {
            return;
        }
    }

    try {
        await api.createUser(username, password, isAdmin);
        showToast(`Utilisateur créé: ${username}`, "success");
        usernameInput.value = "";
        passwordInput.value = "";
        isAdminInput.checked = false;
        updatePasswordStrength("");
        await loadUsersList();
    } catch (err) {
        showToast(`Erreur lors de la création: ${err.message}`, "error");
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("✅ DOMContentLoaded fired");
    
    // Démarrer la mise à jour de l'heure
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime();
    
    navButtons = Array.from(document.querySelectorAll(".sidebar-link[data-view]"));
    quickViewButtons = Array.from(document.querySelectorAll("[data-view-target]"));
    viewWrappers = Array.from(document.querySelectorAll(".view-wrapper[data-view]"));
    
    navButtons.forEach(btn => {
        btn.addEventListener("click", async (event) => {
            event.preventDefault();
            const view = btn.dataset.view;
            if (!view || view === currentView) return;
            await setActiveView(view);
            // setActiveView charge déjà les données, pas besoin de requestDashboardUpdate
        });
    });

    quickViewButtons.forEach(btn => {
        btn.addEventListener("click", async (event) => {
            event.preventDefault();
            const view = btn.dataset.viewTarget;
            if (!view) return;
            await setActiveView(view);
            // setActiveView charge déjà les données, pas besoin de requestDashboardUpdate
        });
    });
    
    console.log("🚀 Lancement du chargement des filtres projets...");
    await populateProjectFilters();
    console.log("✅ Filtres projets chargés.");
    
    // Démarrer la connexion WebSocket AVANT de charger les données
    // Les données viendront uniquement du WebSocket
    console.log("🔄 Connexion au WebSocket pour charger les données...");
    
    // Créer une promesse pour attendre que le WebSocket soit connecté
    const wsConnectedPromise = new Promise((resolve, reject) => {
        api.connectWebSocket(
            handleWebSocketMessage, // Callback pour les messages
            (error) => { // Callback pour les erreurs
                console.error("Échec de la connexion WebSocket:", error);
                reject(error);
            },
            () => {
                console.log("🛰️ WebSocket connecté - chargement des données...");
                resolve();
            }
        );
    });
    
    try {
        // Attendre que le WebSocket soit connecté
        await wsConnectedPromise;
        
        // Le serveur envoie automatiquement initial_dashboard_state à la connexion
        // On attend de recevoir ces données (elles seront traitées dans handleWebSocketMessage)
        // Pour la vue active, on configure juste l'UI sans charger les données
        // (les données viendront via initial_dashboard_state)
        
        // Configurer la vue active (sans charger les données)
        const targetView = currentView || "transcriptions";
        currentView = targetView;
        document.body?.setAttribute("data-page", currentView);
        
        navButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.view === currentView);
        });
        
        viewWrappers.forEach(wrapper => {
            if (wrapper.dataset.view === currentView) {
                wrapper.classList.add("active");
            } else {
                wrapper.classList.remove("active");
            }
        });
        
        setContextBanner();
        
        // Les données seront chargées automatiquement via initial_dashboard_state
        // qui sera traité dans handleWebSocketMessage
        console.log("⏳ Attente des données initiales du serveur...");
        
        // Attendre un peu pour que initial_dashboard_state arrive
        // (normalement il arrive immédiatement après la connexion)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log("✅ Initialization complete. Données chargées via WebSocket.");
    } catch (err) {
        console.error("❌ Erreur lors de la connexion WebSocket:", err);
        showToast("Connexion WebSocket échouée. Tentative de chargement via HTTP...", "warning");
        
        // Fallback : utiliser HTTP si le WebSocket échoue
        try {
            const status = document.getElementById("status-filter")?.value || null;
            const search = document.getElementById("search-input")?.value || null;
            const project = document.getElementById("project-filter")?.value || null;
            const filters = {};
            if (status) filters.status = status;
            if (search) filters.search = search;
            if (project) filters.project = project;
            
            const transcriptions = await api.getTranscriptions(currentPage, currentLimit, filters);
            const countData = await api.countTranscriptions(filters);
            const totalPages = Math.ceil(countData.total_filtered / currentLimit);
            
            renderTranscriptions(transcriptions, countData, filters);
            updatePagination(currentPage, totalPages);
            initialDataLoaded = true;
        } catch (httpErr) {
            console.error("❌ Erreur lors du chargement HTTP:", httpErr);
            showToast("Impossible de charger les données", "error");
        }
    }
    
    const refreshProjectsBtn = document.getElementById("refresh-projects-btn");
    if (refreshProjectsBtn) {
        refreshProjectsBtn.addEventListener("click", async () => {
            const originalText = refreshProjectsBtn.textContent;
            refreshProjectsBtn.disabled = true;
            refreshProjectsBtn.textContent = "Rafraîchissement...";
            try {
                await populateProjectFilters();
            } finally {
                refreshProjectsBtn.disabled = false;
                refreshProjectsBtn.textContent = originalText;
            }
        });
    }

    const createProjectBtn = document.getElementById("create-project-btn");
    if (createProjectBtn) {
        createProjectBtn.addEventListener("click", handleCreateProject);
    }

    const createUserBtn = document.getElementById("create-user-btn");
    if (createUserBtn) {
        createUserBtn.addEventListener("click", handleCreateUser);
    }
    
    // Password strength meter
    const passwordInput = document.getElementById("new-user-password");
    if (passwordInput) {
        passwordInput.addEventListener("input", (e) => {
            updatePasswordStrength(e.target.value);
        });
    }
    
    // Validations visuelles username
    const usernameInput = document.getElementById("new-user-username");
    if (usernameInput) {
        usernameInput.addEventListener("blur", (e) => {
            const username = e.target.value.trim();
            if (username && username.length < 3) {
                e.target.style.borderColor = "#dc3545";
            } else {
                e.target.style.borderColor = "";
            }
        });
    }
    
    // Toggle sidebar sur mobile
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
        });
        // Fermer la sidebar si on clique en dehors sur mobile
        document.addEventListener("click", (e) => {
            if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !sidebarToggle.contains(e.target) && !sidebar.classList.contains("collapsed")) {
                sidebar.classList.add("collapsed");
            }
        });
    }
    
});

    // CTA HERO:"Nouvelle transcription" click event (ouvre la modale)
document.addEventListener('DOMContentLoaded', () => {
  const ctaBtn = document.getElementById('cta-transcribe-btn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      const modal = document.getElementById('upload-modal');
      if (modal) modal.style.display = 'block';
      document.getElementById("upload-project-select").dispatchEvent(new Event('change'));
    });
  }
  
  // ✅ NOUVEAU : Bouton de rafraîchissement des métriques
  const refreshMetricsBtn = document.getElementById('refresh-metrics-btn');
  if (refreshMetricsBtn) {
    refreshMetricsBtn.addEventListener('click', async () => {
      await loadPerformanceMetrics();
    });
  }
});

/**
 * ✅ NOUVEAU : Charge et affiche les métriques de performance
 */
async function loadPerformanceMetrics() {
    const container = document.getElementById('performance-metrics-container');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; color: #64748b;">Chargement des métriques...</p>';
    
    try {
        const metrics = await api.getTranscriptionMetrics();
        
        if (!metrics || metrics.total_transcriptions === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 2rem;">Aucune métrique disponible pour le moment.</p>';
            return;
        }
        
        const metricsHtml = `
            <div class="metrics-summary-grid">
                <div class="metric-summary-card">
                    <div class="metric-summary-label">Total transcriptions</div>
                    <div class="metric-summary-value">${metrics.total_transcriptions}</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-label">⏳ Temps d'attente moyen</div>
                    <div class="metric-summary-value" style="color: #ff9800;">${formatDuration(metrics.avg_queue_wait_time)}</div>
                    <div class="metric-summary-detail">Min: ${formatDuration(metrics.min_queue_wait_time)} | Max: ${formatDuration(metrics.max_queue_wait_time)}</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-label">⚙️ Temps de traitement moyen</div>
                    <div class="metric-summary-value" style="color: #4a90e2;">${formatDuration(metrics.avg_processing_time)}</div>
                    <div class="metric-summary-detail">Min: ${formatDuration(metrics.min_processing_time)} | Max: ${formatDuration(metrics.max_processing_time)}</div>
                </div>
                <div class="metric-summary-card">
                    <div class="metric-summary-label">⏱️ Temps total moyen</div>
                    <div class="metric-summary-value" style="color: #28a745;">${formatDuration(metrics.avg_total_time)}</div>
                    <div class="metric-summary-detail">Attente + Traitement</div>
                </div>
            </div>
            
            <div style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;">Distribution des temps de traitement</h3>
                <div class="distribution-grid">
                    ${Object.entries(metrics.processing_time_distribution || {}).map(([range, count]) => `
                        <div class="distribution-item">
                            <span class="distribution-range">${range}</span>
                            <div class="distribution-bar">
                                <div class="distribution-bar-fill" style="width: ${(count / metrics.total_transcriptions) * 100}%"></div>
                            </div>
                            <span class="distribution-count">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;">Distribution des temps d'attente</h3>
                <div class="distribution-grid">
                    ${Object.entries(metrics.queue_wait_time_distribution || {}).map(([range, count]) => `
                        <div class="distribution-item">
                            <span class="distribution-range">${range}</span>
                            <div class="distribution-bar">
                                <div class="distribution-bar-fill" style="width: ${(count / metrics.total_transcriptions) * 100}%; background: #ff9800;"></div>
                            </div>
                            <span class="distribution-count">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML = metricsHtml;
    } catch (err) {
        console.error('Erreur lors du chargement des métriques:', err);
        container.innerHTML = `<p style="text-align: center; color: #dc3545; padding: 2rem;">Erreur: ${err.message}</p>`;
    }
}