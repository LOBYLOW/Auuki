
import { userManager } from '../models/user.js';
import { xf } from '../functions.js';

class UserBadge extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        // Subscribe to app start to update user info
        this.render();
        xf.sub('app:start', () => {
             this.user = userManager.currentUser;
             this.render();
        });
        
        this.addEventListener('click', () => {
             // Show profile selector again
             const selector = document.querySelector('profile-selector');
             if (selector) {
                if (typeof selector.show === 'function') {
                    selector.show();
                } else {
                    selector.style.display = 'flex';
                }
             } else {
                 if(confirm('Switch user? This will reload the application.')) {
                     window.location.reload();
                 }
             }
        });
    }

    render() {
        this.user = userManager.currentUser;
        
        if (!this.user) {
            this.style.display = 'none';
            return;
        }
        this.style.display = 'flex'; 

        const initial = this.user.name.charAt(0).toUpperCase();

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    padding: 8px 12px;
                    border-radius: 20px;
                    transition: background 0.2s;
                    margin: 0px 10px 10px 0;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid transparent;
                    min-height: 40px;
                    color: white;
                    z-index: 9999;
                    position: relative;
                }
                :host(:hover) {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.2);
                }
                .avatar {
                    width: 36px;
                    height: 36px;
                    background: var(--primary-color, #00f0ff);
                    color: #000;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 1.4rem;
                    flex-shrink: 0;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
                .name {
                    font-size: 1.2rem;
                    color: #fff;
                    font-weight: 500;
                    display: block;
                    margin-left: 10px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 120px;
                }
            </style>
            <div class="avatar" title="Current User: ${this.user.name}">${initial}</div>
            <div class="name">${this.user.name}</div>
        `;
    }
}

customElements.define('user-badge', UserBadge);
