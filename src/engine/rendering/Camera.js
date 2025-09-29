// file: src/engine/rendering/Camera.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Viewport from '../core/Viewport.js';

let cameraInstance = null;

export default class Camera {
    static main = null;
    static controls = null;

    static create() {
        if (!cameraInstance) {
            cameraInstance = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            cameraInstance.position.set(20, 25, 20);
            cameraInstance.lookAt(0, 0, 0);
            Camera.main = cameraInstance;
            
            // Wait for Viewport to exist before adding controls
            setTimeout(() => {
                if (Viewport.instance?.renderer) {
                    Camera.controls = new OrbitControls(Camera.main, Viewport.instance.renderer.domElement);
                    Camera.controls.enableDamping = true;
                }
            }, 0);
        }
    }
}
