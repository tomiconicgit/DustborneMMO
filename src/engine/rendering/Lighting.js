// file: src/engine/rendering/Lighting.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';

export default class Lighting {
    static create() {
        const scene = Scene.main;
        if (!scene) {
            console.error("Scene not initialized before Lighting.");
            return;
        }

        const hemiLight = new THREE.HemisphereLight(0xB1E1FF, 0xB97A20, 0.8);
        scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(50, 50, 50);
        scene.add(dirLight);
    }
}
