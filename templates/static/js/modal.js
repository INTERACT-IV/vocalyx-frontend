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
            ${data.enrichment_requested && data.enrichment_data ? `
            <button class="modal-tab" data-tab="enrichment">
                <span style="margin-right:0.5rem;">✨</span>Enrichissement
            </button>
            ` : ''}
            <button class="modal-tab" data-tab="segments">
                <span style="margin-right:0.5rem;">🎬</span>Segments
            </button>
            <button class="modal-tab" data-tab="text">
                <span style="margin-right:0.5rem;">📝</span>Texte brut
            </button>
            <button class="modal-tab" data-tab="metrics">
                <span style="margin-right:0.5rem;">📊</span>Métriques
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
                    ${data.enrichment_worker_id ? `
                    <div class="info-item">
                        <span class="info-label">Worker Enrichissement:</span>
                        <span class="info-value">${escapeHtml(data.enrichment_worker_id)}</span>
                    </div>
                    ` : ''}
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
                    ${data.queue_wait_time ? `
                    <div class="info-item">
                        <span class="info-label">Temps d'attente (file):</span>
                        <span class="info-value" style="color: #ff9800;">${formatDuration(data.queue_wait_time)}</span>
                    </div>
                    ` : ''}
                    <div class="info-item">
                        <span class="info-label">Temps de traitement réel:</span>
                        <span class="info-value highlight-value">${data.processing_time ? formatDuration(data.processing_time) : '-'}</span>
                        <small style="color: #64748b; display: block; margin-top: 0.25rem;">(sans temps d'attente)</small>
                    </div>
                    ${data.enrichment_requested ? `
                    <div class="info-item">
                        <span class="info-label">Temps d'enrichissement total:</span>
                        <span class="info-value highlight-value">${data.enrichment_data && data.enrichment_data.timing && data.enrichment_data.timing.total_time ? formatDuration(data.enrichment_data.timing.total_time) : (data.enrichment_processing_time ? formatDuration(data.enrichment_processing_time) : '-')}</span>
                    </div>
                    ${data.enrichment_data && data.enrichment_data.timing ? `
                    <div class="info-item" style="margin-left: 1rem; padding-left: 0.5rem; border-left: 2px solid #4a90e2;">
                        <span class="info-label" style="font-size: 0.9rem; color: #64748b;">• Temps de génération du résumé:</span>
                        <span class="info-value" style="font-size: 0.9rem;">${formatDuration(data.enrichment_data.timing.summary_time || 0)}</span>
                    </div>
                    <div class="info-item" style="margin-left: 1rem; padding-left: 0.5rem; border-left: 2px solid #4a90e2;">
                        <span class="info-label" style="font-size: 0.9rem; color: #64748b;">• Temps de génération du titre:</span>
                        <span class="info-value" style="font-size: 0.9rem;">${formatDuration(data.enrichment_data.timing.title_time || 0)}</span>
                    </div>
                    <div class="info-item" style="margin-left: 1rem; padding-left: 0.5rem; border-left: 2px solid #4a90e2;">
                        <span class="info-label" style="font-size: 0.9rem; color: #64748b;">• Temps de génération du bullet point:</span>
                        <span class="info-value" style="font-size: 0.9rem;">${formatDuration(data.enrichment_data.timing.bullet_points_time || 0)}</span>
                    </div>
                    <div class="info-item" style="margin-left: 1rem; padding-left: 0.5rem; border-left: 2px solid #4a90e2;">
                        <span class="info-label" style="font-size: 0.9rem; color: #64748b;">• Temps de génération du score de satisfaction:</span>
                        <span class="info-value" style="font-size: 0.9rem;">${formatDuration(data.enrichment_data.timing.satisfaction_time || 0)}</span>
                    </div>
                    ` : ''}
                    ` : ''}
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
                    ${data.queued_at ? `
                    <div class="info-item">
                        <span class="info-label">En file (Celery):</span>
                        <span class="info-value">${formatHumanDate(data.queued_at)}</span>
                    </div>
                    ` : ''}
                    ${data.processing_start_time ? `
                    <div class="info-item">
                        <span class="info-label">Début traitement:</span>
                        <span class="info-value">${formatHumanDate(data.processing_start_time)}</span>
                    </div>
                    ` : ''}
                    ${data.processing_end_time ? `
                    <div class="info-item">
                        <span class="info-label">Fin traitement:</span>
                        <span class="info-value">${formatHumanDate(data.processing_end_time)}</span>
                    </div>
                    ` : ''}
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
        
        ${data.enrichment_requested ? `
        <div class="modal-tab-content" data-content="enrichment">
            ${data.enrichment_status === 'done' && data.enrichment_data ? `
            <div class="enrichment-view-container">
                <div class="enrichment-view-header">
                    <h3>📊 Résultats de l'enrichissement</h3>
                </div>
                <div class="enrichment-view-content">
                    <div class="enrichment-container">
                        ${data.enrichment_data.timing ? `
                        <div class="enrichment-timing-info">
                            <strong>⏱️ Temps d'enrichissement :</strong>
                            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                                <li>Titre : ${data.enrichment_data.timing.title_time || 0}s</li>
                                <li>Résumé : ${data.enrichment_data.timing.summary_time || 0}s</li>
                                <li>Score de satisfaction : ${data.enrichment_data.timing.satisfaction_time || 0}s</li>
                                <li>Bullet points : ${data.enrichment_data.timing.bullet_points_time || 0}s</li>
                                <li><strong>Total : ${data.enrichment_data.timing.total_time || data.enrichment_processing_time || 0}s</strong></li>
                            </ul>
                        </div>
                        ` : data.enrichment_processing_time ? `
                        <div class="enrichment-timing-info">
                            <strong>⏱️ Temps d'enrichissement total :</strong> ${data.enrichment_processing_time.toFixed(2)}s
                        </div>
                        ` : ''}
                        
                        <div class="enrichment-item">
                            <h4>📝 Titre${data.enrichment_data.timing ? ` <small style="color:#64748b;">(${data.enrichment_data.timing.title_time || 0}s)</small>` : ''}</h4>
                            <div class="enrichment-value">${escapeHtml(data.enrichment_data.title || 'N/A')}</div>
                        </div>
                        
                        <div class="enrichment-item">
                            <h4>📄 Résumé${data.enrichment_data.timing ? ` <small style="color:#64748b;">(${data.enrichment_data.timing.summary_time || 0}s)</small>` : ''}</h4>
                            <div class="enrichment-value">${escapeHtml(data.enrichment_data.summary || 'N/A')}</div>
                        </div>
                        
                        <div class="enrichment-item">
                            <h4>⭐ Score de satisfaction${data.enrichment_data.timing ? ` <small style="color:#64748b;">(${data.enrichment_data.timing.satisfaction_time || 0}s)</small>` : ''}</h4>
                            <div class="satisfaction-score">
                                <div class="score-value">${data.enrichment_data.satisfaction_score || 'N/A'}/10</div>
                            </div>
                        </div>
                        
                        <div class="enrichment-item">
                            <h4>🔹 Points clés${data.enrichment_data.timing ? ` <small style="color:#64748b;">(${data.enrichment_data.timing.bullet_points_time || 0}s)</small>` : ''}</h4>
                            <ul class="bullet-points">
                                ${(data.enrichment_data.bullet_points || []).map(point => `<li>${escapeHtml(point)}</li>`).join('') || '<li>Aucun point clé disponible</li>'}
                            </ul>
                        </div>
                        
                        ${data.llm_model ? `
                        <div class="enrichment-metadata">
                            <small>Modèle LLM utilisé: <code>${escapeHtml(data.llm_model)}</code></small>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : data.enrichment_status === 'processing' ? `
            <div class="enrichment-container">
                <div class="enrichment-status">
                    <div class="loading-spinner"></div>
                    <p>⏳ Enrichissement en cours...</p>
                    <small>Worker: ${escapeHtml(data.enrichment_worker_id || 'N/A')}</small>
                </div>
            </div>
            ` : data.enrichment_status === 'error' ? `
            <div class="enrichment-container">
                <div class="error-box">
                    <strong>❌ Erreur d'enrichissement:</strong> ${escapeHtml(data.enrichment_error || 'Erreur inconnue')}
                </div>
            </div>
            ` : `
            <div class="enrichment-container">
                <div class="enrichment-status">
                    <p>⏳ Enrichissement en attente...</p>
                </div>
            </div>
            `}
        </div>
        ` : ''}
        
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
        
        <div class="modal-tab-content" data-content="metrics">
            <div class="metrics-view-container">
                <div class="metrics-view-header">
                    <h3>📊 Métriques de Performance</h3>
                </div>
                <div class="metrics-view-content">
                    <div class="metrics-grid">
                        ${data.queue_wait_time ? `
                        <div class="metric-card">
                            <div class="metric-label">⏳ Temps d'attente (file)</div>
                            <div class="metric-value" style="color: #ff9800;">${formatDuration(data.queue_wait_time)}</div>
                            <div class="metric-description">Temps passé dans la file Celery avant traitement</div>
                        </div>
                        ` : ''}
                        ${data.processing_time ? `
                        <div class="metric-card">
                            <div class="metric-label">⚙️ Temps de traitement réel</div>
                            <div class="metric-value" style="color: #4a90e2;">${formatDuration(data.processing_time)}</div>
                            <div class="metric-description">Temps réel de traitement (sans attente)</div>
                        </div>
                        ` : ''}
                        ${data.queue_wait_time && data.processing_time ? `
                        <div class="metric-card">
                            <div class="metric-label">⏱️ Temps total</div>
                            <div class="metric-value" style="color: #28a745;">${formatDuration(data.queue_wait_time + data.processing_time)}</div>
                            <div class="metric-description">Attente + Traitement</div>
                        </div>
                        ` : ''}
                        ${data.queue_wait_time && data.processing_time ? `
                        <div class="metric-card">
                            <div class="metric-label">📈 Ratio attente/traitement</div>
                            <div class="metric-value" style="color: #6c757d;">${(data.queue_wait_time / data.processing_time).toFixed(2)}x</div>
                            <div class="metric-description">${data.queue_wait_time > data.processing_time ? '⚠️ Plus de temps en attente qu\'en traitement' : '✅ Traitement plus long que l\'attente'}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="metrics-timeline" style="margin-top: 2rem;">
                        <h4 style="margin-bottom: 1rem;">⏱️ Timeline</h4>
                        <div class="timeline-item">
                            <span class="timeline-label">Créé:</span>
                            <span class="timeline-value">${formatHumanDate(data.created_at)}</span>
                        </div>
                        ${data.queued_at ? `
                        <div class="timeline-item">
                            <span class="timeline-label">En file (Celery):</span>
                            <span class="timeline-value">${formatHumanDate(data.queued_at)}</span>
                            ${data.created_at && data.queued_at ? `
                            <span class="timeline-duration" style="color: #ff9800;">+${formatDuration((new Date(data.queued_at) - new Date(data.created_at)) / 1000)}</span>
                            ` : ''}
                        </div>
                        ` : ''}
                        ${data.processing_start_time ? `
                        <div class="timeline-item">
                            <span class="timeline-label">Début traitement:</span>
                            <span class="timeline-value">${formatHumanDate(data.processing_start_time)}</span>
                            ${data.queued_at && data.processing_start_time ? `
                            <span class="timeline-duration" style="color: #ff9800;">+${formatDuration((new Date(data.processing_start_time) - new Date(data.queued_at)) / 1000)} (attente)</span>
                            ` : ''}
                        </div>
                        ` : ''}
                        ${data.processing_end_time ? `
                        <div class="timeline-item">
                            <span class="timeline-label">Fin traitement:</span>
                            <span class="timeline-value">${formatHumanDate(data.processing_end_time)}</span>
                            ${data.processing_start_time && data.processing_end_time ? `
                            <span class="timeline-duration" style="color: #4a90e2;">+${formatDuration((new Date(data.processing_end_time) - new Date(data.processing_start_time)) / 1000)} (traitement)</span>
                            ` : ''}
                        </div>
                        ` : ''}
                        ${data.finished_at ? `
                        <div class="timeline-item">
                            <span class="timeline-label">Terminé:</span>
                            <span class="timeline-value">${formatHumanDate(data.finished_at)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="modal-tab-content" data-content="json">
            <div class="json-view-container">
                <div class="json-view-header">
                    <h3>JSON brut</h3>
                    <div class="json-view-actions">
                        <button class="btn btn-primary" id="json-copy-btn">📋 Copier JSON</button>
                    </div>
                </div>
                <div class="json-view-content">
                    <pre class="json-formatted" id="json-formatted-content">${formatJSON(data)}</pre>
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
    
    // Ajouter l'événement de copie pour le JSON
    const jsonCopyBtn = document.getElementById('json-copy-btn');
    if (jsonCopyBtn) {
        jsonCopyBtn.addEventListener('click', () => {
            const jsonToCopy = JSON.stringify(data, null, 2);
            copyToClipboard(jsonToCopy);
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
 * Formate et colore le JSON de manière belle
 * @param {Object} obj - L'objet à formater
 * @param {number} indent - Niveau d'indentation (interne)
 * @returns {string} - HTML formaté avec coloration syntaxique
 */
function formatJSON(obj, indent = 0) {
    const indentStr = '  '.repeat(indent);
    const nextIndent = indent + 1;
    const nextIndentStr = '  '.repeat(nextIndent);
    
    if (obj === null) {
        return '<span class="json-null">null</span>';
    }
    
    if (obj === undefined) {
        return '<span class="json-undefined">undefined</span>';
    }
    
    const type = typeof obj;
    
    if (type === 'string') {
        return `<span class="json-string">"${escapeHtml(obj)}"</span>`;
    }
    
    if (type === 'number') {
        return `<span class="json-number">${obj}</span>`;
    }
    
    if (type === 'boolean') {
        return `<span class="json-boolean">${obj}</span>`;
    }
    
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '<span class="json-bracket">[]</span>';
        }
        
        const items = obj.map(item => {
            return `${nextIndentStr}${formatJSON(item, nextIndent)}`;
        }).join(',\n');
        
        return `<span class="json-bracket">[</span>\n${items}\n${indentStr}<span class="json-bracket">]</span>`;
    }
    
    if (type === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '<span class="json-brace">{}</span>';
        }
        
        const items = keys.map(key => {
            const value = formatJSON(obj[key], nextIndent);
            return `${nextIndentStr}<span class="json-key">"${escapeHtml(key)}"</span>: ${value}`;
        }).join(',\n');
        
        return `<span class="json-brace">{</span>\n${items}\n${indentStr}<span class="json-brace">}</span>`;
    }
    
    return escapeHtml(String(obj));
}

/**
 * Copie le texte dans le presse-papier
 */
function copyToClipboard(text) {
    // Méthode moderne avec navigator.clipboard (nécessite HTTPS ou localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Texte copié dans le presse-papier !", "success");
        }).catch(err => {
            // Fallback si clipboard API échoue
            fallbackCopyToClipboard(text);
        });
    } else {
        // Fallback pour les navigateurs qui ne supportent pas clipboard API
        fallbackCopyToClipboard(text);
    }
}

/**
 * Méthode de fallback pour copier dans le presse-papier
 */
function fallbackCopyToClipboard(text) {
    // Créer un élément textarea temporaire
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        // Utiliser la méthode classique execCommand
        const successful = document.execCommand('copy');
        if (successful) {
            showToast("Texte copié dans le presse-papier !", "success");
        } else {
            showToast("Erreur lors de la copie. Veuillez copier manuellement.", "error");
        }
    } catch (err) {
        showToast("Erreur lors de la copie. Veuillez copier manuellement.", "error");
    } finally {
        // Nettoyer l'élément temporaire
        document.body.removeChild(textArea);
    }
}
