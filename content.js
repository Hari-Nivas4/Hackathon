(function injectCSS() {
  const css = `
/* Container for the floating key */
#brain-floating-key-container {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  pointer-events: none;
}

/* Floating key (ball) styling */
.brain-voice-btn {
  width: 60px;
  height: 60px;
  background: #27c4eb;
  color: white;
  font-size: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 20px;
  right: 20px;
  box-shadow: 0 0 10px rgba(255, 255, 255, 1);
  transition: box-shadow 0.3s ease-in-out;
  pointer-events: auto;
}
.brain-voice-btn:hover {
  cursor: pointer;
}
.brain-active {
  position: relative;
}
.brain-active::before {
  content: "";
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  border-radius: 50%;
  background: conic-gradient(red, green, blue, rgb(233, 249, 9));
  animation: brain-spin-glow 1s linear infinite;
  z-index: -1;
  filter: blur(15px);
}
@keyframes brain-spin-glow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Style for media label overlays */
.media-label-overlay {
  position: absolute;
  top: 5px;
  left: 5px;
  background: rgba(255,0,0,0.7);
  color: white;
  padding: 2px 5px;
  font-size: 12px;
  z-index: 10000;
  border-radius: 3px;
}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

let popupon = false;
let needPopup = false;
const SUBMIT_ENDPOINT = "http://localhost:3000/submit-element";
let currentZoom = 1; 

if (!sessionStorage.getItem("extensionClicked")) {
  sessionStorage.setItem("extensionClicked", "false");
}
let extensionClicked = (sessionStorage.getItem("extensionClicked") === "true");

if (sessionStorage.getItem("floatingBallVisible") === null) {
  sessionStorage.setItem("floatingBallVisible", "true");
}

if (document.readyState === "loading") {
  console.log("here");
  document.addEventListener("DOMContentLoaded", initContentScript);
} else {
  console.log("here");
  initContentScript();
}


function handleNavigationChange() {
  console.log("Navigation detected!", window.location.href);
  checkPopupStatus();
}

window.addEventListener("pageshow", handleNavigationChange);
window.addEventListener("hashchange", handleNavigationChange);
window.addEventListener("popstate", handleNavigationChange);

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;
history.pushState = function (...args) {
  const result = originalPushState.apply(this, args);
  handleNavigationChange();
  return result;
};
history.replaceState = function (...args) {
  const result = originalReplaceState.apply(this, args);
  handleNavigationChange();
  return result;
};
window.addEventListener("load", handleNavigationChange);

// DOM MutationObserver to detect URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    handleNavigationChange();
  }
}).observe(document.body, { childList: true, subtree: true });


function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

function similarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

function preprocessString(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

/* Recursively get best clickable match within an element and its clickable descendants */
function getBestMatch(element, keyword) {
  let baseScore = similarity(keyword, preprocessString(element.innerText || ""));
  const computed = window.getComputedStyle(element);
  if (computed.cursor && computed.cursor.includes("pointer")) {
    baseScore += 0.1;
  }
  let best = { element: element, score: baseScore };
  // Check clickable descendants
  const descendantSelectors = "a, button, input, span";
  const descendants = element.querySelectorAll(descendantSelectors);
  descendants.forEach(descendant => {
    if (!descendant.offsetParent) return;
    let score = similarity(keyword, preprocessString(descendant.innerText || ""));
    const descComputed = window.getComputedStyle(descendant);
    if (descComputed.cursor && descComputed.cursor.includes("pointer")) {
      score += 0.1;
    }
    if (score > best.score) {
      best = { element: descendant, score: score };
    }
  });
  return best;
}

function findClickableAncestor(element) {
  let current = element;
  while (current) {
    const tag = current.tagName.toLowerCase();
    const style = window.getComputedStyle(current);
    if (["a", "button", "input"].includes(tag) || (style.cursor && style.cursor.includes("pointer"))) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function simulateClick(target) {
  const rawKeyword = target.replace(/click|press|tap/gi, "").trim();
  const keyword = preprocessString(rawKeyword);
  if (!keyword) {
    console.log("No target keyword provided for click");
    return;
  }
  
  // Optimize element search by using more specific selectors first
  // Try to find exact text match first for efficiency
  const exactMatchXPath = `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`;
  const exactMatches = document.evaluate(exactMatchXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
  if (exactMatches.snapshotLength > 0) {
    // Sort matches by length to find closest match
    const matchedElements = [];
    for (let i = 0; i < exactMatches.snapshotLength; i++) {
      const element = exactMatches.snapshotItem(i);
      if (element.offsetParent !== null) { // Only visible elements
        matchedElements.push({
          element,
          text: element.textContent,
          score: similarity(keyword, preprocessString(element.textContent))
        });
      }
    }
    
    if (matchedElements.length > 0) {
      // Sort by similarity score
      matchedElements.sort((a, b) => b.score - a.score);
      const bestMatch = matchedElements[0];
      
      if (bestMatch.score >= 0.7) {
        console.log("Fast path: Clicking exact match element with score:", bestMatch.score);
        
        // Find clickable element (self or ancestor)
        const elementToClick = findClickableAncestor(bestMatch.element) || bestMatch.element;
        elementToClick.click();
        return;
      }
    }
  }
  
  // Fallback to normal search if no exact match found
  const selectors = "a, button, input, div, span";
  const candidates = Array.from(document.querySelectorAll(selectors));
  let overallBest = { element: null, score: 0 };
  
  // Limit the number of candidates to check for performance
  const visibleCandidates = candidates.filter(c => c.offsetParent !== null).slice(0, 100);
  
  visibleCandidates.forEach(candidate => {
    let candidateBest = getBestMatch(candidate, keyword);
    if (candidateBest.score > overallBest.score) {
      overallBest = candidateBest;
    }
  });
  
  if (overallBest.score >= 0.7 && overallBest.element) {
    console.log("Clicking element with score:", overallBest.score, overallBest.element);
    overallBest.element.click();
    return;
  }
  
  // Final fallback with lower threshold
  if (overallBest.score >= 0.5 && overallBest.element) {
    console.log("Clicking element with lower score:", overallBest.score, overallBest.element);
    overallBest.element.click();
  } else {
    console.log("No match found for:", keyword);
  }
}

function findScrollableContainer() {
  const elements = document.querySelectorAll("div, section, main, article");
  for (let element of elements) {
    const style = window.getComputedStyle(element);
    const overflowY = style.getPropertyValue("overflow-y");
    const overflowX = style.getPropertyValue("overflow-x");
    if (
      ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) ||
      ((overflowX === "auto" || overflowX === "scroll") && element.scrollWidth > element.clientWidth)
    ) {
      return element;
    }
  }
  return null;
}

function scrollDown() {
  const container = findScrollableContainer();
  if (container) {
    container.scrollBy({ top: container.clientHeight, left: 0, behavior: "smooth" });
    console.log("Scrolled down container");
  } else {
    window.scrollBy({ top: window.innerHeight, left: 0, behavior: "smooth" });
    console.log("Scrolled down window");
  }
}

function scrollUp() {
  const container = findScrollableContainer();
  if (container) {
    container.scrollBy({ top: -container.clientHeight, left: 0, behavior: "smooth" });
    console.log("Scrolled up container");
  } else {
    window.scrollBy({ top: -window.innerHeight, left: 0, behavior: "smooth" });
    console.log("Scrolled up window");
  }
}

function scrollRight() {
  const container = findScrollableContainer();
  if (container) {
    container.scrollBy({ top: 0, left: container.clientWidth, behavior: "smooth" });
    console.log("Scrolled right container");
  } else {
    window.scrollBy({ top: 0, left: window.innerWidth, behavior: "smooth" });
    console.log("Scrolled right window");
  }
}

function scrollLeft() {
  const container = findScrollableContainer();
  if (container) {
    container.scrollBy({ top: 0, left: -container.clientWidth, behavior: "smooth" });
    console.log("Scrolled left container");
  } else {
    window.scrollBy({ top: 0, left: -window.innerWidth, behavior: "smooth" });
    console.log("Scrolled left window");
  }
}

// ===================
// Zoom Functions (unchanged)
// ===================
function zoomIn() {
  currentZoom += 0.1;
  document.body.style.zoom = currentZoom;
  console.log("Zoomed in, current zoom:", currentZoom);
}

function zoomOut() {
  currentZoom = Math.max(0.1, currentZoom - 0.1);
  document.body.style.zoom = currentZoom;
  console.log("Zoomed out, current zoom:", currentZoom);
}

// ===================
// Screenshot Function (unchanged)
// ===================
function takeScreenshot() {
  html2canvas(document.body).then(function(canvas) {
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgData;
    link.download = "screenshot.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("Screenshot taken and downloaded!");
  }).catch(function(err) {
    console.error("Error taking screenshot:", err);
  });
}

// ===================
// Endpoint Search Function (unchanged)
// ===================
function goToEndpoint(keyword) {
  keyword = preprocessString(keyword);
  const anchors = document.querySelectorAll("a[href]");
  let bestCandidate = { element: null, score: 0 };
  anchors.forEach(anchor => {
    const href = preprocessString(anchor.getAttribute("href") || "");
    const title = preprocessString(anchor.getAttribute("title") || "");
    const text = preprocessString(anchor.innerText || "");
    const scoreHref = similarity(href, keyword);
    const scoreTitle = similarity(title, keyword);
    const scoreText = similarity(text, keyword);
    const score = Math.max(scoreHref, scoreTitle, scoreText);
    if (score > bestCandidate.score) {
      bestCandidate = { element: anchor, score: score };
    }
  });
  if (bestCandidate.score >= 0.6 && bestCandidate.element) {
    console.log("Endpoint: Clicking element with score:", bestCandidate.score, bestCandidate.element);
    bestCandidate.element.click();
  } else {
    console.log("Endpoint: No matching endpoint found for:", keyword);
  }
}

// ===================
// Speech Recognition & Floating Key Setup (unchanged)
// ===================
async function initContentScript() {
  console.log("Content script loaded!");

  let say = await fetch("http://localhost:3000/toggle");
  let do_1 = await say.json();
  let do_2 = do_1.content;
  console.log("have to do the task : ", do_2);
      
  if(do_2 === true) {
    let str = do_1.transcript;
    run_it(str);
  }
  
  // If we previously set extensionClicked to 'true', keep it that way
  if (sessionStorage.getItem("extensionClicked") === "true") {
    extensionClicked = true;
    checkPopupStatus();
  }
  
  // Always create the floating key for voice recognition
  createFloatingKey();
  
  // Set instructions as accepted so popup never shows
  sessionStorage.setItem("instructionsAccepted", "true");
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.event === "create-popup") {
      extensionClicked = true;
      sessionStorage.setItem("extensionClicked", "true");
      checkPopupStatus();
    }
  });
}

function createFloatingKey() {
  // Always create the floating key regardless of session storage
  if (document.getElementById("brain-floating-key-container")) return;
  
  console.log("Creating floating key for voice control");
  
  const container = document.createElement("div");
  container.id = "brain-floating-key-container";
  document.body.appendChild(container);
  
  const floatingKey = document.createElement("button");
  floatingKey.className = "brain-voice-btn";
  floatingKey.style.cssText = "left: 20px; right: auto;";
  
  // Replace mic symbol with icon16.png
  const iconImg = document.createElement("img");
  iconImg.src = chrome.runtime.getURL("assets/icon16.png");
  iconImg.alt = "Brain AI";
  iconImg.style.width = "20px";
  iconImg.style.height = "20px";
  floatingKey.appendChild(iconImg);
  
  container.appendChild(floatingKey);
  
  const voiceOutput = document.createElement("div");
  voiceOutput.id = "brain-voice-output";
  voiceOutput.style.cssText = `
    position: fixed;
    top: 80px;
    left: 10px;
    background: rgba(0, 0, 0, 0.4);
    padding: 10px;
    border-radius: 5px;
    max-width: 300px;
    font-size: 14px;
    font-weight: bold;
    background-image: linear-gradient(45deg, red, orange, black, green, blue, indigo, violet);
    background-size: 400% 400%;
    -webkit-background-clip: text;
    color: transparent;
    animation: rainbowAnimation 5s linear infinite;
  `;
  voiceOutput.textContent = "Press 'A' key to speak";
  container.appendChild(voiceOutput);
  
  const style = document.createElement("style");
  style.textContent = `
    @keyframes rainbowAnimation {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;
  document.head.appendChild(style);
  
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    console.error("Voice recognition not supported in this browser");
    voiceOutput.textContent = "Voice recognition not supported in this browser";
    return;
  }
  
  console.log("Speech recognition is supported in this browser");
  
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  let recognizing = false;
  let transcript = "";
  let keyPressStartTime = 0;
  let silenceTimer = null;
  let lastResultTimestamp = 0;
  
  // Function to detect speech silence and process command
  function detectSilence() {
    const now = Date.now();
    const silenceThreshold = 3000; // Increased from 1000ms to 3000ms (3 seconds of silence)
    
    // Only process if we have received some speech and then had silence
    if (transcript.trim() && now - lastResultTimestamp > silenceThreshold && recognizing) {
      console.log("Silence detected - processing command automatically");
      voiceOutput.textContent = "Processing: " + transcript;
      
      try {
        recognition.stop();
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
      
      recognizing = false;
      floatingKey.classList.remove("brain-active");
      
      if (transcript.trim()) {
        // Process the voice command immediately without setTimeout
        processDOMWithSpeech(transcript.trim());
      }
    } else if (recognizing && now - lastResultTimestamp > 10000 && !transcript.trim()) {
      // If no speech detected for 10 seconds and transcript is empty, don't stop but show a hint
      voiceOutput.textContent = "Listening... (say something or tap microphone to stop)";
    }
  }
  
  // Add continuous mode toggle
  let continuousMode = false;
  
  // Create continuous mode toggle button
  const modeSwitcher = document.createElement("button");
  modeSwitcher.className = "brain-mode-switch";
  modeSwitcher.style.cssText = `
    position: fixed;
    top: 20px;
    left: 90px;
    width: 30px;
    height: 30px;
    background: ${continuousMode ? '#4CAF50' : '#ff5722'};
    color: white;
    font-size: 14px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 5px rgba(0,0,0,0.3);
    cursor: pointer;
    z-index: 10000;
  `;
  modeSwitcher.textContent = "🔄";
  modeSwitcher.title = "Toggle continuous mode";
  
  // Add toggle functionality
  modeSwitcher.addEventListener("click", () => {
    continuousMode = !continuousMode;
    modeSwitcher.style.background = continuousMode ? '#4CAF50' : '#ff5722';
    voiceOutput.textContent = continuousMode ? 
      "Continuous mode ON (will keep listening)" : 
      "Standard mode (stops after silence)";
    
    // In continuous mode, restart recognition if it had stopped
    if (continuousMode && !recognizing) {
      try {
        recognition.start();
        recognizing = true;
        floatingKey.classList.add("brain-active");
      } catch (err) {
        console.error("Error starting continuous recognition:", err);
      }
    }
  });

  // Add the button to the container
  container.appendChild(modeSwitcher);

  recognition.onstart = () => {
    console.log("Voice recognition started");
    voiceOutput.textContent = continuousMode ? 
      "Listening continuously..." : 
      "Listening...";
    lastResultTimestamp = Date.now();
    
    // Check for silence less frequently to reduce CPU usage
    if (silenceTimer) {
      clearInterval(silenceTimer);
    }
    silenceTimer = setInterval(detectSilence, 500);
  };
  
  recognition.onresult = (event) => {
    console.log("Got voice recognition result", event);
    lastResultTimestamp = Date.now(); // Update timestamp when speech is detected
    
    // Get the most recent result
    const latestResult = event.results[event.results.length - 1];
    const newTranscript = latestResult[0].transcript;
    
    // Only update if it's a final result or we have nothing yet
    if (latestResult.isFinal || !transcript) {
      transcript = Array.from(event.results)
        .map(res => res[0].transcript)
        .join(' ');
    }
    
    voiceOutput.textContent = transcript || newTranscript;
  };
  
  recognition.onend = () => {
    console.log("Voice recognition ended");
    if (silenceTimer) {
      clearInterval(silenceTimer);
      silenceTimer = null;
    }
    
    // If in continuous mode, restart recognition automatically
    if (continuousMode) {
      try {
        // Small delay to prevent rapid restarts
        setTimeout(() => {
          if (continuousMode) {
            recognition.start();
            console.log("Restarted recognition in continuous mode");
          }
        }, 300);
        return; // Skip the rest in continuous mode
      } catch (err) {
        console.error("Error restarting recognition:", err);
        continuousMode = false; // Disable continuous mode on error
        modeSwitcher.style.background = '#ff5722';
      }
    }
    
    // Standard mode ending behavior
    if (recognizing) {
      recognizing = false;
      floatingKey.classList.remove("brain-active");
      
      if (transcript.trim()) {
        voiceOutput.textContent = "Processing: " + transcript;
        processDOMWithSpeech(transcript.trim());
      }
    }
  };
  
  recognition.onerror = (event) => {
    console.error("Recognition error:", event.error);
    
    // Handle different error types
    if (event.error === 'no-speech') {
      voiceOutput.textContent = "No speech detected. Please try again.";
    } else if (event.error === 'aborted') {
      voiceOutput.textContent = "Recognition was aborted";
    } else if (event.error === 'network') {
      voiceOutput.textContent = "Network error. Please check your connection.";
    } else if (event.error === 'not-allowed') {
      voiceOutput.textContent = "Microphone access denied. Please allow mic access.";
    } else {
      voiceOutput.textContent = "Error: " + event.error;
    }
    
    if (silenceTimer) {
      clearInterval(silenceTimer);
      silenceTimer = null;
    }
    
    // Try to restart in continuous mode after errors
    if (continuousMode) {
      setTimeout(() => {
        try {
          if (continuousMode && !recognizing) {
            recognition.start();
            recognizing = true;
            floatingKey.classList.add("brain-active");
          }
        } catch (err) {
          console.error("Failed to restart after error:", err);
          continuousMode = false;
          modeSwitcher.style.background = '#ff5722';
        }
      }, 1000);
    }
  };
  
  // Add click handler to the floating button as an alternative to keyboard
  floatingKey.addEventListener("click", () => {
    if (!recognizing) {
      try {
        recognition.start();
        recognizing = true;
        floatingKey.classList.add("brain-active");
        voiceOutput.textContent = continuousMode ? 
          "Listening continuously..." : 
          "Listening...";
      } catch (err) {
        console.error("Speech recognition start error:", err);
        voiceOutput.textContent = "Error starting recognition";
      }
    } else {
      try {
        if (silenceTimer) {
          clearInterval(silenceTimer);
          silenceTimer = null;
        }
        continuousMode = false; // Turn off continuous mode when manually stopped
        modeSwitcher.style.background = '#ff5722';
        recognition.stop();
        recognizing = false;
        floatingKey.classList.remove("brain-active");
        
        if (transcript.trim()) {
          processDOMWithSpeech(transcript.trim());
        }
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
    }
  });
  
  // Document-wide keydown event for 'A' key
  document.addEventListener("keydown", (e) => {
    console.log("Key pressed:", e.key);
    if (e.repeat) return;
    if (e.key.toLowerCase() === "a" && !recognizing) {
      keyPressStartTime = Date.now();
      // Reset transcript
      transcript = "";
      try {
        recognition.start();
        recognizing = true;
        floatingKey.classList.add("brain-active");
        voiceOutput.textContent = "Listening...";
      } catch (err) {
        console.error("Speech recognition start error:", err);
        voiceOutput.textContent = "Error starting recognition";
      }
    }
  });

  // Stop recording on keyup
  document.addEventListener("keyup", (e) => {
    console.log("Key released:", e.key);
    if (e.key.toLowerCase() === "a" && recognizing) {
      const holdDuration = Date.now() - keyPressStartTime;
      const MIN_HOLD_DURATION = 300; // 300ms threshold
      if (holdDuration < MIN_HOLD_DURATION) {
        try {
          if (silenceTimer) {
            clearInterval(silenceTimer);
            silenceTimer = null;
          }
          recognition.abort();
          voiceOutput.textContent = "Cancelled (too short)";
        } catch (err) {
          console.error("Error aborting recognition:", err);
        }
        recognizing = false;
        floatingKey.classList.remove("brain-active");
        return;
      }
      try {
        if (silenceTimer) {
          clearInterval(silenceTimer);
          silenceTimer = null;
        }
        recognition.stop();
        voiceOutput.textContent = "Processing: " + transcript;
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
      recognizing = false;
      floatingKey.classList.remove("brain-active");
      
      if (transcript.trim()) {
        // Process the voice command immediately
        processDOMWithSpeech(transcript.trim());
      }
    }
  });
  
  console.log("Voice recognition initialized and ready to use");
}

// ===================
// Function to show instructions modal
// ===================
function showInstructionsModal() {
  const modal = document.createElement('div');
  modal.id = 'instructions-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 20px; border-radius: 12px; max-width: 500px; max-height: 500px; text-align: center; box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.2);';
  
  modalContent.innerHTML = `<div style="
    background: linear-gradient(135deg, #4a90e2, #9013fe); /* Modern gradient */
    border: 2px solid #ddd;
    border-radius: 15px;
    padding: 16px;
    font-family: 'Georgia', serif;
    max-width: 450px;
    color: white;
    box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.3);
  ">
    <p style="margin-top: 0; font-weight: bold; font-size: 1.2em;">
      Please read these instructions carefully
    </p>
    <h4 style="
      margin-bottom: 10px;
      margin-top: 10px;
      font-size: 1.4em;
      color: #ffcc00; /* Gold for contrast */
    ">
      Voice Command Actions:
    </h4>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.5; list-style-type: square;">
      <li style="margin-bottom: 10px;">
        <p>User can scroll, zoom, start/stop voice, navigate pages using voice commands.</p>
      </li>
      <li style="margin-bottom: 10px;">
        <p>Say <span style="color:gold; font-weight:bold;">"Find"</span> followed by the Finder name to locate an element.</p>
      </li>
      <li style="margin-bottom: 10px;">
        <p>Say <span style="color:gold; font-weight:bold;">"TakeScreenshot"</span> to capture the page.</p>
      </li>
      <li style="margin-bottom: 10px;">
        <p>Say <span style="color:gold; font-weight:bold;">"Click"</span> followed by the element name to interact.</p>
      </li>
    </ul>
    <p style="color: yellow; font-weight: bold;">Hold 'A' to start recording voice commands.</p>
    <p style="color: yellow; font-weight: bold;">Release 'A' to process the command.</p>
    <p style="color: yellow; font-weight: bold;">Hold for one second, speak, then wait a second before releasing.</p>
    <p style="font-size: 0.9em; opacity: 0.8;">(If voice isn't working, refresh the page and try again.)</p>
  </div>`;
  
  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.style.cssText = 'margin-top: 20px;';
  okButton.onclick = function() {
    modal.remove();
    sessionStorage.setItem("instructionsAccepted", "true");
    createFloatingKey();
  };
  
  modalContent.appendChild(okButton);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// ===================
// checkPopupStatus
// ===================
async function checkPopupStatus() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "should-i-pop" }, resolve);
    });
    needPopup = response?.message === "yes";
    if (sessionStorage.getItem("floatingBallVisible") === "true") {
      needPopup = true;
    }
    const container = document.getElementById("brain-floating-key-container");
    
    // If extension was clicked, we never remove the floating ball.
    // So it persists across navigation and refresh.
    if (needPopup && !popupon && extensionClicked) {
      popupon = true;
      // Always skip the instructions modal
      createFloatingKey();
    } 
    else if (!needPopup && popupon && !extensionClicked) {
      popupon = false;
      container?.remove();
    }
  } catch (error) {
    console.error("Popup check error:", error);
  }
}

// ===================
// Process DOM Commands Based on Voice Input
// ===================
async function processDOMWithSpeech(target) {
  console.log("Processing target:", target);
  if (!target) return;
  const lowerTarget = target.toLowerCase();
  
  // Common commands that don't need API processing
  if (lowerTarget.includes("scroll down") || lowerTarget.includes("roll down") ||
      lowerTarget.includes("down") || lowerTarget.includes("move down") || lowerTarget.includes("call down")) {
    scrollDown();
    return;
  } else if (lowerTarget.includes("scroll up") || lowerTarget.includes("roll up") ||
             lowerTarget.includes("up") || lowerTarget.includes("move up") || lowerTarget.includes("call up")) {
    scrollUp();
    return;
  } else if (lowerTarget.includes("scroll right") || lowerTarget.includes("roll right") ||
             lowerTarget.includes("right") || lowerTarget.includes("move right") || lowerTarget.includes("call right")) {
    scrollRight();
    return;
  } else if (lowerTarget.includes("scroll left") || lowerTarget.includes("roll left") ||
             lowerTarget.includes("left") || lowerTarget.includes("move left") || lowerTarget.includes("call left")) {
    scrollLeft();
    return;
  } else if (lowerTarget.includes("zoom in") || lowerTarget.includes("zoomin") ||
             lowerTarget.includes("jhoom in") || lowerTarget.includes("zoomIn") || lowerTarget.includes("room ain")) {
    zoomIn();
    return;
  } else if (lowerTarget.includes("zoom out") || lowerTarget.includes("zoomout") ||
             lowerTarget.includes("jhoom out") || lowerTarget.includes("zoomOut") || lowerTarget.includes("room out")) {
    zoomOut();
    return;
  } else if (lowerTarget.includes("screenshot") || lowerTarget.includes("takeScreenshot") ||
             lowerTarget.includes("captureScreenshot") || lowerTarget.includes("capture screen")) {
    takeScreenshot();
    return;
  } else if (lowerTarget.includes("click") || lowerTarget.includes("press") || lowerTarget.includes("tap")) {
    simulateClick(lowerTarget);
    return;
  } else if (lowerTarget.includes("profile")) {
    goToEndpoint("profile");
    return;
  }
  else if (lowerTarget.includes("go back")) {
    history.back();
    return;
  } else if (lowerTarget.includes("go front") || lowerTarget.includes("go forward")) {
    history.forward();
    return;
  }
  else if (lowerTarget.includes("stop voice") || lowerTarget.includes("close voice")) {
    sessionStorage.setItem("floatingBallVisible", "false");
    let container = document.getElementById("brain-floating-key-container");
    if (container) {
      container.style.display = "none";
      console.log("Floating ball hidden as per voice command");
    }
    return;
  } else if (lowerTarget.includes("start voice") || lowerTarget.includes("open voice")) {
    sessionStorage.setItem("floatingBallVisible", "true");
    let container = document.getElementById("brain-floating-key-container");
    if (container) {
      container.style.display = "";
      console.log("Floating ball shown as per voice command");
    } else {
      createFloatingKey();
      console.log("Floating ball created as per voice command");
    }
    return;
  }

  // Check command cache before making API call
  if (commandCache.has(lowerTarget)) {
    console.log("Using cached command result for:", lowerTarget);
    const cachedResult = commandCache.get(lowerTarget);
    handleCommandResult(cachedResult, lowerTarget);
    return;
  }
  
  // Process through API if command not recognized locally
  await processVoiceCommand(target);
}

// Helper function to handle command results
function handleCommandResult(result, transcript) {
  if (result.key === 1) {
    // Personal query/chat response - handle appropriately
    console.log("Personal query result:", result);
  } else if (result.key === 2 || result.key === 3) {
    // DOM or endpoint navigation
    // Handle appropriately
    console.log("Navigation result:", result);
  }
}

// ===================
// Process Voice Command via API Call (Tagger)
// ===================
async function processVoiceCommand(transcript) {
  console.log("Voice command:", transcript);
  let obj;
  
  try {
    // Show processing indicator
    const voiceOutput = document.getElementById("brain-voice-output");
    if (voiceOutput) {
      voiceOutput.textContent = "Processing command...";
    }
    
    // Use faster approach for common click commands
    const lowerTranscript = transcript.toLowerCase();
    if (lowerTranscript.startsWith("find ") || lowerTranscript.startsWith("search ")) {
      // Fast-track for find/search commands - assume key 3
      obj = { key: 3 };
    } else if (lowerTranscript.includes("click ") || lowerTranscript.includes("press ")) {
      // Fast-track for click commands that weren't handled by simulateClick - assume key 2
      const element = lowerTranscript.replace(/click|press/gi, "").trim();
      simulateClick("click " + element);
      return;
    } else {
      // For other commands, call the API
      const response = await fetch("http://localhost:3000/get-groq-chat-completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          key: 0,
          messages: [
            { role: "user", content: `
              <output format : {"key" : <number>} and no replies , only that object</output format>
              <prompt>: ${transcript}:</prompt>
                  <.................../very important points to persist over the entire request.................>
                  <response should never contain a reply to the user , only tags are supposed to be sent >
                  <the tags sent should be enclosed with <ans> (tag object) </ans> tags>
                  <.................../very important points to persist over the entire request.................>
                  <core point> This is going to be a prompt refiner that gives only the refined prompt only with zero extra text so that that can be directly feed to the ai for the process specified down and <must><must>work like llama-3.3-70b-specdec</must></must></core point>  
                  
                  <in short>: if the query is based on personal stuff or any unrelated query or any random stuff than the website then its key is 1 and if the query that can be done within the current dom then key it as 2 and if it is the query that can be processed by going through all end points connected to the dom will be keyed 3 if not falls or invalid on any category put it in key 7>
                  <user was told that including "find" will be a best practice for across dom process such as key 3 and "this" for same page process such as key 2 this will not work all time>
                  <Important note> I want you to refine the prompt to send it the ai, that is "tagger" works with the below specified principle </important note>
                  <principle of the tagger>
                  ......<very important note> ........
                  make sure you extract only the necessary data from the prompt and neglect the nouns like "for me" "for him" "please" and etc and process only the command
                  and work accordingly, i expect high precesion and very high acceptance and take a little time and do it.
                  ........<importtant note> ........
                  example of how i want :
                  <user ask>: "can you please tell me the weather"
                  <actual answer i want you to return>: {"key": 1}
                  <user ask>: can you please summarise the web for me 
                  <actual answer i want you to return>: {"key": 2}
                  <user ask>: "could you please find me the menu"
                  <actual answer i want you to return>: {"key": 3}
                  <user ask>: "give me the location of login page"
                  <actual answer i want you to return>: {"key": 3}
                  <user ask>: "what is the weather like today"
                  <actual answer i want you to return>: {"key": 1}
                  <user ask>: "Hope you can hear me well, so kindly reply me with something."
                  <actual answer>: {"key": 1}
                  <user ask>: "See how finding it is."
                  <actual answer i want you to return>: {"key": 1}
                  ...........<pounts to ponder>.....................
                  if a user asks for something that can be done just by iterating the current dom only and using ai by sending the dom means the ask of the user can be done there itself no need of endpoint navigation then key it as 2, 
                  this API call is for tagging purposes only, what you will be returning is going to be a json like stringified object enclosed with "" nothing else.
                  there are only three tags and an instruction.
                  the instruction would be, if a very unrelated query or any persional query or that is off the website scope like <how are you, or something else like that> you have to answer normally as you do and return {"key": 1}.
                  if the user said some actions that can be done within the page where they are actualy in, you have to return {"key": 2}
                  if any other querry return {"key": 3}
                  another very important note, your output should contain only {"key": <number>} and nothing else. like zero extra text, i want only that object. unless it is a very unrelated querry like i mentioned above. there you can reply normally and return 1 as key.
                  do well
                  ..............<extra>........................
                  .............<WHAT AI IS USED FOR>.............
                  you are going to work as a tagger for now, the tag you provide will be given to an extension that would do some flow changes with it, so act accordingly.
                  .............<goal of the project>..................
                  this is an extension which will be used for navigation purposes, the biggest achievement that this extension has to achieve is: if user said <"give me the menu of this hotel"> that voice will be converted to text (already done and that's how you received it) and have to tag his query <what this call meant for> and has to navigate to the menu that can be in any form such as <a href="menu.html"> or <a id="menu"> or <a class="menu"> or any other form and has to click on that or any type of span/div that has some text or table or svgs etc. (can be any element that HTML has).
                  </principle of the tagger>`
            }]
            })
          });
      

      
      const candidateText = await response.text();
      console.log("Gemini candidate text:", candidateText);
      

      function parseJsonResponse(input) {
        let cleaned = "";
        // Use a for loop to remove all backtick characters.
        for (let i = 0; i < input.length; i++) {
          if (input[i] !== "`") {
            cleaned += input[i];
          }
        }
        // Trim whitespace.
        cleaned = cleaned.trim();
        // If the cleaned text starts with "json" (case-insensitive), remove it.
        const lowerCleaned = cleaned.toLowerCase();
        if (lowerCleaned.startsWith("json")) {
          cleaned = cleaned.substring(4);
        }
        // Final trim and parse the JSON.
        return JSON.parse(cleaned.trim());
      }
      
      
      
      
      try {
        obj = JSON.parse(candidateText);
      } catch (parseError) {
        obj = parseJsonResponse(candidateText);
      }

      console.log("Parsed object:", obj);
      
      // Cache the result for future use
      if (obj && obj.key) {
        commandCache.set(transcript.toLowerCase(), obj);
        // Limit cache size to prevent memory issues
        if (commandCache.size > 50) {
          // Remove oldest entry
          const firstKey = commandCache.keys().next().value;
          commandCache.delete(firstKey);
        }
      }
    }

  } catch (error) {
    console.error("Error parsing extracted JSON:", error);
    return;
  }
      
  // Process the result based on the key
  if (obj.key === 1) {
    const response1 = await fetch("http://localhost:3000/get-groq-chat-completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: 0,
        messages: [
          { role: "user", content: `<prompt>: ${transcript}:</prompt>
          <prompt to persist over the entire chat and very important> must contain only plain texts no special designing like bold , increasing font size coloring avoid all of them just respond with a plain text</prompt to persist over the entire chat and very important>
            <reply normaly but friendly> should not contain any bold texts     
          `
          }]
          })
        });

        const candidateText = await response1.text();
        console.log("Gemini candidate text:", candidateText);
  }

  if (obj.key === 2 || obj.key === 3) {
    // Process endpoint navigation command fast
    processEndpointNavigation(transcript, obj.key);
  }
}

// Separate function for endpoint navigation to make code cleaner
async function processEndpointNavigation(transcript, keyType) {
  // A Set to store unique URLs.
  const urls = new Set();

  // Helper function: Check if a URL is from the same origin.
  function isSameOrigin(urlStr) {
    try {
      const url = new URL(urlStr, window.location.href);
      return url.origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  // Process anchor elements (<a href="...">).
  document.querySelectorAll("a[href]").forEach(a => {
    const href = a.href;
    if (isSameOrigin(href)) {
      urls.add(href);
    }
  });

  // Only process these if needed
  if (urls.size < 10) {
    // Process form elements (<form action="...">).
    document.querySelectorAll("form[action]").forEach(form => {
      const action = form.getAttribute("action");
      try {
        const url = new URL(action, window.location.href).href;
        if (isSameOrigin(url)) {
          urls.add(url);
        }
      } catch (e) {
        // Invalid URL; skip it.
      }
    });
  }

  // Convert the Set to an array
  const endpoints = {end: Array.from(urls)};
  console.log("Endpoints connected to this website:", endpoints.end);

  if (endpoints.end.length === 0) {
    console.log("No endpoints found - trying click instead");
    simulateClick("click " + transcript.replace("find", "").trim());
    return;
  }

  try {
    // Faster endpoint parsing
    const lowerTranscript = transcript.toLowerCase();
    let bestIndex = -1;
    let bestScore = 0;
    
    // Manual search for better performance
    for (let i = 0; i < endpoints.end.length; i++) {
      const url = endpoints.end[i].toLowerCase();
      const urlParts = url.split(/[\/\-_?&#.]/);
      
      // Check each part of the URL for a match
      for (const part of urlParts) {
        const score = similarity(part, lowerTranscript.replace("find", "").trim());
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
    }
    
    // If good match found, navigate directly
    if (bestScore > 0.6 && bestIndex !== -1) {
      console.log("Found matching endpoint with score:", bestScore);
      
      // Set toggle state
      fetch("http://localhost:3000/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: "user", content: true, content2: transcript
        })
      });
      
      // Navigate
      window.location.href = endpoints.end[bestIndex];
      return;
    }
    
    // If no good match, use API for better matching
    const response1 = await fetch("http://localhost:3000/get-groq-chat-completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: 0,
        messages: [
          { role: "user", content: `
            try searching for the exact words that may appear in any of the index of the array , look for that most.
            <output format > the out put should contain only a object like {"index" : <index value of the given aray>} nothing else , no replies and etc , only that object </oytput format>
            find the matching words from url and the word that followed by "find" rank each url and find the best matching url and give its index in output as mentioned in output formating
            consider relative words and parent children words for more effeciency and accuracy
            avoid if lot of numbers in urls

            <transcript> ${transcript} and <endpoints> ${endpoints.end}
          `
          }]
          })
        });

    function parseJsonResponse(input) {
      let cleaned = "";
      // Use a for loop to remove all backtick characters.
      for (let i = 0; i < input.length; i++) {
        if (input[i] !== "`") {
          cleaned += input[i];
        }
      }
      // Trim whitespace.
      cleaned = cleaned.trim();
      // If the cleaned text starts with "json" (case-insensitive), remove it.
      const lowerCleaned = cleaned.toLowerCase();
      if (lowerCleaned.startsWith("json")) {
        cleaned = cleaned.substring(4);
      }
      // Final trim and parse the JSON.
      return cleaned.trim();
    }

    const candidateText = await response1.text();
    console.log("will be best : ", JSON.parse(parseJsonResponse(candidateText)));

    let indexer = JSON.parse(parseJsonResponse(candidateText));
    console.log( endpoints.end[indexer.index]);
    
    console.log("indexer : ", endpoints.end[indexer.index]);

    // Set toggle state and navigate
    fetch("http://localhost:3000/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role: "user", content: true, content2: transcript
      })
    });
    
    window.location.href = `${endpoints.end[indexer.index]}`;
    
  } catch (error) {
    console.error("Error during endpoint navigation:", error);
    
    // Fallback to click if navigation fails
    simulateClick("click " + transcript.replace("find", "").trim());
  }
}

async function run_it(transcript)
{
  console.log("done and dusted ");
}

// Add message event listener for debugging messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  
  if (message.event === "create-popup") {
    console.log("Create popup message received");
    createFloatingKey();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.event === "reload-extension") {
    console.log("Reload extension message received");
    initContentScript();
    sendResponse({ success: true, message: "Extension reloaded" });
    return true;
  }
  
  if (message.event === "ping") {
    console.log("Ping received");
    sendResponse({ success: true, message: "Content script is active" });
    return true;
  }
  
  return false;
});

let commandCache = new Map(); // Cache for recently processed commands