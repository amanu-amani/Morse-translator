// script.js

// Add this line to confirm the script is loading! Check your browser's console (F12)
console.log("script.js loaded successfully!");

// Define the Morse code mapping
const morseCodeMap = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.',
    'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
    'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---',
    'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
    'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--',
    'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
    '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
    ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
    ' ': '/' // Space character in text maps to a single slash in Morse
};

// Create a reverse map for Morse to Text translation
const textCodeMap = Object.entries(morseCodeMap).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
}, {});

// Get DOM elements
const userText = document.getElementById('userText');
const convertTextBtn = document.getElementById('convertText');
const clearTextBtn = document.getElementById('clearText');
const outputArea = document.getElementById('outputArea');
const rateControl = document.getElementById('rateControl');
const rateDisplay = document.getElementById('rateDisplay');
const audioPlayBtn = document.getElementById('audioPlay');
const stopAudioBtn = document.getElementById('stopAudio');

const morseInput = document.getElementById('morseInput');
const convertMorseToTextBtn = document.getElementById('convertMorseToText');
const clearMorseInputBtn = document.getElementById('clearMorseInput');
const textOutput = document.getElementById('textOutput');

// Audio context and oscillator for Morse playback
let audioContext;
let oscillator;
let gainNode;
let isPlaying = false;
let currentMorseSequence = [];
let audioQueue = [];
let audioQueueIndex = 0;
let playbackTimeout;

// Function to initialize AudioContext
function initAudioContext() {
    // Check if AudioContext is allowed (some browsers require user interaction first)
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start with volume 0
            console.log("AudioContext initialized successfully.");
        } catch (e) {
            console.error("Error initializing AudioContext:", e);
            alert("Audio playback requires browser permission or a user interaction (like a click) to start the audio engine. Try clicking play again.");
            audioPlayBtn.disabled = true; // Disable if it fails
        }
    }
}

// Function to play a single Morse code sound (dot or dash)
function playMorseSound(type, duration, frequency = 600) {
    return new Promise(resolve => {
        if (!audioContext || audioContext.state === 'suspended') {
            // Attempt to resume or initialize context if suspended
            initAudioContext();
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log("AudioContext resumed from suspended state.");
                    _play();
                }).catch(e => {
                    console.error("Failed to resume AudioContext:", e);
                    resolve(); // Resolve to prevent infinite loading
                });
            } else {
                _play();
            }
        } else {
            _play();
        }

        function _play() {
            if (!isPlaying) { // If playback has been stopped externally
                resolve();
                return;
            }
            oscillator = audioContext.createOscillator();
            oscillator.type = 'sine'; // Sine wave for a clear tone
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.connect(gainNode);

            const attackTime = 0.01;
            const decayTime = 0.05;

            gainNode.gain.cancelScheduledValues(audioContext.currentTime);
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + attackTime); // Fade in
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration - decayTime); // Fade out

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);

            oscillator.onended = () => {
                resolve();
            };
            // console.log(`Playing ${type} for ${duration} seconds.`); // Uncomment for detailed audio logs
        }
    });
}

// Function to convert text to Morse code
function convertTextToMorse() {
    console.log("convertTextToMorse function called.");
    const text = userText.value.toUpperCase();
    let morse = '';
    let invalidChars = [];

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (morseCodeMap[char]) {
            morse += morseCodeMap[char] + ' '; // Add space between characters
        } else {
            if (char.trim() !== '') { // Only add if it's a non-whitespace unknown char
                invalidChars.push(char);
            }
            // For unknown characters, we can represent them with a question mark or just ignore
            // For now, let's just ignore them in the output but list them as invalid
        }
    }
    outputArea.textContent = morse.trim(); // Trim trailing space
    console.log("Morse output set to:", outputArea.textContent);

    if (invalidChars.length > 0) {
        outputArea.textContent += `\n\n(Note: The following characters were not translated: ${[...new Set(invalidChars)].join(', ')})`;
        console.log("Invalid characters found:", invalidChars);
    }

    // Enable/disable audio buttons based on actual morse content
    audioPlayBtn.disabled = morse.trim().length === 0;
    stopAudioBtn.disabled = true;
    console.log("Audio Play button disabled:", audioPlayBtn.disabled);
}

// Function to convert Morse code to text
function convertMorseToText() {
    console.log("convertMorseToText function called.");
    const morse = morseInput.value.trim();
    if (!morse) {
        textOutput.textContent = '';
        console.log("Morse input is empty, text output cleared.");
        return;
    }

    // Replace multiple spaces with a single space, and handle multiple slashes for word separation
    const cleanedMorse = morse.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim();
    console.log("Cleaned Morse input:", cleanedMorse);

    // Split into words by '/' and then into characters by ' '
    const words = cleanedMorse.split(' / ');
    let translatedText = '';
    let invalidSequences = [];

    words.forEach((word, wordIndex) => {
        const characters = word.split(' ');
        characters.forEach(charMorse => {
            if (charMorse === '') return; // Skip empty strings from multiple spaces

            if (textCodeMap[charMorse]) {
                translatedText += textCodeMap[charMorse];
            } else {
                if (charMorse.trim() !== '') { // Only add if it's a non-whitespace unknown sequence
                    invalidSequences.push(charMorse);
                }
                translatedText += '?'; // Use a placeholder for unknown sequences
            }
        });
        if (wordIndex < words.length - 1) {
            translatedText += ' '; // Add space between words
        }
    });

    textOutput.textContent = translatedText;
    console.log("Text output set to:", textOutput.textContent);

    if (invalidSequences.length > 0) {
        textOutput.textContent += `\n\n(Note: The following Morse sequences were not translated: ${[...new Set(invalidSequences)].join(', ')})`;
        console.log("Invalid Morse sequences found:", invalidSequences);
    }
}

// Function to play the generated Morse code audio
async function playMorseAudio() {
    if (isPlaying) {
        console.log("Audio already playing, ignoring new request.");
        return; // Prevent multiple simultaneous playbacks
    }

    initAudioContext(); // Ensure audio context is initialized and resumed
    if (!audioContext || audioContext.state === 'suspended') {
        console.warn("AudioContext still not active after init/resume attempt. Cannot play audio.");
        return;
    }

    isPlaying = true;
    audioPlayBtn.disabled = true;
    stopAudioBtn.disabled = false;
    console.log("Starting Morse audio playback.");

    const morseText = outputArea.textContent.split('\n')[0]; // Get only the actual morse, exclude notes
    if (!morseText || morseText.trim().length === 0) {
        isPlaying = false;
        audioPlayBtn.disabled = false;
        stopAudioBtn.disabled = true;
        console.log("No Morse text to play.");
        return;
    }

    currentMorseSequence = morseText.split(' ').filter(s => s !== '');
    audioQueue = [];
    const baseUnit = 0.12; // Duration of one dot in seconds (WPM dependent)
    const rate = parseFloat(rateControl.value);

    // Populate the audio queue
    for (const charMorse of currentMorseSequence) {
        if (charMorse === '/') { // Word space
            audioQueue.push({ type: 'pause', duration: 7 * baseUnit / rate }); // 7 units for word space
        } else {
            for (const symbol of charMorse) {
                if (symbol === '.') {
                    audioQueue.push({ type: 'dot', duration: baseUnit / rate });
                    audioQueue.push({ type: 'pause', duration: baseUnit / rate }); // Inter-element space (1 unit)
                } else if (symbol === '-') {
                    audioQueue.push({ type: 'dash', duration: 3 * baseUnit / rate });
                    audioQueue.push({ type: 'pause', duration: baseUnit / rate }); // Inter-element space (1 unit)
                }
            }
            audioQueue.push({ type: 'pause', duration: 3 * baseUnit / rate }); // Inter-character space (3 units)
        }
    }
    console.log("Audio queue populated with", audioQueue.length, "items.");

    audioQueueIndex = 0;
    await processAudioQueue();
}

async function processAudioQueue() {
    if (!isPlaying || audioQueueIndex >= audioQueue.length) {
        console.log("Audio queue finished or playback stopped externally.");
        stopMorseAudio(); // All sounds played or stopped
        return;
    }

    const item = audioQueue[audioQueueIndex];

    if (item.type === 'pause') {
        playbackTimeout = setTimeout(() => {
            audioQueueIndex++;
            processAudioQueue();
        }, item.duration * 1000);
    } else {
        await playMorseSound(item.type, item.duration);
        audioQueueIndex++;
        processAudioQueue();
    }
}

// Function to stop Morse code audio playback
function stopMorseAudio() {
    if (!isPlaying) return; // Already stopped
    console.log("Stopping Morse audio playback.");
    isPlaying = false;
    if (oscillator) {
        try {
            oscillator.stop();
            oscillator.disconnect();
            console.log("Oscillator stopped and disconnected.");
        } catch (e) {
            console.warn("Oscillator was already stopped or not connected.", e);
        }
    }
    if (playbackTimeout) {
        clearTimeout(playbackTimeout);
        console.log("Playback timeout cleared.");
    }
    // Re-enable play button if there's text to play
    audioPlayBtn.disabled = outputArea.textContent.trim().split('\n')[0].length === 0;
    stopAudioBtn.disabled = true;
    currentMorseSequence = [];
    audioQueue = [];
    audioQueueIndex = 0;
    console.log("Audio playback state reset.");
}

// Event Listeners

// Text to Morse Section
convertTextBtn.addEventListener('click', convertTextToMorse);
clearTextBtn.addEventListener('click', () => {
    userText.value = '';
    outputArea.textContent = '';
    audioPlayBtn.disabled = true;
    stopMorseAudio(); // Stop audio if playing and clear text
    convertTextBtn.disabled = true; // Disable convert button after clearing
    console.log("Text to Morse section cleared.");
});

// Morse to Text Section
convertMorseToTextBtn.addEventListener('click', convertMorseToText);
clearMorseInputBtn.addEventListener('click', () => {
    morseInput.value = '';
    textOutput.textContent = '';
    convertMorseToTextBtn.disabled = true; // Disable convert button after clearing
    console.log("Morse to Text section cleared.");
});

// Audio Panel
rateControl.addEventListener('input', () => {
    rateDisplay.textContent = `${parseFloat(rateControl.value).toFixed(1)}x`;
    console.log("Playback rate changed to:", rateControl.value);
});

audioPlayBtn.addEventListener('click', () => {
    // User interaction required to start AudioContext in some browsers
    initAudioContext();
    playMorseAudio();
});
stopAudioBtn.addEventListener('click', stopMorseAudio);

// Initial state for buttons on page load
function initializeButtonStates() {
    // Text to Morse section
    convertTextBtn.disabled = userText.value.trim().length === 0;
    audioPlayBtn.disabled = true; // Initially disabled as no morse output
    stopAudioBtn.disabled = true;

    // Morse to Text section
    convertMorseToTextBtn.disabled = morseInput.value.trim().length === 0;
    console.log("Initial button states set.");
}

// Add input event listeners to enable/disable convert buttons dynamically
userText.addEventListener('input', () => {
    convertTextBtn.disabled = userText.value.trim().length === 0;
    // Also disable play button if text is cleared or empty
    audioPlayBtn.disabled = outputArea.textContent.trim().split('\n')[0].length === 0 || userText.value.trim().length === 0;
});

morseInput.addEventListener('input', () => {
    convertMorseToTextBtn.disabled = morseInput.value.trim().length === 0;
});

// Call the initialization function when the page loads
document.addEventListener('DOMContentLoaded', initializeButtonStates);