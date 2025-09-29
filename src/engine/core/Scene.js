// file: src/engine/core/Scene.js
import * as THREE from 'three';

let sceneInstance = null;

export default class Scene {
    static main = null;

    static create() {
        if (!sceneInstance) {
            sceneInstance = new THREE.Scene();
            Scene.main = sceneInstance;
        }
        return sceneInstance;
    }
}
