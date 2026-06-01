// rotatePrompt.js
// Full-screen overlay shown when the device is held in landscape on
// a phone-sized viewport. The app interaction is not optimal for this condition, so we block interaction until the user rotates back.
//
// Visibility is driven entirely by a CSS media query — see the
// "Rotate Device Prompt" block in components.css. No JS toggling
// is needed; orientation changes are handled by the browser
// re-evaluating the media query.
//
// The prompt sits above onboarding (z-index 2000) and help (2001)
// using --z-rotate-prompt (3000), so it correctly shadows any modal
// that might be open when the user rotates.

export function initRotatePrompt(container) {
    const overlay = document.createElement('div');
    overlay.className = 'rotate-prompt';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-labelledby', 'rotate-prompt-title');
    overlay.setAttribute('aria-live', 'polite');

    const content = document.createElement('div');
    content.className = 'rotate-prompt-content';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'rotate-prompt-icon';
    iconWrapper.setAttribute('aria-hidden', 'true');
    iconWrapper.innerHTML = '<i class="fa-solid fa-mobile-screen"></i>';

    const title = document.createElement('h2');
    title.id = 'rotate-prompt-title';
    title.className = 'rotate-prompt-title';
    title.textContent = 'Please rotate your device';

    const subtitle = document.createElement('p');
    subtitle.className = 'rotate-prompt-subtitle';
    subtitle.textContent = 'This form works best in portrait orientation. Please rotate your device upright to continue.';

    content.append(iconWrapper, title, subtitle);
    overlay.appendChild(content);
    container.appendChild(overlay);
}