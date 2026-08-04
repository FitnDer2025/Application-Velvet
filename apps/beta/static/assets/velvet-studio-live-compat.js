(() => {
  'use strict';

  if (!window.AudioContext && window.webkitAudioContext) {
    window.AudioContext = window.webkitAudioContext;
  }

  if (!HTMLCanvasElement.prototype.captureStream && HTMLCanvasElement.prototype.webkitCaptureStream) {
    HTMLCanvasElement.prototype.captureStream = HTMLCanvasElement.prototype.webkitCaptureStream;
  }
})();
