import { xf, exists, empty, equals, debounce } from '../functions.js';
import { models } from '../models/models.js';
import { intervalsToGraph, courseToGraph, renderInfo } from './workout-graph.js';

const radioOff = `
        <svg class="radio radio-off">
            <use href="#icon--radio-off">
        </svg>`;

const radioOn = `
        <svg class="radio radio-on">
            <use href="#icon--radio-on">
        </svg>`;

const options = `
        <svg class="workout--options-btn control--btn--icon">
            <use href="#icon--options">
        </svg>`;


function workoutListItemTemplate(workout, isSelected) {
    let duration = '';
    if(workout.meta.duration) {
        duration = `${Math.round(workout.meta.duration / 60)} min`;
    }
    
    // We want a tiny representation. The graph in full scale (1000x400) is too detailed if we scale it.
    // But since it's SVG, we can just render it small.
    // The "transform: scale" trick is usually to make fonts readable, but we don't have text here.
    // So we can just set width/height to 100% in the container.
    // But maybe we want the aspect ratio to look squashed or stretched differently?
    // Let's just fit it in the box. `preserveAspectRatio="none"` on the generating side handles stretching.
    
    return `
    <div 
        class='workout-item ${isSelected ? 'selected' : ''}' 
        id="${workout.id}"
        onclick="this.dispatchEvent(new CustomEvent('workout-item-click', { detail: { id: this.id }, bubbles: true }))"
    >
        <div class="workout-item--mini-summary">
            <div class="workout-item--name" title="${workout.meta.name}">${workout.meta.name}</div>
            <div class="workout-item--meta">
                <span>${workout.meta.category || 'General'}</span>
                <span> • ${duration}</span>
            </div>
        </div>
        <div class="workout-item--mini-graph">
             <!-- The graph SVG already has width=100%, height=100% -->
             ${workout.graph}
        </div>
    </div>`;
}

function workoutDetailTemplate(workout) {
    if (!workout || !workout.meta) {
        return `<div class="workout-detail-panel" style="display:flex; align-items:center; justify-content:center; height:100%; color: #888;">Select a workout to view details</div>`;
    }

    let duration = '';
    let distance = '';
    if(workout.meta.duration) {
        duration = `${Math.round(workout.meta.duration / 60)} min`;
    }
    if(workout.meta.distance) {
        distance = `${(workout.meta.distance / 1000).toFixed(2)} km`;
    }

    let axisHtml = '';
    if (workout.axisData) {
        const ad = workout.axisData;
        const yLabels = ad.y.map(a => `<div class="graph--y-label" style="bottom: ${a.pos}%;">${a.val}</div>`).join('');
        const xLabels = ad.x.map(a => `<div class="graph--x-label" style="left: ${a.pos}%;">${a.val}</div>`).join('');
        // Ensure FTP exists before accessing
        const ftpLabel = ad.ftp ? `<div class="graph--ftp-label" style="bottom: ${ad.ftp.pos}%; right: 5px;">${ad.ftp.val}</div>` : '';
        
        axisHtml = `<div class="graph--axis-layer">${yLabels}${xLabels}${ftpLabel}</div>`;
    }

    return `
    <div class="workout-detail-panel">
        <div class="workout-detail--header">
            <div class="workout-detail--header-info">
                <div class="workout-detail--title">${workout.meta.name}</div>
                <div class="workout-detail--meta">
                    ${workout.meta.category ? workout.meta.category + ' • ' : ''} 
                    ${duration} 
                    ${distance ? ' • ' + distance : ''}
                </div>
            </div>
            <button class="workout-detail--load-btn" type="button" data-id="${workout.id}">
                LOAD WORKOUT
            </button>
        </div>
        
        <div class="workout-detail--graph-container"> <!-- Use relative positioning for overlays -->
            <div class="workout-list--graph-cont" style="position: relative; height: 100%; width: 100%;">
                ${workout.graph}
                ${axisHtml}
            </div>
        </div>
        
        <div class="workout-detail--description">
            ${workout.meta.description || 'No description available.'}
        </div>
    </div>`;
}

class WorkoutList extends HTMLElement {
    constructor() {
        super();
        this.state = [];
        this.ftp = 0;
        this.items = [];
        this.selectedId = null; 
        this.postInit();
        this.workout = {};
    }
    postInit() { return; }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        xf.sub(`db:workouts`, this.onWorkouts.bind(this), this.signal);
        xf.sub('db:workout',  this.onWorkout.bind(this), this.signal);
        xf.sub(`db:ftp`,      this.onFTP.bind(this), this.signal);
        
        // Listen for item selection events
        this.addEventListener('workout-item-click', this.onItemClick.bind(this), this.signal);
        
        // Listen for Load button click in the detail panel (bubbled up)
        this.addEventListener('pointerup', this.onLoadClick.bind(this), this.signal);
    }

    disconnectedCallback() {
        this.abortController.abort();
    }
    
    getWidth() {
        return window.innerWidth;
    }

    onWorkout(value) {
        this.workout = value;
        // Optionally update selectedId if valid
        if(value && value.id) {
             this.selectedId = value.id;
             this.render();
        }
    }

    onFTP(value) {
        if(!equals(value, this.ftp)) {
            this.ftp = value;
            if(!empty(this.state)) {
                this.render();
            }
        }
    }

    onWorkouts(value) {
        this.state = Array.isArray(value) ? value : [];
        // Default select first one if nothing selected
        if (!this.selectedId && this.state.length > 0) {
            this.selectedId = this.state[0].id;
        }
        this.render();
    }

    onItemClick(e) {
        const newId = e.detail.id;
        if (this.selectedId !== newId) {
            this.selectedId = newId;
            this.render(); 
        }
    }
    
    onLoadClick(e) {
        // Check if the click came from the load button
        if (e.target.classList.contains('workout-detail--load-btn')) {
            const id = e.target.getAttribute('data-id');
            if (id) {
                xf.dispatch('ui:workout:select', id);
                xf.dispatch('ui:page-set', 'home');
            }
        }
    }

    getViewPort() {
        const self = this;
        // Simple viewport calc for generating graph
        const width = 600; // Fixed width assumption for graph generation logic roughly
        const height = 200;
        return {
            height,
            width,
            aspectRatio: width / height,
        };
    }

    render() {
        const viewPort = this.getViewPort();
        const self = this;
        
        // Safety check
        if (!Array.isArray(this.state)) {
            this.state = [];
        }
        
        // Prepare list HTML
        const listItemsCtx = this.state.map(workout => {
            let graph = '';
            let axis = null;
            
            // Ensure workout has required structure
            if (!workout || !workout.meta) {
                return { id: workout?.id || 'unknown', meta: { name: 'Unknown' }, graph: '', axisData: null };
            }
            
            if(workout.intervals && Array.isArray(workout.intervals)) {
                // Generate graph once
                const result = intervalsToGraph(workout, this.ftp, viewPort);
                if (typeof result === 'object' && result.svg) {
                    graph = result.svg;
                    axis = result.axis;
                } else {
                     graph = result;
                }
            } else {
                graph = courseToGraph(workout, viewPort);
            }
            
            // Return context object for template usage, avoid mutating original state if possible
            // but for now let's just extend a copy
            return {
                ...workout,
                graph,
                axisData: axis
            };
        });

        // Generate Side bar
        const listHtml = listItemsCtx.map(w => {
            const isSelected = (w.id === this.selectedId);
            return workoutListItemTemplate(w, isSelected); 
        }).join('');
        
        // Prepare Detail HTML
        let detailHtml = '';
        const selectedWorkoutCtx = listItemsCtx.find(w => w.id === this.selectedId);
        
        if (selectedWorkoutCtx) {
             detailHtml = workoutDetailTemplate(selectedWorkoutCtx);
        } else {
             detailHtml = '<div class="workout-detail-panel" style="display:flex; align-items:center; justify-content:center; height:100%; color: #888;">Select a workout to view details</div>';
        }

        this.innerHTML = `
            <div class="workout-selector-container">
                <style>
                    /* Inline style to ensure layout works with flex */
                    .workout-selector-container { display: flex; height: 100%; width: 100%; overflow: hidden; }
                    .workout-list-sidebar { width: 300px; overflow-y: auto; background: #1a1a1a; border-right: 1px solid #333; flex-shrink: 0; }
                    .workout-detail-panel { flex-grow: 1; padding: 20px; display: flex; flex-direction: column; overflow-y: auto; background: #111; }
                    .workout-detail--header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                    .workout-detail--title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                    .workout-detail--meta { font-size: 14px; color: #888; }
                    .workout-detail--load-btn { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
                    .workout-detail--load-btn:hover { background: #0056b3; }
                    .workout-detail--graph-container { margin-bottom: 20px; height: 300px; background: #222; position: relative; border-radius: 4px; overflow: hidden; }
                    .workout-detail--description { line-height: 1.6; color: #ccc; }
                    /* Axis styling reuse */
                    .graph--axis-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
                    
                    /* Workout Item Styles */
                    .workout-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #333; cursor: pointer; height: 60px; box-sizing: border-box; }
                    .workout-item:hover { background: #252525; }
                    .workout-item.selected { background: #333; border-left: 3px solid #007bff; }
                    .workout-item--mini-summary { flex: 1; min-width: 0; margin-right: 10px; display: flex; flex-direction: column; justify-content: center; }
                    .workout-item--name { font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
                    .workout-item--meta { font-size: 11px; color: #888; }
                    .workout-item--mini-graph { width: 100px; height: 40px; position: relative; opacity: 0.8; flex-shrink: 0; }
                </style>
                <div class="workout-list-sidebar">
                    ${listHtml}
                </div>
                ${detailHtml}
            </div>
        `;
    }
}

class WorkoutListItem extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.addEventListener('pointerup', this.onClick.bind(this));
    }
    onClick(e) {
        // Dispatch custom event to parent
        this.dispatchEvent(new CustomEvent('workout-item-click', { 
            detail: { id: this.id },
            bubbles: true 
        }));
    }
}


customElements.define('workout-list', WorkoutList);
customElements.define('workout-item', WorkoutListItem);

export {
    radioOff,
    radioOn,
    options,
    workoutListItemTemplate,
    workoutDetailTemplate
};

