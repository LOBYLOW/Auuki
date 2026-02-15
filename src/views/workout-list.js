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
    
    return `
    <workout-item 
        class='workout-item ${isSelected ? 'selected' : ''}' 
        id="${workout.id}"
    >
        <div class="workout-item--mini-summary">
            <div class="workout-item--name">${workout.meta.name}</div>
            <div class="workout-item--meta">
                <span>${workout.meta.category || 'General'}</span>
                <span>${duration}</span>
            </div>
        </div>
        <!-- Mini Graph Container (scaled down via CSS) -->
        <div class="workout-item--mini-graph">
             <div class="workout-list--graph-cont" style="width: 300%; height: 250%; align-items: flex-end; justify-content: flex-start; transform-origin: bottom left; transform: scale(0.33, 0.4);">${workout.graph}</div>
        </div>
    </workout-item>`;
}

function workoutDetailTemplate(workout) {
    if (!workout || !workout.meta) {
        return `<div class="workout-detail-panel">
            <div style="margin-top: 50%; color: var(--gray);">Select a workout from the list to view details</div>
        </div>`;
    }

    let duration = '';
    let distance = '';
    if(workout.meta.duration) {
        duration = `${Math.round(workout.meta.duration / 60)} min`;
    }
    if(workout.meta.distance) {
        distance = `${(workout.meta.distance / 1000).toFixed(2)} km`;
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
        
        <div class="workout-detail--graph-container">
            <div class="workout-list--graph-cont" style="height: 100%; width: 100%;">
                ${workout.graph}
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
        this.state = value;
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
        const selectedWorkout = this.state.find(w => w.id === this.selectedId);
        
        // Prepare list HTML
        const listHtml = this.state.reduce((acc, workout) => {
            let graph = '';
            // We generate the graph string here. Ideally we'd optimize this 
            // to not regenerate every render if data hasn't changed.
            if(exists(workout.intervals)) {
                graph = intervalsToGraph(workout, this.ftp, viewPort);
            } else {
                graph = courseToGraph(workout, viewPort);
            }
            // Attach graph to object for temp use
            workout = Object.assign(workout, {graph: graph});
            
            const isSelected = (workout.id === this.selectedId);
            return acc + workoutListItemTemplate(workout, isSelected);
        }, '');

        // Prepare Detail HTML
        let detailHtml = '';
        if (selectedWorkout) {
             // Re-use graph generation or use a larger viewport version for detail?
             // For simplicity, reusing the same graph string but it will expand to fill container
             detailHtml = workoutDetailTemplate(selectedWorkout);
        } else {
             detailHtml = '<div class="workout-detail-panel">Select a workout</div>';
        }

        this.innerHTML = `
            <div class="workout-selector-container">
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

