// cards.js
// Gestion de la grille de transcription

let currentPage = 1;
let currentLimit = 25; // Limite par défaut

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
                // Cet appel est simple et correct
                const resp = await fetch(`/api/transcribe/${id}`);
                if (!resp.ok) throw new Error(`Erreur: ${resp.status}`);
                const data = await resp.json();
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
                // Cet appel est simple et correct
                const resp = await fetch(`/api/transcribe/${id}`, { method: "DELETE" });
                if (!resp.ok) throw new Error(await resp.text());
                showToast(`Transcription supprimée !`, "success");
                
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
async function refreshCards(page=1, limit=currentLimit) {
    const status = document.getElementById("status-filter").value;
    const search = document.getElementById("search-input").value;
    const project = document.getElementById("project-filter").value;
    
    currentPage = page;
    currentLimit = limit;
    
    try {
        // ❗️ CORRECTION : Utilisation de URLSearchParams pour construire l'URL
        const recentParams = new URLSearchParams({
            limit: limit,
            page: page
        });
        if (status) recentParams.append('status', status);
        if (search) recentParams.append('search', search);
        if (project) recentParams.append('project', project);

        const url = `/api/transcribe/recent?${recentParams.toString()}`;
        
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const entries = await resp.json();
        
        // ❗️ CORRECTION : Utilisation de URLSearchParams pour l'URL de comptage
        const countParams = new URLSearchParams();
        if (status) countParams.append('status', status);
        if (search) countParams.append('search', search);
        if (project) countParams.append('project', project);

        const countUrl = `/api/transcribe/count?${countParams.toString()}`;
        
        const countResp = await fetch(countUrl);
        const countData = await countResp.json();
        
        const totalPages = Math.ceil(countData.total_filtered / limit);
        
        const container = document.getElementById("grid-table-body");
        container.innerHTML = "";
        
        if (entries.length === 0) {
            container.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;">Aucune transcription trouvée.</td></tr>`;
            updatePagination(page, 0);
            return;
        }
        
        const fragment = document.createDocumentFragment();
        entries.forEach((entry, i) => {
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
        document.getElementById("grid-table-body").innerHTML =
            `<tr><td colspan="9" style="color:red;text-align:center;padding:2rem;">Erreur de chargement. Veuillez réessayer.</td></tr>`;
    }
}

function updatePagination(currentPage, totalPages) {
    const pagination = document.getElementById("pagination");
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
        refreshCards(page, currentLimit);
    });
    return btn;
}