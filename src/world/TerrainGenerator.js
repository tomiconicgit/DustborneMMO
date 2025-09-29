// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

export default class TerrainGenerator {
    static create() {
        const geometry = new THREE.PlaneGeometry(
            WORLD_WIDTH * TILE_SIZE,
            WORLD_DEPTH * TILE_SIZE,
            WORLD_WIDTH,
            WORLD_DEPTH
        );

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 1.0 },
                gravelColor1: { value: new THREE.Color(0x555555) },
                gravelColor2: { value: new THREE.Color(0x3a3a3a) },
                gravelColor3: { value: new THREE.Color(0x4a413b) },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 gravelColor1;
                uniform vec3 gravelColor2;
                uniform vec3 gravelColor3;
                varying vec2 vUv;
                
                // Simple pseudo-random noise function
                float rand(vec2 n) { 
                    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
                }

                void main() {
                    vec2 scaledUv = vUv * vec2(${WORLD_WIDTH}.0, ${WORLD_DEPTH}.0);
                    float noise = rand(floor(scaledUv));
                    
                    vec3 color;
                    if (noise < 0.4) {
                        color = gravelColor1;
                    } else if (noise < 0.8) {
                        color = gravelColor2;
                    } else {
                        color = gravelColor3;
                    }

                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        const groundMesh = new THREE.Mesh(geometry, material);
        groundMesh.rotation.x = -Math.PI / 2; // Rotate to be flat on the XZ plane
        groundMesh.name = "ProceduralGround";
        
        return groundMesh;
    }
}
