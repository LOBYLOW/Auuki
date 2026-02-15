/**
 * Visual Drag-and-Drop Workout Builder
 * 
 * A web component that provides visual drag-and-drop workout editing
 * with SVG-based timeline, handlebar interactions, and live metrics.
 * 
 * Usage: <workout-builder></workout-builder>
 */

import { xf, exists, clamp } from '../functions.js';
import { formatTime } from '../utils.js';
import { models } from '../models/models.js';
import { uuid } from '../storage/uuid.js';

// ============================================================================
// Configuration & Constants
// ============================================================================

const CONFIG = {
    SNAP: {
        DURATION: 15,        // seconds
        POWER: 0.05,         // 5% FTP
        ENABLED: true
    },
    DISPLAY: {
        MAX_POWER: 2.0,      // 200% FTP
        MIN_DURATION: 15,    // seconds
        MIN_POWER: 0.20      // 20% FTP
    },
    PADDING: {
        top: 30,
        right: 20,
        bottom: 50,
        left: 45
    },
    COLORS: {
        zone1: '#808080',  // Recovery
        zone2: '#0088ff',  // Endurance
        zone3: '#00cc44',  // Tempo
        zone4: '#ffcc00',  // Threshold
        zone5: '#ff6600',  // VO2max
        zone6: '#ff0000'   // Anaerobic
    }
};

// ============================================================================
// Helper Functions
// ============================================================================

function getZoneColor(power) {
    if (power < 0.55) return CONFIG.COLORS.zone1;
    if (power < 0.75) return CONFIG.COLORS.zone2;
    if (power < 0.90) return CONFIG.COLORS.zone3;
    if (power < 1.05) return CONFIG.COLORS.zone4;
    if (power < 1.20) return CONFIG.COLORS.zone5;
    return CONFIG.COLORS.zone6;
}

function getZoneClass(power) {
    if (power < 0.55) return 'zone-1';
    if (power < 0.75) return 'zone-2';
    if (power < 0.90) return 'zone-3';
    if (power < 1.05) return 'zone-4';
    if (power < 1.20) return 'zone-5';
    return 'zone-6';
}

function snapValue(value, increment, enabled = CONFIG.SNAP.ENABLED) {
    if (!enabled) return value;
    return Math.round(value / increment) * increment;
}

/**
 * Calculate TSS for a single block
 * TSS = (duration × power²) / 36
 */
function calculateBlockTSS(duration, power) {
    return (duration * power * power) / 36;
}

/**
 * Calculate full workout metrics
 */
function calculateWorkoutMetrics(blocks, ftp) {
    let totalDuration = 0;
    let weightedPowerSum = 0;
    let tssSum = 0;

    const processBlock = (block, multiplier = 1) => {
        const duration = block.duration * multiplier;
        let effectivePower = block.power;

        // For ramps, use average power
        if (block.type === 'warmup' || block.type === 'cooldown') {
            effectivePower = (block.power + (block.powerEnd || block.power)) / 2;
        } else if (block.type === 'freeride') {
            effectivePower = 0.5; // Estimate
        }

        totalDuration += duration;
        weightedPowerSum += effectivePower * effectivePower * duration;
        tssSum += calculateBlockTSS(duration, effectivePower);
    };

    blocks.forEach(item => {
        if (item.type === 'repeat') {
            item.blocks.forEach(block => processBlock(block, item.repeat));
        } else {
            processBlock(item);
        }
    });

    // Normalized Power (simplified)
    const normalizedPower = totalDuration > 0
        ? Math.sqrt(weightedPowerSum / totalDuration) * ftp
        : 0;

    // Intensity Factor
    const intensityFactor = ftp > 0 ? normalizedPower / ftp : 0;

    return {
        duration: totalDuration,
        tss: Math.round(tssSum),
        intensityFactor: Math.round(intensityFactor * 100) / 100,
        normalizedPower: Math.round(normalizedPower)
    };
}

// ============================================================================
// Block Model
// ============================================================================

function createBlock(type = 'steady', overrides = {}) {
    const defaults = {
        id: uuid(),
        type,
        duration: 300,  // 5 minutes
        power: type === 'warmup' ? 0.50 : type === 'cooldown' ? 0.50 : 0.75,
        powerEnd: type === 'warmup' ? 0.75 : type === 'cooldown' ? 0.35 : undefined,
        cadence: undefined,
        slope: undefined
    };
    return { ...defaults, ...overrides };
}

function createRepeatGroup(blocks = [], repeat = 4) {
    return {
        id: uuid(),
        type: 'repeat',
        repeat,
        blocks: blocks.map(b => ({ ...b, id: uuid() }))
    };
}

// ============================================================================
// History Manager (Undo/Redo)
// ============================================================================

function createHistoryManager(maxSize = 50) {
    const history = [];
    let currentIndex = -1;

    return {
        push(state) {
            // Remove any redo states
            history.splice(currentIndex + 1);
            history.push(JSON.parse(JSON.stringify(state)));
            if (history.length > maxSize) history.shift();
            currentIndex = history.length - 1;
        },
        undo() {
            if (currentIndex > 0) {
                currentIndex--;
                return JSON.parse(JSON.stringify(history[currentIndex]));
            }
            return null;
        },
        redo() {
            if (currentIndex < history.length - 1) {
                currentIndex++;
                return JSON.parse(JSON.stringify(history[currentIndex]));
            }
            return null;
        },
        canUndo: () => currentIndex > 0,
        canRedo: () => currentIndex < history.length - 1
    };
}

// ============================================================================
// SVG Renderer
// ============================================================================

function createSVGRenderer(container, options = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'workout-builder-svg');
    svg.style.cssText = 'display: block; width: 100%; height: 100%; user-select: none;';

    let dimensions = { width: 800, height: 300 };
    let blocks = [];
    let selectedId = null;
    let ftp = 200;
    let onBlockUpdate = () => {};
    let onBlockSelect = () => {};

    function setDimensions(w, h) {
        dimensions = { width: w, height: h };
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    function setBlocks(newBlocks) {
        blocks = newBlocks;
    }

    function setFTP(value) {
        ftp = value;
    }

    function setSelectedId(id) {
        selectedId = id;
    }

    function render() {
        const { width, height } = dimensions;
        const { top, right, bottom, left } = CONFIG.PADDING;
        
        const chartWidth = width - left - right;
        const chartHeight = height - top - bottom;
        
        // Calculate total duration
        const totalDuration = blocks.reduce((sum, b) => {
            if (b.type === 'repeat') {
                return sum + b.blocks.reduce((s, bl) => s + bl.duration, 0) * b.repeat;
            }
            return sum + b.duration;
        }, 0) || 600; // Min 10 minutes display

        const pixelsPerSecond = chartWidth / totalDuration;
        const pixelsPerPower = chartHeight / CONFIG.DISPLAY.MAX_POWER;

        // Clear SVG
        svg.innerHTML = '';

        // Background grid
        svg.innerHTML += renderGrid(width, height, chartWidth, chartHeight, left, top);

        // FTP reference line
        const ftpY = top + chartHeight - (1.0 * pixelsPerPower);
        svg.innerHTML += `
            <line x1="${left}" y1="${ftpY}" x2="${width - right}" y2="${ftpY}" 
                  stroke="#fff" stroke-width="1" stroke-dasharray="5,5" opacity="0.5"/>
            <text x="${width - right + 5}" y="${ftpY + 4}" fill="#888" font-size="10">FTP</text>
        `;

        // Render blocks
        let currentX = left;
        blocks.forEach((block, index) => {
            if (block.type === 'repeat') {
                // Repeat group
                svg.innerHTML += renderRepeatGroup(
                    block, currentX, top, chartHeight, 
                    pixelsPerSecond, pixelsPerPower, selectedId
                );
                const groupDuration = block.blocks.reduce((s, b) => s + b.duration, 0);
                currentX += groupDuration * pixelsPerSecond;
            } else {
                // Single block
                svg.innerHTML += renderBlock(
                    block, currentX, top, chartHeight,
                    pixelsPerSecond, pixelsPerPower, selectedId === block.id
                );
                currentX += block.duration * pixelsPerSecond;
            }
        });

        // Time axis labels
        svg.innerHTML += renderTimeAxis(width, height, totalDuration, left, right, chartWidth);

        // Re-attach to container
        if (!svg.parentNode) {
            container.appendChild(svg);
        }
    }

    function renderGrid(width, height, chartWidth, chartHeight, left, top) {
        let grid = '';
        const powerLevels = [0.5, 0.75, 1.0, 1.25, 1.5];
        
        powerLevels.forEach(power => {
            const y = top + chartHeight - (power / CONFIG.DISPLAY.MAX_POWER * chartHeight);
            grid += `
                <line x1="${left}" y1="${y}" x2="${width - CONFIG.PADDING.right}" y2="${y}" 
                      stroke="#333" stroke-dasharray="3,3"/>
                <text x="${left - 5}" y="${y + 4}" fill="#666" font-size="10" text-anchor="end">
                    ${Math.round(power * 100)}%
                </text>
            `;
        });
        
        return grid;
    }

    function renderBlock(block, x, top, chartHeight, pxPerSec, pxPerPower, isSelected) {
        const width = block.duration * pxPerSec;
        const height = block.power * pxPerPower;
        const y = top + chartHeight - height;
        const color = getZoneColor(block.power);
        const handleSize = 8;

        return `
            <g class="workout-block" data-block-id="${block.id}">
                <!-- Main block -->
                <rect x="${x}" y="${y}" width="${width}" height="${height}" 
                      fill="${color}" stroke="${isSelected ? '#00bfff' : 'none'}" 
                      stroke-width="${isSelected ? 2 : 0}"
                      class="block-rect" data-handle="move"/>
                
                <!-- Right handle (duration) -->
                <rect x="${x + width - handleSize/2}" y="${y}" 
                      width="${handleSize}" height="${height}"
                      fill="rgba(255,255,255,0.01)" class="handle-right" 
                      data-handle="right" style="cursor: ew-resize;"/>
                
                <!-- Top handle (power) -->
                <rect x="${x}" y="${y - handleSize/2}" 
                      width="${width}" height="${handleSize}"
                      fill="rgba(255,255,255,0.01)" class="handle-top" 
                      data-handle="top" style="cursor: ns-resize;"/>
                
                <!-- Power label -->
                <text x="${x + width/2}" y="${y + height/2 + 4}" 
                      fill="white" font-size="11" font-weight="bold" 
                      text-anchor="middle" pointer-events="none"
                      style="text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                    ${Math.round(block.power * 100)}%
                </text>
                
                <!-- Duration label -->
                <text x="${x + width/2}" y="${top + chartHeight + 15}" 
                      fill="#888" font-size="9" text-anchor="middle" pointer-events="none">
                    ${formatTime({ value: block.duration, format: 'mm:ss' })}
                </text>
            </g>
        `;
    }

    function renderRepeatGroup(group, startX, top, chartHeight, pxPerSec, pxPerPower, selectedId) {
        let html = '';
        let currentX = startX;
        const groupWidth = group.blocks.reduce((s, b) => s + b.duration, 0) * pxPerSec;

        // Container bracket
        html += `
            <rect x="${startX - 3}" y="${top - 5}" 
                  width="${groupWidth + 6}" height="${chartHeight + 15}"
                  fill="none" stroke="#666" stroke-width="1" stroke-dasharray="4,4" rx="4"/>
            <rect x="${startX + groupWidth/2 - 15}" y="${top + chartHeight + 20}" 
                  width="30" height="18" rx="9" fill="#444"/>
            <text x="${startX + groupWidth/2}" y="${top + chartHeight + 33}" 
                  fill="white" font-size="10" text-anchor="middle">×${group.repeat}</text>
        `;

        // Render child blocks
        group.blocks.forEach(block => {
            html += renderBlock(
                block, currentX, top, chartHeight,
                pxPerSec, pxPerPower, selectedId === block.id
            );
            currentX += block.duration * pxPerSec;
        });

        return html;
    }

    function renderTimeAxis(width, height, totalDuration, left, right, chartWidth) {
        let axis = '';
        const numTicks = Math.min(8, Math.floor(totalDuration / 60));
        const tickInterval = Math.ceil(totalDuration / numTicks / 60) * 60;

        for (let t = 0; t <= totalDuration; t += tickInterval) {
            const x = left + (t / totalDuration) * chartWidth;
            axis += `
                <text x="${x}" y="${height - 5}" fill="#666" font-size="9" text-anchor="middle">
                    ${formatTime({ value: t, format: 'mm:ss' })}
                </text>
            `;
        }

        return axis;
    }

    // Public API
    return {
        svg,
        setDimensions,
        setBlocks,
        setFTP,
        setSelectedId,
        render,
        onBlockUpdate: (cb) => { onBlockUpdate = cb; },
        onBlockSelect: (cb) => { onBlockSelect = cb; }
    };
}

// ============================================================================
// WorkoutBuilder Web Component
// ============================================================================

class WorkoutBuilder extends HTMLElement {
    constructor() {
        super();
        
        this.blocks = [];
        this.selectedId = null;
        this.ftp = 200;
        this.dragState = null;
        this.history = createHistoryManager();
        this.renderer = null;
        this.abortController = null;
    }

    connectedCallback() {
        this.abortController = new AbortController();
        const signal = { signal: this.abortController.signal };

        // Initial render
        this.innerHTML = this.template();
        
        // Setup renderer
        const canvas = this.querySelector('.workout-canvas');
        this.renderer = createSVGRenderer(canvas);
        
        // Setup event listeners
        this.setupEventListeners(signal);
        
        // Subscribe to external events
        xf.sub('db:ftp', this.onFTPChange.bind(this), signal);
        xf.sub('db:workout', this.onWorkoutLoad.bind(this), signal);

        // Initial sizing
        this.updateDimensions();
        
        // Add default blocks for demo
        this.addBlock('warmup');
        this.addBlock('steady');
        this.addBlock('steady');
        this.addBlock('cooldown');
        
        this.saveHistory();
        this.render();
    }

    disconnectedCallback() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    template() {
        return `
            <style>
                .workout-builder {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--bg-dark, #1a1a2e);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .workout-toolbar {
                    display: flex;
                    gap: 8px;
                    padding: 12px;
                    background: var(--bg-darker, #141428);
                    border-bottom: 1px solid var(--border-color, #333);
                    flex-wrap: wrap;
                    align-items: center;
                }
                .workout-toolbar button {
                    padding: 6px 12px;
                    border: 1px solid var(--border-color, #444);
                    border-radius: 4px;
                    background: var(--bg-button, #2a2a4a);
                    color: var(--text-color, #fff);
                    cursor: pointer;
                    font-size: 12px;
                    transition: background 0.15s;
                }
                .workout-toolbar button:hover {
                    background: var(--bg-button-hover, #3a3a5a);
                }
                .workout-toolbar button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .workout-metrics {
                    display: flex;
                    gap: 16px;
                    margin-left: auto;
                    font-size: 12px;
                    color: var(--text-muted, #888);
                }
                .workout-metrics .metric {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .workout-metrics .metric-value {
                    font-size: 16px;
                    font-weight: bold;
                    color: var(--text-color, #fff);
                }
                .workout-canvas {
                    flex: 1;
                    min-height: 250px;
                    position: relative;
                }
                .workout-properties {
                    padding: 12px;
                    background: var(--bg-darker, #141428);
                    border-top: 1px solid var(--border-color, #333);
                    display: none;
                }
                .workout-properties.visible {
                    display: flex;
                    gap: 16px;
                    align-items: center;
                }
                .workout-properties label {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 11px;
                    color: var(--text-muted, #888);
                }
                .workout-properties input {
                    padding: 6px 10px;
                    border: 1px solid var(--border-color, #444);
                    border-radius: 4px;
                    background: var(--bg-input, #2a2a4a);
                    color: var(--text-color, #fff);
                    width: 80px;
                }
                .workout-properties select {
                    padding: 6px 10px;
                    border: 1px solid var(--border-color, #444);
                    border-radius: 4px;
                    background: var(--bg-input, #2a2a4a);
                    color: var(--text-color, #fff);
                }
            </style>
            <div class="workout-builder">
                <div class="workout-toolbar">
                    <button data-action="add-warmup">+ Warmup</button>
                    <button data-action="add-steady">+ Steady</button>
                    <button data-action="add-cooldown">+ Cooldown</button>
                    <button data-action="add-interval">+ Intervals</button>
                    <button data-action="delete" disabled>Delete</button>
                    <button data-action="undo" disabled>Undo</button>
                    <button data-action="redo" disabled>Redo</button>
                    <div class="workout-metrics">
                        <div class="metric">
                            <span class="metric-label">Duration</span>
                            <span class="metric-value" id="metric-duration">0:00</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">TSS</span>
                            <span class="metric-value" id="metric-tss">0</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">IF</span>
                            <span class="metric-value" id="metric-if">0.00</span>
                        </div>
                    </div>
                </div>
                <div class="workout-canvas"></div>
                <div class="workout-properties">
                    <label>
                        Duration
                        <input type="text" id="prop-duration" placeholder="5:00">
                    </label>
                    <label>
                        Power %
                        <input type="number" id="prop-power" min="20" max="200" step="5">
                    </label>
                    <label>
                        Type
                        <select id="prop-type">
                            <option value="steady">Steady State</option>
                            <option value="warmup">Warmup</option>
                            <option value="cooldown">Cooldown</option>
                            <option value="freeride">Free Ride</option>
                        </select>
                    </label>
                    <button data-action="delete-selected">Delete Block</button>
                </div>
            </div>
        `;
    }

    setupEventListeners(signal) {
        // Toolbar buttons
        this.querySelector('.workout-toolbar').addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (!action) return;

            switch (action) {
                case 'add-warmup': this.addBlock('warmup'); break;
                case 'add-steady': this.addBlock('steady'); break;
                case 'add-cooldown': this.addBlock('cooldown'); break;
                case 'add-interval': this.addIntervalSet(); break;
                case 'delete': this.deleteSelected(); break;
                case 'undo': this.undo(); break;
                case 'redo': this.redo(); break;
            }
        }, signal);

        // Canvas pointer events for drag handling
        const canvas = this.querySelector('.workout-canvas');
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this), signal);
        window.addEventListener('pointermove', this.onPointerMove.bind(this), signal);
        window.addEventListener('pointerup', this.onPointerUp.bind(this), signal);

        // Property panel inputs
        this.querySelector('#prop-duration').addEventListener('change', this.onPropertyChange.bind(this), signal);
        this.querySelector('#prop-power').addEventListener('change', this.onPropertyChange.bind(this), signal);
        this.querySelector('#prop-type').addEventListener('change', this.onPropertyChange.bind(this), signal);

        // Resize observer
        const resizeObserver = new ResizeObserver(() => this.updateDimensions());
        resizeObserver.observe(canvas);

        // Keyboard shortcuts
        window.addEventListener('keydown', this.onKeyDown.bind(this), signal);
    }

    updateDimensions() {
        const canvas = this.querySelector('.workout-canvas');
        if (!canvas || !this.renderer) return;
        
        const rect = canvas.getBoundingClientRect();
        this.renderer.setDimensions(rect.width, rect.height);
        this.render();
    }

    // ========================================================================
    // Block Operations
    // ========================================================================

    addBlock(type) {
        const block = createBlock(type);
        this.blocks.push(block);
        this.saveHistory();
        this.render();
        this.dispatchWorkoutChange();
    }

    addIntervalSet() {
        // Create a 4x (30s on / 30s off) interval set
        const repeatGroup = createRepeatGroup([
            createBlock('steady', { duration: 30, power: 1.20 }),
            createBlock('steady', { duration: 30, power: 0.50 })
        ], 4);
        this.blocks.push(repeatGroup);
        this.saveHistory();
        this.render();
        this.dispatchWorkoutChange();
    }

    updateBlock(id, updates) {
        const findAndUpdate = (blocks) => {
            for (let i = 0; i < blocks.length; i++) {
                if (blocks[i].id === id) {
                    blocks[i] = { ...blocks[i], ...updates };
                    return true;
                }
                if (blocks[i].type === 'repeat') {
                    if (findAndUpdate(blocks[i].blocks)) return true;
                }
            }
            return false;
        };
        findAndUpdate(this.blocks);
        this.render();
        this.dispatchWorkoutChange();
    }

    deleteSelected() {
        if (!this.selectedId) return;
        
        const filterBlocks = (blocks) => {
            return blocks.filter(b => {
                if (b.id === this.selectedId) return false;
                if (b.type === 'repeat') {
                    b.blocks = filterBlocks(b.blocks);
                }
                return true;
            });
        };
        
        this.blocks = filterBlocks(this.blocks);
        this.selectedId = null;
        this.saveHistory();
        this.render();
        this.updateProperties();
        this.dispatchWorkoutChange();
    }

    selectBlock(id) {
        this.selectedId = id;
        this.renderer.setSelectedId(id);
        this.render();
        this.updateProperties();
        this.updateToolbar();
    }

    findBlock(id) {
        const search = (blocks) => {
            for (const block of blocks) {
                if (block.id === id) return block;
                if (block.type === 'repeat') {
                    const found = search(block.blocks);
                    if (found) return found;
                }
            }
            return null;
        };
        return search(this.blocks);
    }

    // ========================================================================
    // Drag Handling
    // ========================================================================

    onPointerDown(e) {
        const blockEl = e.target.closest('.workout-block, [data-block-id]');
        if (!blockEl) {
            this.selectBlock(null);
            return;
        }

        const blockId = blockEl.dataset.blockId || blockEl.getAttribute('data-block-id');
        const handle = e.target.dataset.handle || 'move';
        const block = this.findBlock(blockId);

        if (!block) return;

        this.selectBlock(blockId);

        if (handle === 'right' || handle === 'top') {
            e.preventDefault();
            
            this.dragState = {
                blockId,
                handle,
                startX: e.clientX,
                startY: e.clientY,
                startValue: handle === 'right' ? block.duration : block.power
            };
        }
    }

    onPointerMove(e) {
        if (!this.dragState) return;

        const block = this.findBlock(this.dragState.blockId);
        if (!block) return;

        const canvas = this.querySelector('.workout-canvas');
        const rect = canvas.getBoundingClientRect();

        // Calculate total duration for scaling
        const totalDuration = this.blocks.reduce((sum, b) => {
            if (b.type === 'repeat') {
                return sum + b.blocks.reduce((s, bl) => s + bl.duration, 0) * b.repeat;
            }
            return sum + b.duration;
        }, 0) || 600;

        const chartWidth = rect.width - CONFIG.PADDING.left - CONFIG.PADDING.right;
        const chartHeight = rect.height - CONFIG.PADDING.top - CONFIG.PADDING.bottom;
        const pixelsPerSecond = chartWidth / totalDuration;
        const pixelsPerPower = chartHeight / CONFIG.DISPLAY.MAX_POWER;

        if (this.dragState.handle === 'right') {
            // Drag right edge: modify duration
            const deltaX = e.clientX - this.dragState.startX;
            const deltaDuration = deltaX / pixelsPerSecond;
            let newDuration = this.dragState.startValue + deltaDuration;
            newDuration = clamp(newDuration, CONFIG.DISPLAY.MIN_DURATION, 3600);
            newDuration = snapValue(newDuration, CONFIG.SNAP.DURATION);
            
            this.updateBlock(this.dragState.blockId, { duration: newDuration });
        } 
        else if (this.dragState.handle === 'top') {
            // Drag top edge: modify power (inverted Y)
            const deltaY = e.clientY - this.dragState.startY;
            const deltaPower = -deltaY / pixelsPerPower;
            let newPower = this.dragState.startValue + deltaPower;
            newPower = clamp(newPower, CONFIG.DISPLAY.MIN_POWER, CONFIG.DISPLAY.MAX_POWER);
            newPower = snapValue(newPower, CONFIG.SNAP.POWER);
            
            this.updateBlock(this.dragState.blockId, { power: newPower });
        }

        this.updateProperties();
    }

    onPointerUp() {
        if (this.dragState) {
            this.saveHistory();
            this.dragState = null;
        }
    }

    // ========================================================================
    // Keyboard Handling
    // ========================================================================

    onKeyDown(e) {
        // Undo/Redo
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) this.redo();
            else this.undo();
            return;
        }

        if (!this.selectedId) return;
        const block = this.findBlock(this.selectedId);
        if (!block) return;

        // Delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelected();
            return;
        }

        // Arrow key adjustments
        let updated = false;
        const durIncrement = e.shiftKey ? 60 : 15;
        const powerIncrement = e.shiftKey ? 0.10 : 0.05;

        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                this.updateBlock(this.selectedId, { 
                    duration: Math.min(3600, block.duration + durIncrement) 
                });
                updated = true;
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.updateBlock(this.selectedId, { 
                    duration: Math.max(CONFIG.DISPLAY.MIN_DURATION, block.duration - durIncrement) 
                });
                updated = true;
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.updateBlock(this.selectedId, { 
                    power: Math.min(CONFIG.DISPLAY.MAX_POWER, block.power + powerIncrement) 
                });
                updated = true;
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.updateBlock(this.selectedId, { 
                    power: Math.max(CONFIG.DISPLAY.MIN_POWER, block.power - powerIncrement) 
                });
                updated = true;
                break;
        }

        if (updated) {
            this.saveHistory();
            this.updateProperties();
        }
    }

    // ========================================================================
    // History (Undo/Redo)
    // ========================================================================

    saveHistory() {
        this.history.push(this.blocks);
        this.updateToolbar();
    }

    undo() {
        const state = this.history.undo();
        if (state) {
            this.blocks = state;
            this.selectedId = null;
            this.render();
            this.updateProperties();
            this.updateToolbar();
            this.dispatchWorkoutChange();
        }
    }

    redo() {
        const state = this.history.redo();
        if (state) {
            this.blocks = state;
            this.selectedId = null;
            this.render();
            this.updateProperties();
            this.updateToolbar();
            this.dispatchWorkoutChange();
        }
    }

    // ========================================================================
    // Property Panel
    // ========================================================================

    updateProperties() {
        const panel = this.querySelector('.workout-properties');
        const block = this.selectedId ? this.findBlock(this.selectedId) : null;

        if (block && block.type !== 'repeat') {
            panel.classList.add('visible');
            this.querySelector('#prop-duration').value = formatTime({ value: block.duration, format: 'mm:ss' });
            this.querySelector('#prop-power').value = Math.round(block.power * 100);
            this.querySelector('#prop-type').value = block.type;
        } else {
            panel.classList.remove('visible');
        }
    }

    onPropertyChange(e) {
        if (!this.selectedId) return;
        const block = this.findBlock(this.selectedId);
        if (!block) return;

        const updates = {};

        if (e.target.id === 'prop-duration') {
            const parts = e.target.value.split(':').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                updates.duration = parts[0] * 60 + parts[1];
            }
        } else if (e.target.id === 'prop-power') {
            updates.power = parseInt(e.target.value) / 100;
        } else if (e.target.id === 'prop-type') {
            updates.type = e.target.value;
        }

        if (Object.keys(updates).length > 0) {
            this.updateBlock(this.selectedId, updates);
            this.saveHistory();
        }
    }

    // ========================================================================
    // Toolbar & Metrics
    // ========================================================================

    updateToolbar() {
        const undoBtn = this.querySelector('[data-action="undo"]');
        const redoBtn = this.querySelector('[data-action="redo"]');
        const deleteBtn = this.querySelector('[data-action="delete"]');

        if (undoBtn) undoBtn.disabled = !this.history.canUndo();
        if (redoBtn) redoBtn.disabled = !this.history.canRedo();
        if (deleteBtn) deleteBtn.disabled = !this.selectedId;
    }

    updateMetrics() {
        const metrics = calculateWorkoutMetrics(this.blocks, this.ftp);
        
        const durationEl = this.querySelector('#metric-duration');
        const tssEl = this.querySelector('#metric-tss');
        const ifEl = this.querySelector('#metric-if');

        if (durationEl) {
            durationEl.textContent = formatTime({ value: metrics.duration, format: 'hh:mm:ss' });
        }
        if (tssEl) {
            tssEl.textContent = metrics.tss;
        }
        if (ifEl) {
            ifEl.textContent = metrics.intensityFactor.toFixed(2);
        }
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    render() {
        if (!this.renderer) return;
        
        this.renderer.setBlocks(this.blocks);
        this.renderer.setFTP(this.ftp);
        this.renderer.setSelectedId(this.selectedId);
        this.renderer.render();
        this.updateMetrics();
    }

    // ========================================================================
    // External Event Handlers
    // ========================================================================

    onFTPChange(ftp) {
        this.ftp = ftp;
        this.updateMetrics();
    }

    onWorkoutLoad(workout) {
        if (workout && workout.intervals) {
            // Convert from existing format to builder format
            this.blocks = workout.intervals.map(interval => {
                return createBlock('steady', {
                    duration: interval.duration || 300,
                    power: interval.power || 0.75
                });
            });
            this.selectedId = null;
            this.saveHistory();
            this.render();
        }
    }

    dispatchWorkoutChange() {
        // Convert builder format back to app format
        const workout = {
            meta: {
                name: 'Custom Workout',
                duration: calculateWorkoutMetrics(this.blocks, this.ftp).duration
            },
            intervals: this.blocks.flatMap(block => {
                if (block.type === 'repeat') {
                    const expanded = [];
                    for (let i = 0; i < block.repeat; i++) {
                        block.blocks.forEach(b => {
                            expanded.push({
                                duration: b.duration,
                                power: b.power,
                                steps: [{ duration: b.duration, power: b.power }]
                            });
                        });
                    }
                    return expanded;
                }
                return [{
                    duration: block.duration,
                    power: block.power,
                    steps: [{ duration: block.duration, power: block.power }]
                }];
            })
        };

        xf.dispatch('workout:builder:update', workout);
    }

    // ========================================================================
    // Public API
    // ========================================================================

    getWorkout() {
        return {
            blocks: JSON.parse(JSON.stringify(this.blocks)),
            metrics: calculateWorkoutMetrics(this.blocks, this.ftp)
        };
    }

    setWorkout(blocks) {
        this.blocks = JSON.parse(JSON.stringify(blocks));
        this.selectedId = null;
        this.saveHistory();
        this.render();
    }
}

customElements.define('workout-builder', WorkoutBuilder);

export { WorkoutBuilder, calculateWorkoutMetrics, createBlock, createRepeatGroup };
