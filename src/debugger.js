// file: src/debugger.js
import Stats from 'three/addons/libs/stats.module.js';

let stats;

export default class Debugger {
    static init() {
        stats = new Stats();
        document.body.appendChild(stats.dom);
    }
    
    static update() {
        stats?.update();
    }

    static log(message, ...optionalParams) {
        console.log(`[INFO] ${message}`, ...optionalParams);
    }

    static warn(message, ...optionalParams) {
        console.warn(`[WARN] ${message}`, ...optionalParams);
    }

    static error(message, ...optionalParams) {
        console.error(`[ERROR] ${message}`, ...optionalParams);
    }
}
