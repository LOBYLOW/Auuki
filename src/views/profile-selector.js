
import { xf } from '../functions.js';
import { userManager } from '../models/user.js';
import { setGlobalContext } from '../storage/local-storage.js';

class ProfileSelector extends HTMLElement {
    constructor() {
        super();
        this.users = userManager.getUsers();
    }

    connectedCallback() {
        // Always ensure the selector is visible when connected
        this.style.display = 'flex';
        this.render();
        this.addEventListeners();
    }

    show() {
        this.users = userManager.getUsers();
        this.render();
        this.addEventListeners();
        this.style.display = 'flex';
    }

    addEventListeners() {
        const createBtn = this.querySelector('#create-user-btn');
        const userList = this.querySelector('#user-list');

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                const input = this.querySelector('#new-user-name');
                const name = input.value.trim();
                if (name) {
                    const newUser = userManager.createUser(name);
                    this.selectUser(newUser.id);
                }
            });
        }

        if (userList) {
            userList.addEventListener('click', (e) => {
                const item = e.target.closest('.user-item');
                if (item) {
                    const userId = item.dataset.id;
                    this.selectUser(userId);
                }
            });
        }
    }

    selectUser(userId) {
        userManager.selectUser(userId);
        setGlobalContext(() => userManager.getStoragePrefix());
        
        // Hide selector and start app
        this.style.display = 'none';
        
        // Dispatch app start
        xf.dispatch('app:start');
    }

    render() {
        const usersHtml = this.users.map(u => `
            <div class="user-item" data-id="${u.id}">
                <div class="user-avatar">${u.name.charAt(0).toUpperCase()}</div>
                <div class="user-name">${u.name}</div>
            </div>
        `).join('');

        this.innerHTML = `
            <style>
                profile-selector {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100vw;
                    height: 100vh;
                    background: var(--bg-color, #1a1a1a);
                    color: var(--fg-color, #fff);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                profile-selector .container {
                    background: var(--panel-bg, #2a2a2a);
                    padding: 40px;
                    border-radius: 8px;
                    width: 100%;
                    max-width: 500px;
                    text-align: center;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                }
                profile-selector h2 {
                    margin-bottom: 30px;
                    font-size: 2.4rem;
                    color: var(--primary-color, #00f0ff);
                }
                profile-selector .user-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 20px;
                    margin-bottom: 40px;
                    max-height: 300px;
                    overflow-y: auto;
                }
                profile-selector .user-item {
                    cursor: pointer;
                    padding: 15px;
                    border-radius: 8px;
                    transition: background 0.2s;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                profile-selector .user-item:hover {
                    background: rgba(255,255,255,0.1);
                }
                profile-selector .user-avatar {
                    width: 60px;
                    height: 60px;
                    background: var(--primary-color, #00f0ff);
                    color: #000;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.4rem;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                profile-selector .user-name {
                    font-size: 1.4rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }
                profile-selector .new-user-form {
                    border-top: 1px solid rgba(255,255,255,0.1);
                    padding-top: 20px;
                    display: flex;
                    gap: 10px;
                }
                profile-selector input {
                    flex: 1;
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid rgba(255,255,255,0.2);
                    background: rgba(0,0,0,0.2);
                    color: #fff;
                }
                profile-selector button {
                    padding: 10px 20px;
                    background: var(--primary-color, #00f0ff);
                    color: #000;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                }
                profile-selector button:hover {
                    opacity: 0.9;
                }
            </style>
            <div class="container">
                <h2>Who is riding?</h2>
                <div id="user-list" class="user-list">
                    ${usersHtml}
                </div>
                <div class="new-user-form">
                    <input type="text" id="new-user-name" placeholder="Enter name for new profile">
                    <button id="create-user-btn">Create</button>
                </div>
            </div>
        `;
    }
}

customElements.define('profile-selector', ProfileSelector);
