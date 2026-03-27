// videoEmbed.js
// Self-contained YouTube video embed component: thumbnail with play
// button + fullscreen overlay with iframe.  Used in the summary view.

// ============================================================================
// MODULE STATE
// ============================================================================

let videoOverlay = null;   // Created once, reused across updateSummaryStatus calls

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a video embed element with thumbnail and fullscreen overlay.
 *
 * @param {string} videoId — YouTube video ID
 * @returns {HTMLElement}  — container ready to append into the DOM
 */
export function createVideoEmbed(videoId = 'TeL9O6yiCMs') {
    const container = document.createElement('div');
    container.classList.add('summary-video-container');

    container.innerHTML = `
        <span class="summary-title">Getting Started</span>
        <p class="summary-instruction">Watch this video to learn how to use this application.</p>
        <div class="video-thumbnail" id="video-thumbnail">
            <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg"
                 alt="Video Tutorial Thumbnail"
                 class="video-thumbnail-img">
            <div class="video-play-btn">
                <i class="fa-solid fa-play"></i>
            </div>
        </div>
    `;

    ensureOverlay(videoId);

    // Open overlay on thumbnail click
    const thumbnail = container.querySelector('#video-thumbnail');
    thumbnail.addEventListener('click', () => openOverlay(videoId));

    return container;
}

// ============================================================================
// INTERNAL — OVERLAY LIFECYCLE
// ============================================================================

/**
 * Lazily create the fullscreen overlay. Idempotent — safe to call
 * multiple times; only builds the DOM once.
 */
function ensureOverlay() {
    if (videoOverlay) return;

    videoOverlay = document.createElement('div');
    videoOverlay.classList.add('video-overlay');
    videoOverlay.id = 'video-overlay';

    videoOverlay.innerHTML = `
        <button class="video-overlay-close" id="video-overlay-close" title="Close Video">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="video-overlay-content">
            <iframe
                id="summary-video-iframe"
                src=""
                title="Pain Assessment Tool — How to Use"
                frameborder="0"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        </div>
    `;

    videoOverlay.querySelector('#video-overlay-close').addEventListener('click', closeOverlay);
    videoOverlay.addEventListener('click', (e) => {
        if (e.target === videoOverlay) closeOverlay();
    });

    document.body.appendChild(videoOverlay);
}

function openOverlay(videoId) {
    const iframe = videoOverlay.querySelector('#summary-video-iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0`;
    videoOverlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';
}

function closeOverlay() {
    const iframe = videoOverlay.querySelector('#summary-video-iframe');
    iframe.src = '';
    videoOverlay.classList.remove('is-active');
    document.body.style.overflow = '';
}