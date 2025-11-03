// main.js
// Point d'entrée principal de l'application

/**
 * Récupère tous les projets et remplit les listes <select>
 */
async function populateProjectFilters() {
    const filterSelect = document.getElementById("project-filter");
    const uploadSelect = document.getElementById("upload-project-select");
    
    // Utilise la clé admin (du projet technique) pour lister les projets
    const adminKey = window.VOCALYX_CONFIG.DEFAULT_PROJECT_KEY;
    if (!adminKey || adminKey === "erreur_cle") {
        console.error("Clé admin non chargée. Impossible de lister les projets.");
        showToast("Erreur: Clé Admin non chargée", "error");
        return;
    }

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
        
        // Vider les listes (sauf la première option)
        filterSelect.innerHTML = '<option value="">Tous les projets</option>';
        uploadSelect.innerHTML = ''; // Vider complètement

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
            
            // Auto-sélectionner le projet 'default_internal'
            if (project.name === window.VOCALYX_CONFIG.DEFAULT_PROJECT_NAME) {
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
 * Met à jour le statut des workers (Grid)
 */
async function updateWorkerStatus() {
    const gridContainer = document.getElementById("worker-monitoring-grid");
    const headerContainer = document.getElementById("worker-status-container");
    if (!gridContainer || !headerContainer) return;

    try {
        const resp = await fetch("/api/monitoring/status");
        if (!resp.ok) throw new Error("Network response was not ok");
        const workers = await resp.json();

        let totalActive = 0;
        let totalMax = 0;
        let offline = 0;
        
        gridContainer.innerHTML = ""; // Vider la grille

        if (workers.length === 0) {
            gridContainer.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:1rem;">Aucun worker configuré ou trouvé.</td></tr>`;
        }

        workers.forEach(w => {
            if (w.status === "offline") {
                offline++;
            } else {
                totalActive += w.active_tasks;
                totalMax += w.max_workers;
            }
            
            const row = document.createElement("tr");
            row.className = `status-${w.status}`;
            
            let rowHtml = "";
            if (w.status !== "offline") {
                const uptime = w.uptime_seconds ? formatDuration(w.uptime_seconds) : 'N/A';
                const audioTime = w.total_audio_processed_s ? formatDuration(w.total_audio_processed_s) : '0s';
                
                rowHtml = `
                    <td class="col-instance"><strong>${escapeHtml(w.instance_name)}</strong><br><small>${escapeHtml(w.machine_name)}</small></td>
                    <td class="col-status">
                        <span class="status-indicator"></span>
                        <span class="status-text">${escapeHtml(w.status)}</span>
                    </td>
                    <td class="col-charge-num">
                        <span class="bar-chart-text">${w.active_tasks} / ${w.max_workers}</span>
                    </td>
                    <td class="col-charge-bar">
                        <span class="bar-chart-text">${w.usage_percent}%</span>
                        <div class="progress-bar small">
                            <div class="progress-bar-inner ${w.usage_percent > 80 ? 'high-usage' : ''}" style="width: ${w.usage_percent}%;">
                            </div>
                        </div>
                    </td>
                    <td class="col-cpu-num">
                        <span class="bar-chart-text">${w.cpu_usage_percent}%</span>
                    </td>
                    <td class="col-cpu-bar">
                        <div class="progress-bar small">
                            <div class="progress-bar-inner ${w.cpu_usage_percent > 80 ? 'high-usage' : ''}" style="width: ${w.cpu_usage_percent}%;">
                            </div>
                        </div>
                    </td>
                    <td class="col-ram-num">
                        <span class="bar-chart-text">${w.memory_usage_percent}%</span>
                    </td>
                    <td class="col-ram-bar">
                        <div class="progress-bar small">
                            <div class="progress-bar-inner ${w.memory_usage_percent > 80 ? 'high-usage' : ''}" style="width: ${w.memory_usage_percent}%;">
                            </div>
                        </div>
                    </td>
                    <td class="col-uptime">${uptime}</td>
                    <td class="col-jobs">${w.total_jobs_completed}</td>
                    <td class="col-audio">${audioTime}</td>
                `;
            } else {
                rowHtml = `
                    <td class="col-instance"><strong>${escapeHtml(w.instance_name)}</strong></td>
                    <td class="col-status">
                        <span class="status-indicator"></span>
                        <span class="status-text">Offline</span>
                    </td>
                    <td colspan="9" style="color:var(--danger);font-size:0.9rem;">
                        Erreur : ${escapeHtml(w.error)}
                    </td>
                `;
            }

            row.innerHTML = rowHtml;
            gridContainer.appendChild(row);
        });

        // Mettre à jour le statut global dans le header
        let statusClass = "status-ok";
        if (offline > 0) statusClass = "status-error";
        else if (totalActive === totalMax && totalMax > 0) statusClass = "status-busy";

        headerContainer.innerHTML = `
            <span class="worker-status-light ${statusClass}"></span>
            <span style="font-weight:600;">Workers: ${totalActive} / ${totalMax}</span>
            ${offline > 0 ? `<span style="color:#dc3545;font-weight:600;">(${offline} offline)</span>` : ''}
        `;

    } catch (err) {
        console.error("Failed to fetch worker status:", err);
        headerContainer.innerHTML = `<span class="worker-status-light status-error"></span> <span style="font-weight:600;">Workers: Error</span>`;
        gridContainer.innerHTML = `<tr><td colspan="11" style="color:red;text-align:center;padding:1rem;">Erreur lors du chargement des workers.</td></tr>`;
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Démarrer la mise à jour de l'heure
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime();
    
    // Démarrer le monitoring des workers
    setInterval(updateWorkerStatus, 5000); // toutes les 5 secondes
    updateWorkerStatus();

    // Charger la liste des projets
    populateProjectFilters();

    // Charger les cartes initiales (grille de transcriptions)
    refreshCards(1, 25); // Limite par défaut à 25
    
    // Démarrer le polling des cartes (grille de transcriptions)
    startPolling();
});