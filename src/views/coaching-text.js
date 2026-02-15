import { xf } from '../functions.js';

class CoachingText extends HTMLElement {
    constructor() {
        super();
        this.text = '';
        this.fadeTimer = null;
    }

    connectedCallback() {
        this.abortController = new AbortController();
        const signal = { signal: this.abortController.signal };
        
        xf.sub('db:coachingText', this.onCoachingText.bind(this), signal);
        
        this.render();
    }

    disconnectedCallback() {
        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
        }
    }

    onCoachingText(text) {
        this.text = text || '';
        this.render();
        
        // Clear timer if exists
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
        }
        
        // Auto-hide after 10 seconds if there's text
        if (this.text) {
            this.fadeTimer = setTimeout(() => {
                this.classList.add('fade-out');
                setTimeout(() => {
                    this.text = '';
                    this.classList.remove('fade-out');
                    this.render();
                }, 500);
            }, 10000);
        }
    }

    render() {
        if (!this.text) {
            this.innerHTML = '';
            this.style.display = 'none';
            return;
        }
        
        this.style.display = 'flex';
        this.innerHTML = `
            <div class="coaching-text-container">
                <div class="coaching-text-icon">💬</div>
                <div class="coaching-text-message">${this.escapeHtml(this.text)}</div>
            </div>
            <style>
                coaching-text {
                    position: fixed;
                    bottom: 120px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 1000;
                    transition: opacity 0.5s ease;
                }
                
                coaching-text.fade-out {
                    opacity: 0;
                }
                
                .coaching-text-container {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid #00bfff;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 191, 255, 0.3);
                    max-width: 80vw;
                    animation: slide-up 0.3s ease-out;
                }
                
                .coaching-text-icon {
                    font-size: 1.2em;
                }
                
                .coaching-text-message {
                    color: #fff;
                    font-size: 1em;
                    font-weight: 500;
                    line-height: 1.4;
                    text-align: center;
                }
                
                @keyframes slide-up {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                
                @media (max-width: 600px) {
                    coaching-text {
                        bottom: 100px;
                    }
                    .coaching-text-container {
                        padding: 10px 16px;
                    }
                    .coaching-text-message {
                        font-size: 0.9em;
                    }
                }
            </style>
        `;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

customElements.define('coaching-text', CoachingText);
