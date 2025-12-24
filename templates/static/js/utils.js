// utils.js
// Utilitaires généraux

/**
 * Formate une date ISO en format lisible français
 */
function formatHumanDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('fr-FR', {
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
    });
}

/**
 * Affiche une notification toast avec wording standardisé
 * @param {string} message - Message à afficher
 * @param {string} type - Type de toast (success, error, warning, info)
 */
function showToast(message, type="success") {
    // Standardiser le wording des messages
    let standardizedMessage = message;
    
    // S'assurer que les messages d'erreur commencent par un verbe d'action
    if (type === "error" && !/^(Erreur|Échec|Impossible|Échec)/i.test(message)) {
        if (!/^(Erreur|Échec|Impossible)/i.test(message)) {
            standardizedMessage = `Erreur: ${message}`;
        }
    }
    
    toastr.options = {
        positionClass: "toast-top-right",
        timeOut: type === "error" ? 5000 : 3000,
        progressBar: true,
        closeButton: true,
        newestOnTop: true,
        showDuration: 200,
        hideDuration: 200
    };
    toastr[type](standardizedMessage);
}

/**
 * Met à jour l'heure actuelle dans le header
 */
function updateCurrentTime() {
    const now = new Date();
    const timeElement = document.getElementById("current-time");
    if (timeElement) {
        timeElement.textContent = now.toLocaleString('fr-FR', {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
        });
    }
}

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Formate un nombre d'octets en format lisible (Ko, Mo, Go)
 */
function bytesToHuman(bytes) {
    if (bytes == null || bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['B', 'Ko', 'Mo', 'Go', 'To'][i];
}

/**
 * Formate une durée en secondes en format Uptime (ex: 2j 4h 15m)
 */
function formatUptime(seconds) {
    if (seconds == null || seconds < 1) return 'N/A';
    
    seconds = Math.floor(seconds);
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);

    let str = "";
    if (d > 0) str += `${d}j `;
    if (h > 0) str += `${h}h `;
    if (m > 0) str += `${m}m`;
    
    if (str === "") return "< 1m";
    return str.trim();
}

/**
 * Crée le HTML pour une barre de progression
 */
function createProgressBar(percent) {
    if (percent == null) percent = 0;
    percent = Math.max(0, Math.min(100, percent));
    
    let className = "";
    if (percent > 85) className = "high-usage";
    
    return `
        <div class="progress-bar small">
            <div class="progress-bar-inner ${className}" style="width: ${percent}%;">
                ${percent.toFixed(0)}%
            </div>
        </div>
    `;
}