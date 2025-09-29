// file: src/engine/audio/SoundManager.js
export default class SoundManager {
    static main = null;

    static create() {
        if (!SoundManager.main) {
            SoundManager.main = new SoundManager();
        }
    }

    constructor() {
        // Audio functionality will be added here later.
    }
    
    playSound(key) {
        // console.log(`Attempted to play sound: ${key}`);
    }
}
