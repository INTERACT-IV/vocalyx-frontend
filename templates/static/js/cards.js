// templates/static/js/cards.js
// Gestion de la grille de transcription (adapté pour utiliser api.js)

let currentPage = 1;
let currentLimit = 25;

/**
 * Attache les événements de clic sur les lignes pour ouvrir la modale
 */
function attachRowClickEvents() {
    document.querySelectorAll("#grid-table-body tr").forEach(row => {
        row.addEventListener("click", async (e) => {
            // Ne pas ouvrir la modale si on clique sur le bouton supprimer
            if (e.target.closest(".btn-delete")) {
                return;
            }
            
            const id = row.dataset.id;
            openModal();
            modalBody.innerHTML = `
                <div style="text-align:center;padding:2rem;">
                    <div class="spinner"></div>
                    <p>Chargement des détails...</p>
                </div>
            `;
            
            try {
                // ✅ Utilisation de l'API client
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
            e.stopPropagation(); // Empêche le clic de se propager à la ligne
            const row = e.target.closest("tr");
            const id = row.dataset.id;
            
            if (!confirm(`Supprimer la transcription ${id.substring(0, 8)}... ?`)) return;
            
            try {
                // ✅ Utilisation de l'API client
                await api.deleteTranscription(id);
                showToast(`Transcription supprimée !`, "success");
                
                // Animation de suppression
                row.style.transition = "opacity 0.3s, transform 0.3s";
                row.style.opacity = "0";
                row.style.transform = "scale(0.95)";
                
                setTimeout(() => {
                    refreshCards(currentPage, currentLimit);
                }, 300);
            } catch (err) {
                showToast(`Erreur: ${err.message}`, "error");
            }
        });
    });
}

/**
 * Rafraîchit la grille avec les données
 */
async function refreshCards(page = 1, limit = currentLimit) {
    const status = document.getElementById("status-filter")?.value || null;
    const search = document.getElementById("search-input")?.value || null;
    const project = document.getElementById("project-filter")?.value || null;
    
    currentPage = page;
    currentLimit = limit;
    
    try {
        // Préparer les filtres
        const filters = {};
        if (status) filters.status = status;
        if (search) filters.search = search;
        if (project) filters.project = project;
        
        // ✅ Utilisation de l'API client pour récupérer les transcriptions
        const entries = await api.getTranscriptions(page, limit, filters);
        
        // ✅ Utilisation de l'API client pour récupérer le compte
        const countData = await api.countTranscriptions(filters);
        
        const totalPages = Math.ceil(countData.total_filtered / limit);
        
        const container = document.getElementById("grid-table-body");
        if (!container) return;
        
        container.innerHTML = "";
        
        if (entries.length === 0) {
            container.innerHTML = `
                <tr><td colspan="9" style="text-align:center;padding:2rem;">
                    Aucune transcription trouvée.
                </td></tr>
            `;
            updatePagination(page, 0);
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        entries.forEach((entry) => {
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
        
        container.appendChild(fragment);
        attachRowClickEvents();
        attachDeleteEvents();
        updatePagination(page, totalPages);
        
    } catch (err) {
        console.error("Erreur:", err);
        const container = document.getElementById("grid-table-body");
        if (container) {
            container.innerHTML = `
                <tr><td colspan="9" style="color:red;text-align:center;padding:2rem;">
                    Erreur de chargement: ${err.message}<br>
                    <small>Vérifiez que vocalyx-api est accessible.</small>
                </td></tr>
            `;
        }
    }
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

    // Bouton première page et page précédente
    if (currentPage > 1) {
        pagination.appendChild(createPageButton(1, "«"));
        pagination.appendChild(createPageButton(currentPage - 1, "‹"));
    }

    // Pages numérotées
    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(createPageButton(i, i, currentPage === i));
    }

    // Bouton page suivante et dernière page
    if (currentPage < totalPages) {
        pagination.appendChild(createPageButton(currentPage + 1, "›"));
        pagination.appendChild(createPageButton(totalPages, "»"));
    }
}

/**
 * Crée un bouton de pagination
 */
function createPageButton(page, text, isActive = false) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.dataset.page = page;
    if (isActive) btn.classList.add("active");
    btn.addEventListener("click", () => {
        refreshCards(page, currentLimit);
    });
    return btn;
}