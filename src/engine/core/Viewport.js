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

        this.scene = Scene.main;
        this.camera = Camera.main;

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

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
        if (!this.scene || !this.camera) return;
        
        Debugger.update(); // Update FPS counter
        Camera.controls?.update(); // Update camera controls if they exist

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
