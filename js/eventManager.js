// eventManager.js
const eventManager = {
    listeners: new Map(),
    
    add(element, eventType, handler, options) {
        if (!element) {
            console.warn('Attempted to add event listener to null element');
            return null;
        }
        
        const id = this.generateId(element, eventType, handler);
        element.addEventListener(eventType, handler, options);
        this.listeners.set(id, { element, eventType, handler });
        return id;
    },
    
    generateId(element, eventType, handler) {
        // Create a unique ID based on the element, event type, and a random number
        const elementId = element.id || 'anonymous';
        return `${elementId}-${eventType}-${Math.random().toString(36).substring(2, 9)}`;
    },
    
    remove(id) {
        if (this.listeners.has(id)) {
            const { element, eventType, handler } = this.listeners.get(id);
            element.removeEventListener(eventType, handler);
            this.listeners.delete(id);
            return true;
        }
        return false;
    },
    
    removeAll() {
        this.listeners.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this.listeners.clear();
    },
    
    removeAllForElement(element) {
        this.listeners.forEach((listener, id) => {
            if (listener.element === element) {
                element.removeEventListener(listener.eventType, listener.handler);
                this.listeners.delete(id);
            }
        });
    }
};

export default eventManager;