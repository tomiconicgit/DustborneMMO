// file: src/engine/rendering/Sky.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';

export default class Sky {
    static create() {
        const scene = Scene.main;
        if (!scene) {
            console.error("Scene not initialized before Sky.");
            return;
        }
        
        scene.background = new THREE.Color(0x10151a);
        scene.fog = new THREE.Fog(scene.background, 100, 200);
    }
}
