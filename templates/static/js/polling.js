// polling.js
// Gestion du polling intelligent

let pollingInterval = null;

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        // Ne pas rafraîchir si une modale est ouverte
        const modals = document.querySelectorAll('.modal');
        const isModalOpen = Array.from(modals).some(m => m.style.display === "block");
        if (isModalOpen) return;
        
        // Rafraîchir sans animation pour le polling
        const status = document.getElementById("status-filter").value;
        const search = document.getElementById("search-input").value;
        const project = document.getElementById("project-filter").value;
        
        try {
            // ❗️ CORRECTION : Utilisation de URLSearchParams pour construire l'URL
            const recentParams = new URLSearchParams({
                limit: currentLimit,
                page: currentPage
            });
            if (status) recentParams.append('status', status);
            if (search) recentParams.append('search', search);
            if (project) recentParams.append('project', project);

            const url = `/api/transcribe/recent?${recentParams.toString()}`;
            
            const resp = await fetch(url);
            if (!resp.ok) return;
            const entries = await resp.json();
            
            const container = document.getElementById("grid-table-body");
            if (!container) return; 

            const existingIds = new Set(
                Array.from(container.querySelectorAll('tr[data-id]')).map(c => c.dataset.id)
            );
            
            const newIds = new Set(entries.map(e => e.id));
            
            // Vérifier si les ID à l'écran correspondent aux ID de l'API
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
                            console.log(`🔄 Changement de statut détecté pour ${entry.id}`);
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
        }
    }, 5000); // Polling toutes les 5 secondes
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Arrêter le polling quand la page est cachée
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopPolling();
    } else {
        startPolling();
    }
});