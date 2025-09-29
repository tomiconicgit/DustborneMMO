// file: src/engine/rendering/Camera.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
        }
    }

    /**
     * A new, reliable method to add controls after the viewport exists.
     * @param {HTMLElement} domElement The canvas element from the renderer.
     */
    static addControls(domElement) {
        if (Camera.main && domElement) {
            Camera.controls = new OrbitControls(Camera.main, domElement);
            Camera.controls.enableDamping = true;
        }
    }
}
