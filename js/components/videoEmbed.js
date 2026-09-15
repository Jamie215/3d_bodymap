// videoEmbed.js
// Self-contained tutorial video embed: a thumbnail (poster + play button) in
// the summary/help views that opens a fullscreen overlay with a native,
// self-hosted <video>.  The clips are served same-origin from
// `assets/video/…`, so the participant's browser never contacts a third party
// (no YouTube / Google request).  Nothing is fetched until the participant
// actively clicks to play (`preload="none"`).

// ============================================================================
// MODULE STATE
// ============================================================================

let videoOverlay = null;   // Created once, reused across updateSummaryStatus calls

// ============================================================================
// INTERNAL — SANITISE VIDEO SOURCE
// ============================================================================

/**
 * Sanitise a video source path. Sources are same-origin relative paths to
 * local assets (e.g. "assets/video/clip.mp4"). Reject absolute URLs, protocol
 * prefixes, protocol-relative URLs, and parent-directory traversal so a bad
 * value can never point the player at an off-origin host.
 *
 * @param {string} src
 * @returns {string} sanitised relative path, or empty string if invalid
 */
function sanitiseVideoSrc(src) {
    if (typeof src !== 'string') return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return '';  // http:, https:, data:, javascript:, …
    if (src.startsWith('//')) return '';               // protocol-relative //host/…
    if (src.includes('..')) return '';                 // directory traversal
    return src.replace(/[^a-zA-Z0-9_\-./]/g, '');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a video embed element with thumbnail and fullscreen overlay.
 *
 * @param {string} videoSrc  — same-origin path to the local video file
 * @param {string} titleText — heading shown above the thumbnail (null to omit)
 * @returns {HTMLElement}     — container ready to append into the DOM
 */
export function createVideoEmbed(videoSrc = 'assets/video/2LGwMr0mNc4.mp4', titleText = 'Pain & Symptom Assessment Form') {
    const safeSrc = sanitiseVideoSrc(videoSrc);

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

    // Self-contained poster — no remote thumbnail is fetched. Combined with the
    // overlay's preload="none", the browser makes no request for the video
    // until the participant clicks to play.
    const poster = document.createElement('div');
    poster.className = 'video-thumbnail-poster';

    const playBtn = document.createElement('div');
    playBtn.className = 'video-play-btn';
    const playIcon = document.createElement('i');
    playIcon.className = 'fa-solid fa-play';
    playBtn.appendChild(playIcon);

    thumbnail.append(poster, playBtn);

    if (titleText) container.append(title, thumbnail);
    else container.append(thumbnail);

    ensureOverlay();

    // Open overlay on thumbnail click
    thumbnail.addEventListener('click', () => openOverlay(safeSrc));

    return container;
}

/**
 * Create a hyperlink that opens the video overlay when clicked.
 * Reuses the same overlay as createVideoEmbed.
 *
 * @param {string} videoSrc — same-origin path to the local video file
 * @param {string} linkText — link label text (HTML)
 * @returns {HTMLAnchorElement}
 */
export function createVideoLink(videoSrc = 'assets/video/2LGwMr0mNc4.mp4', linkText = '<i class="fa-solid fa-circle-play">&emsp;</i>How do I use this form?') {
    const safeSrc = sanitiseVideoSrc(videoSrc);

    const link = document.createElement('a');
    link.className = 'summary-video-link';
    link.href = '#';
    link.innerHTML = linkText;

    ensureOverlay();

    link.addEventListener('click', (e) => {
        e.preventDefault();
        openOverlay(safeSrc);
    });

    return link;
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

    // Content wrapper + native video
    const content = document.createElement('div');
    content.className = 'video-overlay-content';

    const video = document.createElement('video');
    video.id = 'summary-video';
    video.className = 'summary-video';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'none';   // no bytes fetched until the participant plays
    video.setAttribute('controlsList', 'nodownload');

    content.appendChild(video);
    videoOverlay.append(closeBtn, content);

    closeBtn.addEventListener('click', closeOverlay);
    videoOverlay.addEventListener('click', (e) => {
        if (e.target === videoOverlay) closeOverlay();
    });

    document.body.appendChild(videoOverlay);
}

function openOverlay(videoSrc) {
    const video = videoOverlay.querySelector('#summary-video');
    const safeSrc = sanitiseVideoSrc(videoSrc);

    if (safeSrc) {
        video.src = safeSrc;
        // The click that opened the overlay is a user gesture, so play() is
        // permitted; if the browser still blocks it the controls remain.
        video.play().catch(() => {});
    }

    videoOverlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';
}

function closeOverlay() {
    const video = videoOverlay.querySelector('#summary-video');
    // Stop playback and release the source so buffering halts.
    video.pause();
    video.removeAttribute('src');
    video.load();
    videoOverlay.classList.remove('is-active');
    document.body.style.overflow = '';
}
