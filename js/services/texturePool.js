// texturePool.js
// Manages reusable canvas/texture pairs for drawing instances.
// Stateful singleton — tracks available and in-use textures.
//
// Two creation modes:
//   getOrCreate(id)  — Pooled: returns an existing texture for the given ID,
//                      or creates one and caches it for reuse. Used for
//                      persistent textures (skin mesh, base texture).
//   createFresh(id)  — Unpooled: always creates a brand new canvas/texture.
//                      Used for per-drawing-instance textures that are
//                      independently owned and disposed.

import * as THREE from 'three';

const texturePool = {
    available: [],
    inUse: new Map(),
    width: 1024,
    height: 1024,

    /**
     * Get or create a pooled texture by ID.
     * If the same ID is requested again, returns the existing entry.
     * Released textures are recycled into new IDs.
     *
     * @param {string} id     — unique key for this texture
     * @param {number} [width=1024]
     * @param {number} [height=1024]
     * @returns {{ canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, texture: THREE.CanvasTexture }}
     */
    getOrCreate(id, width = 1024, height = 1024) {
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

    /**
     * Create a brand-new, unpooled canvas/texture.
     * The caller owns the returned texture and is responsible for disposal.
     *
     * @param {string} id     — identifier attached to the returned bundle (not tracked by the pool)
     * @param {number} [width=1024]
     * @param {number} [height=1024]
     * @returns {{ id: string, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, texture: THREE.CanvasTexture }}
     */
    createFresh(id, width = 1024, height = 1024) {
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

    /**
     * Release a pooled texture back to the available pool.
     *
     * @param {string} id
     */
    releaseTexture(id) {
        if (this.inUse.has(id)) {
            const entry = this.inUse.get(id);
            this.inUse.delete(id);
            this.available.push(entry.canvas);
            entry.texture.dispose();
        }
    },

    /** Dispose all pooled textures and clear internal state. */
    disposeAll() {
        this.inUse.forEach(entry => {
            entry.texture.dispose();
        });
        this.inUse.clear();
        this.available = [];
    }
};

export default texturePool;