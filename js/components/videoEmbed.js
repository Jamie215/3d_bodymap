// videoEmbed.js
// Self-contained YouTube video embed component: thumbnail with play
// button + fullscreen overlay with iframe.  Used in the summary view.

// ============================================================================
// MODULE STATE
// ============================================================================

let videoOverlay = null;   // Created once, reused across updateSummaryStatus calls

// ============================================================================
// INTERNAL — SANITISE VIDEO ID
// ============================================================================

/**
 * Sanitise a YouTube video ID to prevent injection.
 * Valid IDs contain only alphanumeric characters, hyphens, and underscores.
 *
 * @param {string} videoId
 * @returns {string} sanitised ID, or empty string if invalid
 */
function sanitiseVideoId(videoId) {
    if (typeof videoId !== 'string') return '';
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a video embed element with thumbnail and fullscreen overlay.
 *
 * @param {string} videoId — YouTube video ID
 * @returns {HTMLElement}  — container ready to append into the DOM
 */
export function createVideoEmbed(videoId = '2LGwMr0mNc4', titleText = 'Pain & Symptom Assessment Form') {
    const safeId = sanitiseVideoId(videoId);

    const container = document.createElement('div');
    container.classList.add('summary-video-container');

    // Title
    const title = document.createElement('span');
    title.className = 'summary-title';
    title.textContent = titleText;

    // Thumbnail wrapper
    const thumbnail = document.createElement('div');
    thumbnail.className = 'video-thumbnail';
    thumbnail.id = 'video-thumbnail';

    const img = document.createElement('img');
    img.src = `https://img.youtube.com/vi/${safeId}/hqdefault.jpg`;
    img.alt = 'Video Tutorial Thumbnail';
    img.className = 'video-thumbnail-img';

    const playBtn = document.createElement('div');
    playBtn.className = 'video-play-btn';
    const playIcon = document.createElement('i');
    playIcon.className = 'fa-solid fa-play';
    playBtn.appendChild(playIcon);

    thumbnail.append(img, playBtn);

    if (titleText) container.append(title, thumbnail);
    else container.append(thumbnail);

    ensureOverlay();

    // Open overlay on thumbnail click
    thumbnail.addEventListener('click', () => openOverlay(safeId));

    return container;
}

// ============================================================================
// INTERNAL — OVERLAY LIFECYCLE
// ============================================================================

/**
 * Lazily create the fullscreen overlay. Idempotent — safe to call
 * multiple times; only builds the DOM once.
 *
 * Uses static markup only — no interpolated values.
 */
function ensureOverlay() {
    if (videoOverlay) return;

    videoOverlay = document.createElement('div');
    videoOverlay.classList.add('video-overlay');
    videoOverlay.id = 'video-overlay';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'video-overlay-close';
    closeBtn.id = 'video-overlay-close';
    closeBtn.title = 'Close Video';
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fa-solid fa-xmark';
    closeBtn.appendChild(closeIcon);

    // Content wrapper + iframe
    const content = document.createElement('div');
    content.className = 'video-overlay-content';

    const iframe = document.createElement('iframe');
    iframe.id = 'summary-video-iframe';
    iframe.src = '';
    iframe.title = 'Pain Assessment Tool — How to Use';
    iframe.setAttribute('frameborder', '0');
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;

    content.appendChild(iframe);
    videoOverlay.append(closeBtn, content);

    closeBtn.addEventListener('click', closeOverlay);
    videoOverlay.addEventListener('click', (e) => {
        if (e.target === videoOverlay) closeOverlay();
    });

    document.body.appendChild(videoOverlay);
}

function openOverlay(videoId) {
    const iframe = videoOverlay.querySelector('#summary-video-iframe');
    iframe.src = `https://www.youtube.com/embed/${sanitiseVideoId(videoId)}?rel=0&controls=1&playsinline=1`
    videoOverlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';
}

function closeOverlay() {
    const iframe = videoOverlay.querySelector('#summary-video-iframe');
    iframe.src = '';
    videoOverlay.classList.remove('is-active');
    document.body.style.overflow = '';
}