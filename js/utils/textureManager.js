// textureManager.js

const texturePool = {
    available: [],
    inUse: new Map(),
    width: 1024,
    height: 1024,

    getTexture(id, width = 1024, height = 1024) {
        // If this ID already has a texture, return it
        if (this.inUse.has(id)) {
            return this.inUse.get(id);
        }

        let entry;

        // Try to reuse an available texture
        if (this.available.length > 0) {
            const canvas = this.available.pop();
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            entry = {
                canvas,
                context: ctx,
                texture: new THREE.CanvasTexture(canvas)
            };
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            entry = {
                canvas,
                context: ctx,
                texture: new THREE.CanvasTexture(canvas)
            };
        }

        this.inUse.set(id, entry);
        return entry;
    },

    getNewTexture(id, width = 1024, height = 1024) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        return {
            id,
            canvas,
            context,
            texture: new THREE.CanvasTexture(canvas)
        };
    },

    releaseTexture(id) {
        if (this.inUse.has(id)) {
            const entry = this.inUse.get(id);
            this.inUse.delete(id);
            this.available.push(entry.canvas);
            entry.texture.dispose();
        }
    },

    disposeAll() {
        this.inUse.forEach(entry => {
            entry.texture.dispose();
        });
        this.inUse.clear();
        this.available = [];
    }
};

export default texturePool;
