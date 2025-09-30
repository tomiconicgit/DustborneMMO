// file: src/engine/rendering/Camera.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

export default class Camera {
  static main = null;

  static create() {
    if (Camera.main) return;
    Camera.main = new Camera();
  }

  constructor() {
    this.worldHalfX = (WORLD_WIDTH * TILE_SIZE) / 2;
    this.worldHalfZ = (WORLD_DEPTH * TILE_SIZE) / 2;

    this.threeCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE * 2
    );

    this.target        = null;
    this.orbitAngle    = Math.PI / 3;
    this.orbitDistance = 6;

    this.minDistance = 3;
    this.maxDistance = 9;
    this.minHeight   = 3;
    this.maxHeight   = 6;

    // Follow settings
    this.followEnabled   = true;
    this.desiredAngle    = this.orbitAngle;
    this.followLerp      = 6.0;   // larger = faster catch-up
    this.userCooldown    = 0;     // seconds remaining where we won't auto-follow
    this.cooldownReset   = 2.0;   // after manual orbit/zoom

    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();

    this.setTarget({ position: new THREE.Vector3(0, 0, 0) });
  }

  setTarget(target) { this.target = target; this.update(); }
  notifyUserRotated() { this.userCooldown = this.cooldownReset; }

  _heightFromDistance() {
    const d = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const t = (d - this.minDistance) / (this.maxDistance - this.minDistance);
    return THREE.MathUtils.lerp(this.minHeight, this.maxHeight, t);
  }

  // Called each frame by Movement with dt and current character yaw (radians)
  followUpdate(dt, characterYaw, isMoving) {
    if (!this.followEnabled || !this.target) return;
    // If user recently rotated/zoomed, count down first
    if (this.userCooldown > 0) { this.userCooldown = Math.max(0, this.userCooldown - dt); return; }

    // Desired camera angle is behind the character
    const behind = characterYaw + Math.PI;
    // If user rotated and released, we still lerp back gently
    const t = Math.min(1, this.followLerp * dt);
    this.orbitAngle = lerpAngle(this.orbitAngle, behind, t);
  }

  update() {
    if (!this.target) return;

    const tp = this.target.position.clone();
    tp.x = THREE.MathUtils.clamp(tp.x, -this.worldHalfX, this.worldHalfX);
    tp.z = THREE.MathUtils.clamp(tp.z, -this.worldHalfZ, this.worldHalfZ);

    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const cameraHeight = this._heightFromDistance();

    const ideal = new THREE.Vector3(
      tp.x + this.orbitDistance * Math.sin(this.orbitAngle),
      tp.y + cameraHeight,
      tp.z + this.orbitDistance * Math.cos(this.orbitAngle)
    );

    ideal.x = THREE.MathUtils.clamp(ideal.x, -this.worldHalfX, this.worldHalfX);
    ideal.z = THREE.MathUtils.clamp(ideal.z, -this.worldHalfZ, this.worldHalfZ);

    this.threeCamera.position.copy(ideal);
    this.threeCamera.lookAt(tp.x, tp.y + 1, tp.z);
  }

  handleResize = () => {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight;
    this.threeCamera.updateProjectionMatrix();
  };
}