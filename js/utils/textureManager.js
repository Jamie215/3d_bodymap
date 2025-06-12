// textureManager.js

const texturePool = {
    available: [],
    inUse: new Map(),
    
    getTexture(id, width = 1024, height = 1024) {
        // If this ID already has a texture, return it
        if (this.inUse.has(id)) {
            return this.inUse.get(id);
        }
        
        let texture;
        
        // Try to reuse an available texture
        if (this.available.length > 0) {
            const canvas = this.available.pop();
            // Clear the canvas
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            texture = {
                canvas,
                context: ctx,
                threeTexture: new THREE.CanvasTexture(canvas)
            };
        } else {
            // Create a new texture if none available
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            texture = {
                canvas,
                context: ctx,
                threeTexture: new THREE.CanvasTexture(canvas)
            };
        }
        
        // Mark this texture as in use
        this.inUse.set(id, texture);
        return texture;
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
            const texture = this.inUse.get(id);
            this.inUse.delete(id);
            this.available.push(texture.canvas);
            // Dispose the Three.js texture
            texture.threeTexture.dispose();
        }
    },
    
    // Call this when cleaning up the application
    disposeAll() {
        this.inUse.forEach(texture => {
            texture.threeTexture.dispose();
        });
        this.inUse.clear();
        this.available = [];
    }
};

export default texturePool;