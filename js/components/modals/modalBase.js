// modals/modalBase.js
// Shared factory helpers used by every modal module.

export function createModal(id, className = 'modal') {
    const modal = document.createElement('div');
    modal.id = id;
    modal.style.display = 'none';
    modal.classList.add(className);
    return modal;
}

export function createModalContent() {
    const content = document.createElement('div');
    content.classList.add('modal-content');
    return content;
}

export function createButton(id, text, className = 'modal-button') {
    const button = document.createElement('button');
    button.id = id;
    button.classList.add(className);
    button.classList.add('modal-btn-secondary');
    button.innerText = text;
    return button;
}

export function createButtonGroup(...buttons) {
    const group = document.createElement('div');
    group.classList.add('modal-button-group');
    group.classList.add('modal-btn-group');
    buttons.forEach(btn => group.appendChild(btn));
    return group;
}