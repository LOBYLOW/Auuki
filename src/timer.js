var interval;
var intervalDuration = 1000;

function onStart() {
    onStop(); // Prevent multiple intervals stacking
    interval = setInterval(function(){
        self.postMessage('tick');
    }, intervalDuration);
}

function onStop() {
    clearInterval(interval);
}

function onConfig(data) {
    if (data.interval) {
        intervalDuration = data.interval;
        if (interval) {
            onStop();
            onStart();
        }
    }
}

self.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'config') {
        onConfig(e.data);
        return;
    }
    switch (e.data) {
    case 'start': onStart(); break;
    case 'stop':  onStop(); break;
    case 'pause': onStop(); break;
    };
}, false);
