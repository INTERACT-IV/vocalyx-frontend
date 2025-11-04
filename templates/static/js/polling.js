// templates/static/js/polling.js
// Gestion du polling intelligent (adapté pour utiliser api.js)

let pollingInterval = null;

/**
 * Démarre le polling des transcriptions
 */
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        // Ne pas rafraîchir si une modale est ouverte
        const modals = document.querySelectorAll('.modal');
        const isModalOpen = Array.from(modals).some(m => m.style.display === "block");
        if (isModalOpen) return;
        
        // Récupérer les filtres actuels
        const status = document.getElementById("status-filter")?.value || null;
        const search = document.getElementById("search-input")?.value || null;
        const project = document.getElementById("project-filter")?.value || null;
        
        try {
            // Préparer les filtres
            const filters = {};
            if (status) filters.status = status;
            if (search) filters.search = search;
            if (project) filters.project = project;
            
            // ✅ Utilisation de l'API client
            const entries = await api.getTranscriptions(currentPage, currentLimit, filters);
            
            const container = document.getElementById("grid-table-body");
            if (!container) return;

            // Récupérer les IDs actuellement affichés
            const existingIds = new Set(
                Array.from(container.querySelectorAll('tr[data-id]')).map(row => row.dataset.id)
            );
            
            // Récupérer les IDs de la réponse API
            const newIds = new Set(entries.map(e => e.id));
            
            // Vérifier si les ID ont changé (ajout/suppression)
            let hasChanges = existingIds.size !== newIds.size || 
                             ![...existingIds].every(id => newIds.has(id));
            
            if (hasChanges) {
                console.log('🔄 Changements détectés (ID), rafraîchissement...');
                await refreshCards(currentPage, currentLimit);
            } else {
                // Si les ID sont les mêmes, vérifier si les statuts ont changé
                let statusChanged = false;
                
                entries.forEach(entry => {
                    const row = container.querySelector(`tr[data-id="${entry.id}"]`);
                    if (row) {
                        const statusTextEl = row.querySelector('.status-text');
                        if (statusTextEl && statusTextEl.textContent !== entry.status) {
                            console.log(`🔄 Changement de statut détecté pour ${entry.id}: ${statusTextEl.textContent} → ${entry.status}`);
                            statusChanged = true;
                        }
                    }
                });
                
                if (statusChanged) {
                    await refreshCards(currentPage, currentLimit);
                }
            }
        } catch (err) {
            console.error('Erreur polling:', err);
            // En cas d'erreur, ne pas arrêter le polling
            // L'erreur sera visible dans la console mais n'empêchera pas les prochaines tentatives
        }
    }, 5000); // Polling toutes les 5 secondes
    
    console.log('✅ Polling démarré (intervalle: 5s)');
}

/**
 * Arrête le polling
 */
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('⏸️ Polling arrêté');
    }
}

/**
 * Redémarre le polling
 */
function restartPolling() {
    stopPolling();
    startPolling();
    console.log('🔄 Polling redémarré');
}

// Arrêter le polling quand la page est cachée (économie de ressources)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('👁️ Page cachée, arrêt du polling');
        stopPolling();
    } else {
        console.log('👁️ Page visible, redémarrage du polling');
        startPolling();
    }
});

// Arrêter le polling avant de quitter la page
window.addEventListener('beforeunload', () => {
    stopPolling();
});