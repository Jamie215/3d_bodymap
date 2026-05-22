// modals/onboardingModal.js
// First-visit onboarding overlay with step-by-step instructions.
// Shows once per browser session (sessionStorage), not once forever.

let onboardingModalEl = null;
let onboardingModalOverlay = null;
let onboardingStartButton = null;
let onOnboardingCompleteCallback = null;

const ONBOARDING_SHOWN_KEY = 'painSurvey_onboardingShown';

export function initOnboardingModal(container) {
    onboardingModalOverlay = document.createElement('div');
    onboardingModalOverlay.className = 'onboarding-modal-overlay modal-overlay';
    onboardingModalOverlay.style.display = 'none';

    onboardingModalEl = document.createElement('div');
    onboardingModalEl.className = 'onboarding-modal modal-container';
    onboardingModalEl.id = 'onboarding-modal';

    onboardingModalEl.innerHTML = `
        <div class="onboarding-modal-content modal-body">
            <h2 class="onboarding-modal-title modal-title">Steps to Complete Form</h2>
            <p class="onboarding-modal-subtitle modal-subtitle">Complete these steps for one area of pain or symptom at a time. If you have multiple areas, you will repeat the steps for each one.</p>
            
            <div class="onboarding-steps">
                <div class="onboarding-step">
                    <div class="onboarding-step-icon">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div class="onboarding-step-content">
                        <span class="onboarding-step-number">1</span>
                        <p class="onboarding-step-text">Locate where you experience your pain or symptom</p>
                    </div>
                </div>
                
                <div class="onboarding-step">
                    <div class="onboarding-step-icon">
                        <i class="fa-solid fa-paintbrush"></i>
                    </div>
                    <div class="onboarding-step-content">
                        <span class="onboarding-step-number">2</span>
                        <p class="onboarding-step-text">Draw <strong>one</strong> area of pain or symptom on the body</p>
                    </div>
                </div>
                
                <div class="onboarding-step">
                    <div class="onboarding-step-icon">
                        <i class="fa-solid fa-clipboard-list"></i>
                    </div>
                    <div class="onboarding-step-content">
                        <span class="onboarding-step-number">3</span>
                        <p class="onboarding-step-text">Answer the questionnaire</p>
                    </div>
                </div>
            </div>
            
            <button id="onboarding-start-btn" class="onboarding-start-btn modal-btn-primary">
                Get Started
            </button>
        </div>
    `;

    onboardingModalOverlay.appendChild(onboardingModalEl);
    container.appendChild(onboardingModalOverlay);

    onboardingStartButton = onboardingModalEl.querySelector('#onboarding-start-btn');

    onboardingStartButton.addEventListener('click', () => {
        hideOnboardingModal();
        try {
            sessionStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
        } catch (e) {
            console.warn('Could not save onboarding state to sessionStorage:', e);
        }
        if (onOnboardingCompleteCallback) {
            onOnboardingCompleteCallback();
        }
    });
}

export function showOnboardingModal() {
    if (!onboardingModalOverlay) {
        console.warn('Onboarding modal not initialized. Call initOnboardingModal first.');
        return;
    }

    onboardingModalOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
        onboardingModalOverlay.classList.add('visible');
    });
}

export function hideOnboardingModal() {
    if (!onboardingModalOverlay) return;

    onboardingModalOverlay.classList.remove('visible');
    setTimeout(() => {
        onboardingModalOverlay.style.display = 'none';
    }, 300);
}

/**
 * Check whether onboarding has already been shown this session.
 * Uses sessionStorage so the modal reappears on page refresh (Ctrl+R)
 * but not on tab-internal navigation.
 *
 * @returns {boolean}
 */
export function hasOnboardingBeenShown() {
    try {
        return sessionStorage.getItem(ONBOARDING_SHOWN_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

export function setOnOnboardingComplete(callback) {
    onOnboardingCompleteCallback = callback;
}

export function getOnboardingElements() {
    return { onboardingStartButton };
}