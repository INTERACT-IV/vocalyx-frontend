// modal.js
// Gestion de la modal

const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const spanClose = document.querySelector(".close");
let lastFocusedElement = null;
let currentTranscriptionData = null;

/**
 * Ouvre la modal avec gestion du focus
 */
function openModal(data = null) {
    lastFocusedElement = document.activeElement;
    if (modal) {
        modal.style.display = "block";
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeyDown);
        
        // Focus sur le titre de la modale
        setTimeout(() => {
            const modalTitle = modal.querySelector('h2');
            if (modalTitle) {
                modalTitle.setAttribute('tabindex', '-1');
                modalTitle.focus();
            }
        }, 100);
    }
}

/**
 * Ferme la modal avec retour du focus
 */
function closeModal() {
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeyDown);
        
        // Retour du focus sur l'élément déclencheur
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    }
}

/**
 * Gestion des touches clavier
 */
function handleKeyDown(e) {
    if (e.key === "Escape") closeModal();
}

// Événements de fermeture
if (spanClose) {
    spanClose.onclick = closeModal;
}
window.onclick = (event) => {
    if (event.target == modal) closeModal();
};

/**
 * Rend le contenu de la modal avec les détails d'une transcription (avec onglets)
 * @param {Object} data - Données de la transcription
 */
function renderTranscriptionModal(data) {
    currentTranscriptionData = data;
    
    const segmentsHtml = (data.segments || []).map((seg, idx) => `
        <div class="segment" data-start="${seg.start}" data-end="${seg.end}" data-index="${idx}" tabindex="0" 
             title="Durée: ${seg.start}s - ${seg.end}s">
            <strong>[${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s]</strong> ${escapeHtml(seg.text || '')}
        </div>
    `).join('');
    
    const fullText = data.text || 'Aucun texte disponible.';
    const jsonData = JSON.stringify(data, null, 2);
    
    modalBody.innerHTML = `
        <div class="modal-header">
            <h2 tabindex="-1" style="margin:0;font-size:inherit;">Détails de la transcription</h2>
            <span class="close" onclick="closeModal()" aria-label="Fermer">&times;</span>
        </div>
        
        <div class="modal-tabs">
            <button class="modal-tab active" data-tab="summary">
                <span style="margin-right:0.5rem;">📋</span>Résumé
            </button>
            <button class="modal-tab" data-tab="segments">
                <span style="margin-right:0.5rem;">🎬</span>Segments
            </button>
            <button class="modal-tab" data-tab="text">
                <span style="margin-right:0.5rem;">📝</span>Texte brut
            </button>
            <button class="modal-tab" data-tab="json">
                <span style="margin-right:0.5rem;">🔧</span>JSON
            </button>
        </div>
        
        <div class="modal-tab-content active" data-content="summary">
            <div class="info-grid">
                <div class="info-section">
                    <h4 class="info-section-title">Identifiant</h4>
                    <div class="info-item">
                        <span class="info-label">ID:</span>
                        <span class="info-value code-value">${escapeHtml(data.id || '-')}</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h4 class="info-section-title">Projet & Worker</h4>
                    <div class="info-item">
                        <span class="info-label">Projet:</span>
                        <span class="info-value">${escapeHtml(data.project_name || 'N/A')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Worker:</span>
                        <span class="info-value">${escapeHtml(data.worker_id || 'N/A')}</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h4 class="info-section-title">Statut</h4>
                    <div class="info-item">
                        <span class="info-label">Statut:</span>
                        <span class="info-value">${statusToBadge(data.status || '-')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Langue:</span>
                        <span class="info-value">${escapeHtml(data.language || '-')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">VAD:</span>
                        <span class="info-value">${data.vad_enabled ? '<span style="color:#28a745;">✅ Activé</span>' : '<span style="color:#dc3545;">❌ Désactivé</span>'}</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h4 class="info-section-title">Temps & Performance</h4>
                    <div class="info-item">
                        <span class="info-label">Durée audio:</span>
                        <span class="info-value highlight-value">${data.duration ? formatDuration(data.duration) : '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Temps traitement:</span>
                        <span class="info-value highlight-value">${data.processing_time ? formatDuration(data.processing_time) : '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Segments:</span>
                        <span class="info-value">${data.segments_count || 0}</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h4 class="info-section-title">Dates</h4>
                    <div class="info-item">
                        <span class="info-label">Créé:</span>
                        <span class="info-value">${formatHumanDate(data.created_at)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Terminé:</span>
                        <span class="info-value">${formatHumanDate(data.finished_at)}</span>
                    </div>
                </div>
            </div>
            
            ${data.error_message ? `
            <div class="error-box">
                <strong>❌ Erreur:</strong> ${escapeHtml(data.error_message)}
            </div>
            ` : ''}
        </div>
        
        <div class="modal-tab-content" data-content="segments">
            <div class="segments-layout">
                <div class="segments-panel">
                    <h3>Segments (${data.segments_count || 0})</h3>
                    <div class="segments-list">
                        ${segmentsHtml || '<p style="color:#64748b;text-align:center;padding:2rem;">Aucun segment disponible.</p>'}
                    </div>
                </div>
                <div class="text-panel">
                    <div class="text-panel-header">
                        <h3>Texte complet</h3>
                        <button onclick="copyToClipboard('${escapeHtml(fullText).replace(/'/g, "\\'")}')" class="btn btn-success btn-sm">📋 Copier</button>
                    </div>
                    <div id="highlighted-text">${escapeHtml(fullText)}</div>
                </div>
            </div>
        </div>
        
        <div class="modal-tab-content" data-content="text">
            <div class="text-view-container">
                <div class="text-view-header">
                    <h3>Texte brut</h3>
                    <button onclick="copyToClipboard('${escapeHtml(fullText).replace(/'/g, "\\'")}')" class="btn btn-success">📋 Copier</button>
                </div>
                <div class="text-view-content">
                    <pre>${escapeHtml(fullText)}</pre>
                </div>
            </div>
        </div>
        
        <div class="modal-tab-content" data-content="json">
            <div class="json-view-container">
                <div class="json-view-header">
                    <h3>JSON brut</h3>
                    <div class="json-view-actions">
                        <a href="/transcribe/${data.id}" target="_blank" class="btn btn-primary">🔗 Voir le JSON</a>
                        <button class="btn btn-success" id="json-copy-btn">📋 Copier</button>
                    </div>
                </div>
                <div class="json-view-content">
                    <pre>${escapeHtml(jsonData)}</pre>
                </div>
            </div>
        </div>
    `;
    
    // Gestion des onglets
    document.querySelectorAll(".modal-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.dataset.tab;
            
            // Désactiver tous les onglets
            document.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".modal-tab-content").forEach(c => c.classList.remove("active"));
            
            // Activer l'onglet sélectionné
            tab.classList.add("active");
            const content = document.querySelector(`[data-content="${targetTab}"]`);
            if (content) content.classList.add("active");
        });
    });
    
    // Ajouter les événements de clic sur les segments avec surlignage
    attachSegmentEvents(data);
    
    // Ajouter l'événement de copie pour le JSON (utiliser jsonData directement depuis la closure)
    const jsonCopyBtn = document.getElementById('json-copy-btn');
    if (jsonCopyBtn) {
        jsonCopyBtn.addEventListener('click', () => {
            copyToClipboard(jsonData); // jsonData est accessible via la closure
        });
    }
}

/**
 * Attache les événements de sélection de segments avec surlignage
 */
function attachSegmentEvents(data) {
    const segments = document.querySelectorAll(".segment");
    const fullText = data.text || '';
    
    segments.forEach(seg => {
        seg.addEventListener("click", () => {
            // Désélectionner tous les segments
            document.querySelectorAll(".segment").forEach(s => {
                s.classList.remove("selected");
            });
            
            // Sélectionner le segment cliqué
            seg.classList.add("selected");
            
            // Surligner dans le texte complet
            highlightTextInFullText(seg, fullText);
        });
        
        seg.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                seg.click();
            }
        });
    });
}

/**
 * Surligne le texte du segment dans le texte complet
 */
function highlightTextInFullText(segment, fullText) {
    const highlightedTextDiv = document.getElementById("highlighted-text");
    if (!highlightedTextDiv) return;
    
    const segmentText = segment.textContent.replace(/\[\d+\.\d+s - \d+\.\d+s\]\s*/, '').trim();
    const start = parseFloat(segment.dataset.start);
    const end = parseFloat(segment.dataset.end);
    
    // Retirer les surlignages précédents
    highlightedTextDiv.innerHTML = escapeHtml(fullText);
    
    // Trouver et surligner le texte correspondant
    if (segmentText && fullText.includes(segmentText)) {
        const regex = new RegExp(`(${escapeRegex(segmentText)})`, 'gi');
        highlightedTextDiv.innerHTML = escapeHtml(fullText).replace(regex, '<span class="text-highlight active">$1</span>');
        
        // Scroll vers le surlignage
        const highlight = highlightedTextDiv.querySelector('.text-highlight.active');
        if (highlight) {
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

/**
 * Échappe les caractères spéciaux pour regex
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Copie le texte dans le presse-papier
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Texte copié dans le presse-papier !", "success");
    }).catch(err => {
        showToast("Erreur lors de la copie", "error");
    });
}
