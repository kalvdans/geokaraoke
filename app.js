// fork getUserMedia for multiple browser versions, for those
// that need prefixes

navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

// set up forked web audio context, for multiple browsers
// window. is needed otherwise Safari explodes

// A4 = 69

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

var analyser;
var audioCtx;
var oscillator;

function do_audio_stuff() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    oscillator = audioCtx.createOscillator();
    var envelope = audioCtx.createGain();
    oscillator.type = 'sine';

    envelope.gain.value = 0;

    curtime = 0;

    for (var i in notes) {
        const note = 84 + notes[i];
        const freq = frequencyFromNoteNumber(note);
        const duration = lengths[i] / 8;
        oscillator.frequency.setValueAtTime(freq, curtime);
        envelope.gain.linearRampToValueAtTime(0.5, curtime + 0.001);
        envelope.gain.linearRampToValueAtTime(0, curtime + duration);

        curtime += duration;
    }

    oscillator.connect(envelope);
    envelope.connect(audioCtx.destination);
    oscillator.start();

    analyser = audioCtx.createAnalyser();
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.8;

}  // end of do_audio_stuff

var scrambleElem = document.querySelector('.scramble');
var scrambleCtx = scrambleElem.getContext("2d");

function noteFromPitch( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return noteNum + 69;
}

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

var mediaStream;

if (navigator.getUserMedia) {
   console.log('getUserMedia supported.');
   navigator.getUserMedia (
      // constraints - only audio needed for this app
      {
         audio: true
      },

      // Success callback
       function(stream) {
           do_audio_stuff();
         var source = audioCtx.createMediaStreamSource(stream);
         source.connect(analyser);

      	   visualize();

           mediaStream = stream;
      },

      // Error callback
      function(err) {
         console.log('The following gUM error occured: ' + err);
      }
   );
} else {
   console.log('getUserMedia not supported on your browser!');
}

var scrambled_data;
var image = new Image();
image.src = scrambled;
image.onload = function () {
    scrambleCtx.drawImage(image, 0,0);
    scrambled_data = scrambleCtx.getImageData(
        0, 0, scrambleElem.width, scrambleElem.height / 2);
}

var sample_index = 0;

function visualize() {
    analyser.fftSize = 4096;
    var bufferLengthAlt = analyser.frequencyBinCount;
    console.log(bufferLengthAlt);
    var dataArrayAlt = new Uint8Array(bufferLengthAlt);

    const minimum_played_note = 84;
    const check_below_freq = frequencyFromNoteNumber(minimum_played_note - 1);
    const check_below_idx = check_below_freq * bufferLengthAlt / audioCtx.sampleRate * 2;

    var drawAlt = function() {
        analyser.getByteFrequencyData(dataArrayAlt);

        var barHeight;

        var maxsofar = 0;
        var maxIdx = 1;

      for(var i = 1; i < check_below_idx; i++) {
          barHeight = dataArrayAlt[i];

          if (barHeight > maxsofar) {
              maxsofar = barHeight;
              maxIdx = i;
          }
      }

        var freq = maxIdx / bufferLengthAlt * audioCtx.sampleRate / 2;

        // Unscramble image
        var timeNow = Math.floor((audioCtx.currentTime - latency) * 8);
        var total_song_length = sample_points[sample_points.length - 1];

        if (timeNow < total_song_length) {
            requestAnimationFrame(drawAlt);
        } else {
            mediaStream.getAudioTracks().forEach(function(track) {
                track.stop();
            });
        }

        var lastTime = sample_index == 0 ? 0 : sample_points[sample_index - 1];
        var taktNow = sample_points[sample_index];
        var rotateFrac = (noteFromPitch(freq) / 12) % 1;

        const height = scrambleElem.height / 2;
        var rotatePix = Math.floor(height * rotateFrac);
        var startPix = Math.floor(lastTime / total_song_length * scrambleElem.width);
        var endPix = Math.floor(taktNow / total_song_length * scrambleElem.width);
        const width = endPix - startPix;
        if (width > 0) {
            // upper piece
            scrambleCtx.putImageData(scrambled_data,
                                     0, - rotatePix,
                                     startPix, rotatePix,
                                     width, height - rotatePix);
            // middle piece
            scrambleCtx.putImageData(scrambled_data,
                                     0, height - rotatePix,
                                     startPix, 0,
                                     width, height);
            // bottom piece
            if (rotatePix > 0)
                scrambleCtx.putImageData(scrambled_data,
                                         0, 2 * height - rotatePix,
                                         startPix, 0,
                                         width, rotatePix);
        }
        if (timeNow >= sample_points[sample_index])
            sample_index++;
    };

    drawAlt();

}
