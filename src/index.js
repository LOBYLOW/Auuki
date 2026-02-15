import { xf } from './functions.js';
import './db.js';
import './views/views.js';
import './views/workout-creator.js';
import './ble/devices.js';
import './watch.js';
import './course.js';
import './lock.js';
import { userManager } from './models/user.js';
import { setGlobalContext } from './storage/local-storage.js';

function startServiceWorker() {
    if('serviceWorker' in navigator) {
        try {
            // const reg = navigator.serviceWorker.register('./sw.js');

            const reg = navigator.serviceWorker.register(
                new URL('./sw.js', import.meta.url),
                {type: 'module'}
            );

            console.log(`SW: register success.`);
            console.log('Cache Version: Flux-v003');
        } catch(err) {
            console.log(`SW: register error: `, err);
        }
    };
}

function start() {
    console.log('start app.');

    setGlobalContext(() => userManager.getStoragePrefix());

    const users = userManager.getUsers();
    
    // If we have no users, we MUST show the profile selector (or auto-create one?)
    // If we have users, we should probably show the selector.
    // Let's decide: ALWAYS show profile selector on startup.
    
    // Remove any existing profile selector (e.g., from HMR)
    const existing = document.querySelector('profile-selector');
    if (existing) {
        existing.remove();
    }
    
    // Inject Profile Selector
    const selector = document.createElement('profile-selector');
    document.body.appendChild(selector);
    
    // Check for test mode
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.has('test');

    if (isTestMode) {
        console.warn('RUNNING IN TEST MODE');
        import('./simulation.js').then(() => {
            console.log('Simulation active');
            // Set speed x10
            setTimeout(() => {
                xf.dispatch('ui:configure', { speed: 10 });
                xf.dispatch('ui:watchStart'); // Auto-start in test mode
            }, 500);
        }).catch(err => console.error('Failed to load simulation', err));
    }
    
    // startServiceWorker(); // stable version only
    // xf.dispatch('app:start'); // REMOVED: Managed by profile-selector
}

function stop() {
    xf.dispatch('app:stop');
}

start();

export {
    start,
    stop,
};


document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('#open-creator-btn');
    if(btn) {
        btn.addEventListener('click', () => {
             xf.dispatch('ui:open-workout-creator');
        });
    }
});

