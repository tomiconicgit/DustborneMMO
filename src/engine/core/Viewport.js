// file: src/engine/core/Viewport.js
import * as THREE from 'three';
import Scene from './Scene.js';
import Camera from '../rendering/Camera.js';
import Debugger from '../../debugger.js';

export default class Viewport {
    static instance = null;

    static create() {
        if (!Viewport.instance) {
            Viewport.instance = new Viewport();
        }
    }

    constructor() {
        if (Viewport.instance) {
            throw new Error("Viewport is a singleton. Use Viewport.instance.");
        }

        // NOTE: We no longer store scene and camera instances here
        // to avoid race conditions. They will be fetched live in the render loop.

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Reliably create controls now that the renderer's DOM element exists
        Camera.addControls(this.renderer.domElement);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        this.isRunning = false;
    }

    beginRenderLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.renderer.setAnimationLoop(this.render.bind(this));
        Debugger.log('Render loop started.');
    }

    stopRenderLoop() {
        this.isRunning = false;
        this.renderer.setAnimationLoop(null);
    }
    
    render() {
        // CORE FIX: Fetch the latest singleton instances on every frame.
        const scene = Scene.main;
        const camera = Camera.main;

        // This check now uses the live instances.
        if (!scene || !camera) return;
        
        Debugger.update();
        Camera.controls?.update();

        // Render using the live instances.
        this.renderer.render(scene, camera);
    }

    onWindowResize() {
        const camera = Camera.main; // Use the live instance here too
        if (camera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
