// templates/static/js/cards.js
// Gestion de la grille de transcription (adapté pour utiliser api.js)

// ❌ SUPPRIMER CES LIGNES (elles sont déjà dans main.js)
// let currentPage = 1;
// let currentLimit = 25;

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
            if (modalBody) {
                modalBody.innerHTML = `
                    <div style="text-align:center;padding:2rem;">
                        <div class="spinner"></div>
                        <p>Chargement des détails...</p>
                    </div>
                `;
            }
            
            try {
                // ✅ Utilisation de l'API client
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
                    refreshTranscriptions(currentPage, currentLimit);
                }, 300);
            } catch (err) {
                showToast(`Erreur: ${err.message}`, "error");
            }
        });
    });
}

/**
 * Rafraîchit la grille avec les données via WebSocket
 * Cette fonction délègue à refreshTranscriptions() qui utilise le WebSocket
 */
async function refreshCards(page = 1, limit = currentLimit) {
    // Déléguer à refreshTranscriptions qui utilise maintenant le WebSocket
    await refreshTranscriptions(page, limit);
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
        refreshTranscriptions(page, currentLimit);
    });
    return btn;
}