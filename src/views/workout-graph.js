import { xf, exists, existance, equals, clamp, debounce, toFixed  } from '../functions.js';
import { formatTime, translate } from '../utils.js';
import { models } from '../models/models.js';
import { g } from './graph.js';
// Helpers replaced by SVG logic in intervalsToGraph


function intervalsToGraph(workout, ftp, viewPort, intensity = 100) {
    const intervals = workout.intervals || [];
    // const totalDuration = workout.meta.duration || 1; // Removed to fix duplicate declaration
    const intensityFactor = intensity / 100;
    
    let maxPower = 0;
    let computedDuration = 0;

    // First pass: Calculate total duration and max power from intervals/steps directly
    // This is more reliable than meta.duration which might be stale or incorrect
    intervals.forEach(interval => {
        if (interval.steps) {
            interval.steps.forEach(step => {
                computedDuration += (step.duration || 0);
                const power = step.power || 0;
                const p = models.ftp.toAbsolute(power, ftp) * intensityFactor;
                if (p > maxPower) maxPower = p;
            });
        }
    });

    // Use computed duration if available, otherwise fallback (avoid division by zero)
    const totalDuration = computedDuration || workout.meta.duration || 1;
    
    // Calculate max power for Y-axis scaling
    const currentFtp = Math.round(ftp * intensityFactor);
    maxPower = Math.max(maxPower, currentFtp * 1.5);


    // SVG ViewBox dimensions (normalized coordinate system)
    const vbWidth = 1000;
    const vbHeight = 400;
    const padding = { top: 20, right: 30, bottom: 30, left: 40 };
    
    // Scales: Map data to SVG coordinates
    const xScale = (d) => (d / totalDuration) * (vbWidth - padding.left - padding.right) + padding.left;
    const yScale = (p) => vbHeight - padding.bottom - (p / maxPower) * (vbHeight - padding.top - padding.bottom);
    const barHeight = (p) => (p / maxPower) * (vbHeight - padding.top - padding.bottom);

    // Expose scaling factors for external use (e.g., overlaying power data)
    const meta = {
        totalDuration,
        maxPower,
        padding,
        vbWidth,
        vbHeight
    };

    // Calculate axis data for HTML overlay and SVG grid lines
    const yAxisData = [];
    const yStep = Math.ceil(maxPower / 8 / 25) * 25 || 25;
    let yGrid = '';

    for(let p = 0; p <= maxPower; p += yStep) {
        if (p > 0) {
            // Percent position from bottom
            const yPct = ((p / maxPower) * (vbHeight - padding.top - padding.bottom) + padding.bottom) / vbHeight * 100;
             yAxisData.push({ val: p, pos: yPct });

             // Generate SVG grid line
             const y = yScale(p);
             yGrid += `<line x1="${padding.left}" y1="${y}" x2="${vbWidth - padding.right}" y2="${y}" class="graph--grid-line" stroke="#333" stroke-width="1" vector-effect="non-scaling-stroke" />`;
        }
    }

    const xAxisData = [];
    const xStep = Math.max(60, Math.ceil(totalDuration / 6 / 60) * 60);
    for(let t = 0; t <= totalDuration; t += xStep) {
        // Percent position from left
        const xPct = ((t / totalDuration) * (vbWidth - padding.left - padding.right) + padding.left) / vbWidth * 100;
        xAxisData.push({ val: formatTime({value: t, format: 'mm:ss'}), pos: xPct });
    }
    
    // Generate Bars
    let currentTime = 0;
    const bars = intervals.flatMap((interval, i) => {
        // if (!interval.duration) return []; // Removed check as duration might be implicit from steps
        if (!interval.steps || interval.steps.length === 0) return [];
        
        return interval.steps.map((step, j) => {
            const duration = step.duration || 0;
            const power = step.power || 0;
            const targetPower = models.ftp.toAbsolute(power, ftp) * intensityFactor;
            
            const x = xScale(currentTime);
            // Calculate width based on end time to avoid accumulation errors, or just relative width
            const endX = xScale(currentTime + duration);
            const width = endX - x;
            
            const y = yScale(targetPower); // Y for top of bar
            const base_y = vbHeight - padding.bottom;
            const h = base_y - y; // correct height calculation
            
            // Calculate zone based on original intended power (100% intensity)
            // This ensures colors stay relative to the workout design, not the scaled intensity
            const originalTargetPower = models.ftp.toAbsolute(power, ftp); 
            const zoneInfo = models.ftp.powerToZone(originalTargetPower, ftp);
            
            const zoneName = zoneInfo ? zoneInfo.name : 'gray'; // Safe access
            const zoneClass = `zone-${zoneName}`;
            const timeStr = formatTime({value: duration, format: 'mm:ss'});
            const startTimeStr = formatTime({value: currentTime, format: 'mm:ss'});
            
            // Build rect
            // Ensure width is at least something visible if duration is tiny but non-zero? 
            // Maybe not, correctness first.
            // Using a slightly smaller height to avoid overlap with bottom border/axis? No need.
            
            const rect = `<rect 
                x="${x}" 
                y="${y}" 
                width="${Math.max(width, 0)}" 
                height="${Math.max(h, 0)}"
                class="graph--bar ${zoneClass}"
                data-power="${Math.round(targetPower)}"
                data-duration="${timeStr}"
                data-start="${startTimeStr}"
            ><title>${Math.round(targetPower)}W (${timeStr})</title></rect>`; 
            
            currentTime += duration;
            return rect;
        });
    }).join("");
    
    // Generate Y-Axis Grid
    // (Consolidated above)
    
    // FTP Line
    const ftpY = yScale(currentFtp);
    // Use vector-effect on ftp line too
    const ftpLine = `<line x1="${padding.left}" y1="${ftpY}" x2="${vbWidth - padding.right}" y2="${ftpY}" class="graph--ftp-line" stroke-dasharray="5,5" stroke="#fff" vector-effect="non-scaling-stroke" />`;

    // Add containers for dynamic overlays
    const overlays = `
        <polyline id="power-line" fill="none" stroke="yellow" stroke-width="2" points="" vector-effect="non-scaling-stroke" />
        <line id="progress-line" stroke="#fff" stroke-width="2" display="none" vector-effect="non-scaling-stroke" />
    `;

    return {
        svg: `<svg viewBox="0 0 ${vbWidth} ${vbHeight}" preserveAspectRatio="none" class="graph--svg" style="display: block; width: 100%; height: 100%;">
            ${yGrid}
            ${bars}
            ${ftpLine}
            ${overlays}
        </svg>`,
        meta,
        axis: { 
            x: xAxisData, 
            y: yAxisData, 
            ftp: { val: `FTP ${intensity}%`, pos: ((currentFtp / maxPower) * (vbHeight - padding.top - padding.bottom) + padding.bottom) / vbHeight * 100 } 
        }
    };
}


function renderInfoFunc(args = {}) {
    // ... renamed to avoid collision and confusion ...
    const power    = exists(args.power)    ? `${args.power}W `: '';
    const cadence  = args.cadence ? `${args.cadence}rpm `: '';
    const slope    = args.slope ? `${toFixed(args.slope, 2)}%` : '';
    const duration = args.duration ? `${args.duration} `: '';
    const start    = args.start ? `(@ ${args.start})` : '';

    const dom = args.dom;
    if (!dom || !dom.info) return;

    dom.info.style.display = 'block';
    dom.info.innerHTML = `
        <div style="font-weight:bold; font-size:1.1em; margin-bottom:0.2em;">${power}</div>
        <div style="font-size:0.9em; opacity:0.8;">Duration: ${duration} ${start}</div>
        ${cadence ? `<div style="font-size:0.9em;">Cadence: ${cadence}</div>` : ''}
        ${slope ? `<div style="font-size:0.9em;">Slope: ${slope}</div>` : ''}
    `;

    const tooltipWidth = dom.info.offsetWidth || 120;
    const tooltipHeight = dom.info.offsetHeight || 60;
    const intervalRect = args.intervalRect;
    
    let left = intervalRect.left + (intervalRect.width / 2) - (tooltipWidth / 2);
    let top = intervalRect.top - tooltipHeight - 10;
    
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
    if (top < 10) top = intervalRect.bottom + 10;

    dom.info.style.left = `${left}px`;
    dom.info.style.top = `${top}px`;
    dom.info.classList.add('graph--info-overlay');
}

class WorkoutGraph extends HTMLElement {
    constructor() {
        super();
        this.workout = {};
        this.workoutStatus = "stopped";
        this.type = 'workout';
        this.ftp = 200; // Default FTP to avoid render issues before data loads
        this.powerHistory = [];
        this.graphMeta = null;
    }
    connectedCallback() {
        this.$graphCont = document.querySelector('#graph-workout') ?? this;
        
        this.abortController = new AbortController();
        this.signal = { signal: this.abortController.signal };

        xf.sub(`db:workout`, this.onWorkout.bind(this), this.signal);
        xf.sub(`db:ftp`, this.onFTP.bind(this), this.signal);
        xf.sub(`db:intensity`, this.onIntensity.bind(this), this.signal);
        xf.sub('db:page', this.onPage.bind(this), this.signal);
        xf.sub('db:intervalIndex', this.onIntervalIndex.bind(this), this.signal);
        // xf.sub('db:lapTime', this.onLapTime.bind(this), this.signal); // switching to elapsed for absolute position
        xf.sub('db:elapsed', this.onElapsed.bind(this), this.signal);
        xf.sub('db:workoutStatus', this.onWorkoutStatus.bind(this), this.signal);
        xf.sub('db:power', this.onPower.bind(this), this.signal);

        this.addEventListener('mouseover', this.onHover.bind(this), this.signal);
        this.addEventListener('mouseout', this.onMouseOut.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onFTP(value) {
        this.ftp = value;
        if(exists(this.workout.intervals)) this.render();
    }
    onIntensity(value) {
        this.intensity = value;
        if(exists(this.workout.intervals)) this.render();
    }
    onPage(page) {
        if(equals(page, 'home')) {
            this.render();
        }
    }
    
    onHover(e) {
        const target = e.target.closest('rect'); 
        // We only care about interval bars which should have data attributes
        if(target && target.dataset.power) {
            const power    = target.dataset.power;
            const cadence  = target.dataset.cadence;
            const duration = target.dataset.duration;
            const start    = target.dataset.start;
            const slope    = target.getAttribute('slope'); // for course/slope mode
             
            const intervalRect = target.getBoundingClientRect();
            
            this.renderInfo({
                power, cadence, slope, duration, start,
                intervalRect,
                dom: { info: this.querySelector('.graph--info--cont') },
            });
        } else if (e.target.closest('polygon') && e.target.getAttribute('slope')) {
             // Handle course graph hover
             const target = e.target;
             const slope = target.getAttribute('slope');
             const intervalRect = target.getBoundingClientRect();
             this.renderInfo({
                 slope,
                 intervalRect,
                 dom: { info: this.querySelector('.graph--info--cont') },
             });
        }
    }
    onMouseOut(e) {
        const info = this.querySelector('.graph--info--cont');
        if(info) info.style.display = 'none';
    }
    onWorkout(value) {
        this.workout = value;
        // Check if value exists before checking points
        this.type = (value && value.points) ? 'course' : 'workout';
        this.render();
    }
    onWorkoutStatus(s) { this.workoutStatus = s; }
    onIntervalIndex(index) { this.currentIndex = index; }
    onLapTime(t) { 
        // Deprecated in favor of onElapsed
    }
    
    onPower(p) {
        this.currentPower = p;
    }

    onElapsed(t) {
        if(!this.graphMeta || (this.workoutStatus !== 'running' && this.workoutStatus !== 'paused')) return;
        
        // Add point to history
        // Only if we have a valid power reading
        // Using currentPower which is updated by db:power subscription
        if (exists(this.currentPower)) {
            // Append explicit update call
            this.updateOverlays(t, this.currentPower);
        }
    }

    updateOverlays(time, power) {
         if (!this.graphMeta) return;
         const { totalDuration, maxPower, padding, vbWidth, vbHeight } = this.graphMeta;
         
         // Project Time (X)
         const availableWidth = vbWidth - padding.left - padding.right;
         // Ensure we don't go beyond graph
         const clampedTime = Math.min(time, totalDuration);
         const x = (clampedTime / totalDuration) * availableWidth + padding.left;
         
         // Project Power (Y)
         // Note: Y axis is inverted in SVG (0 is top)
         const availableHeight = vbHeight - padding.top - padding.bottom;
         const clampedPower = Math.min(power, maxPower); // Clamp power so it doesn't go off chart
         const y = vbHeight - padding.bottom - (clampedPower / maxPower) * availableHeight;
         
         const svg = this.querySelector('svg');
         if(!svg) return;
         
         // Update Progress Line
         let progressLine = svg.querySelector('#progress-line');
         if(progressLine) {
             progressLine.setAttribute('x1', x);
             progressLine.setAttribute('x2', x);
             progressLine.setAttribute('y1', padding.top); 
             progressLine.setAttribute('y2', vbHeight - padding.bottom);
             progressLine.style.display = 'block';
         }
         
         // Update Power Line
         let powerLine = svg.querySelector('#power-line');
         if(powerLine) {
             const newPoint = `${x},${y}`;
             const currentPoints = powerLine.getAttribute('points') || "";
             const separator = currentPoints ? ' ' : '';
             // Limit points string length if necessary, but SVG handles many points well.
             powerLine.setAttribute('points', currentPoints + separator + newPoint);
         }
    }

    updateProgress(lapTime) {
         // Deprecated in favor of onElapsed
    } 

    render() {
        if(this.type === 'workout' && this.workout && this.workout.intervals) {
            // Use standard 1000x400 viewBox
            const result = intervalsToGraph(this.workout, this.ftp, {width: 1000, height: 400}, this.intensity ?? 100);
            
            let svgContent = '';
            let axisHtml = '';
            
            if (typeof result === 'object' && result.svg) {
                svgContent = result.svg;
                this.graphMeta = result.meta;
                
                // Generate Axis HTML
                if (result.axis) {
                    const yLabels = result.axis.y.map(a => `<div class="graph--y-label" style="bottom: ${a.pos}%;">${a.val}</div>`).join('');
                    const xLabels = result.axis.x.map(a => `<div class="graph--x-label" style="left: ${a.pos}%;">${a.val}</div>`).join('');
                    const ftpLabel = `<div class="graph--ftp-label" style="bottom: ${result.axis.ftp.pos}%; right: 5px;">${result.axis.ftp.val}</div>`;
                    
                    axisHtml = `<div class="graph--axis-layer">${yLabels}${xLabels}${ftpLabel}</div>`;
                }
            } else {
                svgContent = result;
                this.graphMeta = null; 
            }

            this.innerHTML = `${svgContent}${axisHtml}<div class="graph--info--cont"></div>`;
            this.powerHistory = []; 
            // Clear existing points on new render
            // Re-select power-line since innerHTML overwrote it
            const pl = this.querySelector('#power-line');
            if(pl) pl.setAttribute('points', '');

        } else if (this.type === 'course' && this.workout) {
             const rect = this.getBoundingClientRect(); 
             const width = rect.width || 1000;
             const height = rect.height || 400;
             const args = { width, height, aspectRatio: width/height };
             this.innerHTML = courseToGraph(this.workout, args);
             // Ensure info container exists for course too
             if(!this.querySelector('.graph--info--cont')) {
                 this.innerHTML += `<div class="graph--info--cont graph--info-overlay"></div>`;
             }
        }
    }
    renderInfo(args = {}) {
        renderInfoFunc(args);
    }
}

customElements.define('workout-graph', WorkoutGraph);



function Segment(points, prop) {
    return points.reduce((acc, point, i) => {
        const value = point[prop];
        if(value > acc.max) acc.max = value;
        if(value < acc.min) acc.min = value;
        if(equals(i, 0)) { acc.min = value; acc.start = value; };
        if(equals(i, points.length-1)) acc.end = value;
        return acc;
    }, {min: 0, max: 0, start: 0, end: 0,});
}

function scale(value, max = 100) {
    return 100 * (value/max);
}

function courseToGraph(course, viewPort) {
    const altitudeSpec  = Segment(course.points, 'y');

    const distanceTotal = course.meta.distance;
    const aspectRatio   = viewPort.aspectRatio;
    const yOffset       = Math.min(altitudeSpec.min, altitudeSpec.start, altitudeSpec.end);
    const yMax          = (altitudeSpec.max - altitudeSpec.min);
    const yScale        = (1 / ((aspectRatio * yMax) / distanceTotal));
    const flatness      = ((altitudeSpec.max - altitudeSpec.min));
    const altitudeScale = yScale * ((flatness < 100) ? 0.2 : 0.7);

    const viewBox = { width: distanceTotal, height: yMax, };

    // console.table({distanceTotal, yMax, aspectRatio, yScale, flatness, altitudeScale, altitudeSpec});

    const track = course.pointsSimplified.reduce((acc, p, i, xs) => {
        const color = g.slopeToColor(p.slope);

        const px1 = p.x;
        const px2 = xs[i+1]?.x ?? px1;
        const py1 = p.y;
        const py2 = xs[i+1]?.y ?? py1;

        const x1 = px1;
        const y1 = yMax;
        const x2 = px1;
        const y2 = yMax - ((py1-yOffset) * altitudeScale);
        const x3 = px2;
        const y3 = yMax - ((py2-yOffset) * altitudeScale);
        const x4 = px2;
        const y4 = yMax;

        return acc + `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" stroke="none" fill="${color}" class="graph--bar" index="${i}" slope="${p.slope}" />`;

    }, ``);

    const display =
          `<altitude-value class="elevation--value altitude--value">${altitudeSpec.start ?? '--'}</altitude-value>
        <ascent-value class="elevation--value ascent--value">0.0</ascent-value>`;

    return `${display}<div class="graph--info--cont"></div><svg class="graph--bar-group" width="100%" height="100%" viewBox="0 0 ${viewBox.width} ${viewBox.height}" preserveAspectRatio="xMinYMax meet">${track}</svg>`;
}

export {
    WorkoutGraph,
    intervalsToGraph,
    courseToGraph,
    renderInfoFunc as renderInfo,
};

