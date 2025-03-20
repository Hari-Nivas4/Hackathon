// ===================
// CSS Injection
// ===================
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

// ===================
// Global Variables & Initialization
// ===================
let popupon = false;
let needPopup = false;
const SUBMIT_ENDPOINT = "http://localhost:3000/submit-element";
let currentZoom = 1; // Global zoom level variable
// Instead of a volatile variable, store extension click flag in sessionStorage
if (!sessionStorage.getItem("extensionClicked")) {
  sessionStorage.setItem("extensionClicked", "false");
}

// NEW: Global array to store labeled media elements mapping
let labeledMediaElements = [];

// NEW: Set persistent flag if not already set (default: true)
if (sessionStorage.getItem("floatingBallVisible") === null) {
  sessionStorage.setItem("floatingBallVisible", "true");
}

// Do not trigger popup on login; wait for extension click.
if (document.readyState === "loading") {
  console.log("here");
  document.addEventListener("DOMContentLoaded", initContentScript);
} else {
  console.log("here");
  initContentScript();
}

// ===================
// Navigation & History Overrides
// ===================
function handleNavigationChange() {
  console.log("Navigation detected!", window.location.href);
  // On navigation, if extension was clicked, re-run our popup and labeling logic.
  if (sessionStorage.getItem("extensionClicked") === "true") {
    checkPopupStatus();
    labelMediaElements();
  }
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

// ===================
// New Helper Functions for Click Simulation
// ===================
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

// NEW: Helper to convert common number words to digits.
function convertWordToNumber(word) {
  const mapping = {
    "one": "1",
    "two": "2",
    "three": "3",
    "four": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8",
    "nine": "9",
    "ten": "10"
  };
  return mapping[word.toLowerCase()] || word;
}

function simulateClick(target) {
  // Check if command contains a numbered media element.
  let numMatch = target.toLowerCase().match(/click number (\w+)/);
  if (numMatch) {
    let numStr = convertWordToNumber(numMatch[1]);
    const num = parseInt(numStr);
    if (!isNaN(num)) {
      const mediaObj = labeledMediaElements.find(item => item.number === num);
      if (mediaObj && mediaObj.element) {
        console.log("Clicking labeled media element number", num, mediaObj.element);
        mediaObj.element.click();
        return;
      }
    }
  }
  
  // Default click simulation for other elements.
  const rawKeyword = target.replace(/click|press|tap/gi, "").trim();
  const keyword = preprocessString(rawKeyword);
  if (!keyword) {
    console.log("No target keyword provided for click");
    return;
  }
  const clickableSelectors = "a, button, input, div, span";
  const elements = document.querySelectorAll(clickableSelectors);
  let bestMatch = { element: null, score: 0 };
  elements.forEach((element) => {
    if (!element.offsetParent) return;
    const computed = window.getComputedStyle(element);
    const hasPointer = computed.cursor && computed.cursor.includes("pointer");
    const texts = [
      preprocessString(element.innerText || ""),
      preprocessString(element.getAttribute("id") || ""),
      preprocessString(element.getAttribute("class") || "")
    ];
    texts.forEach((text) => {
      let score = similarity(keyword, text);
      if (hasPointer) {
        score += 0.1;
      }
      if (score > bestMatch.score) {
        bestMatch = { element: element, score: score };
      }
    });
  });
  if (bestMatch.score >= 0.8 && bestMatch.element) {
    console.log("Clicking element with score:", bestMatch.score, bestMatch.element);
    bestMatch.element.click();
  } else {
    console.log("No matching clickable element found with at least 80% similarity for:", keyword);
  }
}

// ===================
// Label Media Elements Function
// ===================
function labelMediaElements() {
  // Remove any previous labels.
  labeledMediaElements.forEach(item => {
    if (item.overlay && item.overlay.parentElement) {
      item.overlay.parentElement.removeChild(item.overlay);
    }
  });
  labeledMediaElements = [];
  
  let counter = 1;
  const selectors = "iframe, img, video";
  const elements = document.querySelectorAll(selectors);
  elements.forEach((element) => {
    // Label every element regardless of offsetParent.
    let overlay = document.createElement('div');
    overlay.className = 'media-label-overlay';
    overlay.textContent = counter;
    // Ensure the element has relative positioning for the overlay to attach.
    const style = window.getComputedStyle(element);
    if (style.position === 'static') {
      element.style.position = 'relative';
    }
    // Append overlay to the element's parent.
    element.parentElement.appendChild(overlay);
    labeledMediaElements.push({ number: counter, element: element, overlay: overlay });
    counter++;
  });
}

// ===================
// Scrollable Container Helper & Scroll Commands
// ===================
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
// Endpoint Search Function (for "go to" commands) (unchanged)
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
  // On load, if extension was previously clicked, re-activate the popup and label media.
  if (sessionStorage.getItem("extensionClicked") === "true") {
    checkPopupStatus();
    labelMediaElements();
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (message.event === "create-popup") {
      sessionStorage.setItem("extensionClicked", "true");
      labelMediaElements();
      checkPopupStatus();
    }
  });
}

function createFloatingKey() {
  // NEW: Only create if persistent flag is "true"
  if (sessionStorage.getItem("floatingBallVisible") !== "true") return;
  if (document.getElementById("brain-floating-key-container")) return;
  const container = document.createElement("div");
  container.id = "brain-floating-key-container";
  document.body.appendChild(container);
  const floatingKey = document.createElement("button");
  floatingKey.className = "brain-voice-btn";
  floatingKey.style.cssText = "left: 20px; right: auto;";
  floatingKey.textContent = "";
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
    console.error("Voice recognition not supported");
    return;
  }
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  let recognizing = false;
  let transcript = "";
  recognition.onresult = (event) => {
    transcript = Array.from(event.results)
      .filter(res => res.isFinal)
      .map(res => res[0].transcript)
      .join(' ');
    voiceOutput.textContent = transcript;
  };
  recognition.onerror = (event) => {
    console.error("Recognition error:", event.error);
  };
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key.toLowerCase() === "a" && !recognizing) {
      transcript = "";
      try {
        recognition.start();
        recognizing = true;
        floatingKey.classList.add("brain-active");
      } catch (err) {
        console.error("Speech recognition start error:", err);
      }
    }
  });
  document.addEventListener("keyup", async (e) => {
    if (e.key.toLowerCase() === "a" && recognizing) {
      recognition.stop();
      recognizing = false;
      floatingKey.classList.remove("brain-active");
      setTimeout(() => processDOMWithSpeech(transcript.trim()), 50);
    }
  });
}

// ===================
// NEW: Function to show instructions modal (with cross button)
// ===================
function showInstructionsModal() {
  const modal = document.createElement('div');
  modal.id = 'instructions-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 20px; border-radius: 5px; max-width: 500px; text-align: center; position: relative;';
  // Replace the text below with your actual instructions
  modalContent.innerHTML = `<p>Please read these instructions carefully. [Your instructions here]</p>`;
  
  // Cross button to dismiss modal
  const closeButton = document.createElement('span');
  closeButton.textContent = '✕';
  closeButton.style.cssText = 'position: absolute; top: 10px; right: 10px; cursor: pointer; font-size: 18px;';
  closeButton.onclick = function() {
    modal.remove();
  };
  modalContent.appendChild(closeButton);
  
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
// Modified: checkPopupStatus function
// ===================
async function checkPopupStatus() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "should-i-pop" }, resolve);
    });
    needPopup = response?.message === "yes";
    // Force persistent floating ball if flag is "true"
    if (sessionStorage.getItem("floatingBallVisible") === "true") {
      needPopup = true;
    }
    const container = document.getElementById("brain-floating-key-container");
    // Check sessionStorage flag for extension click
    if (needPopup && !popupon && sessionStorage.getItem("extensionClicked") === "true") {
      popupon = true;
      // First, check if instructions have been accepted.
      if (sessionStorage.getItem("instructionsAccepted") !== "true") {
        showInstructionsModal();
      } else {
        createFloatingKey();
      }
    } else if (!needPopup && popupon) {
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
  
  // If the user says "click cross", trigger the close of the instructions modal.
  if (lowerTarget.includes("click cross")) {
    const closeBtn = document.querySelector('#instructions-modal span');
    if (closeBtn) {
      console.log("Clicking cross button to close instructions modal");
      closeBtn.click();
      return;
    }
  }
  
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
             lowerTarget.includes("jhoom in") || lowerTarget.includes("zoomin") || lowerTarget.includes("room ain")) {
    zoomIn();
    return;
  } else if (lowerTarget.includes("zoom out") || lowerTarget.includes("zoomout") ||
             lowerTarget.includes("jhoom out") || lowerTarget.includes("zoomout") || lowerTarget.includes("room out")) {
    zoomOut();
    return;
  } else if (lowerTarget.includes("screenshot") || lowerTarget.includes("takescreenshot") ||
             lowerTarget.includes("capturescreenshot") || lowerTarget.includes("capture screen")) {
    takeScreenshot();
    return;
  } else if (lowerTarget.includes("click") || lowerTarget.includes("press") || lowerTarget.includes("tap")) {
    simulateClick(lowerTarget);
    return;
  } else if (lowerTarget.includes("profile")) {
    goToEndpoint("profile");
    return;
  }
  // Back/forward navigation
  else if (lowerTarget.includes("go back")) {
    history.back();
    return;
  } else if (lowerTarget.includes("go front") || lowerTarget.includes("go forward")) {
    history.forward();
    return;
  }
  // Floating ball visibility control
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
  
  processVoiceCommand(target);
}

// ===================
// Process Voice Command via API Call (Tagger)
// ===================
async function processVoiceCommand(transcript) {
  console.log("Voice command:", transcript);
  
  const response = await fetch("http://localhost:3000/get-groq-chat-completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "key ": 0,
      messages: [
        { role: "user", content: `<prompt > : ${transcript} : </prompt>
          <core point> This is going to be a prompt refiner that gives only the refined prompt only with zero extra text so that that can be directly feed to the ai for the process specified down</core point>
          <Important note> I want you to refine the prompt to send it to the ai, that is "tagger", working with the following principle </important note>
          <principle of the tagger>
            ......<very important note> ........
            Make sure you extract only the necessary data from the prompt and ignore extra words like "for me", "for him", "please", etc. Process only the command.
            ........<important note> ........
            Example:
            <user ask> : "can you please tell me the weather"
            <desired output> : \`{"key" : -1}\`
            <user ask> : "can you please summarise the web for me"
            <desired output> : \`{"key" : 2}\`
            <user ask> : "could you please find me the menu"
            <desired output> : \`{"key" : 3}\`
            <user ask> : "give me the location of the login page"
            <desired output> : \`{"key" : 3}\`
            <user ask> : "what is the weather like today"
            <desired output> : \`{"key" : -1}\`
            ...........<points to ponder>.....................
            If a user asks something that can be handled within the current DOM using AI without navigation, tag it as 2.
            This API call is only for tagging purposes. Return a JSON-like string object enclosed in \` \` with no extra text.
            For off-scope queries, reply normally and return \`{"key" : -1}\`.
            Do well.
            ..............<extra>........................
            .............<WHAT AI IS USED FOR>.............
            You are working as a tagger; the tag you provide will be used by an extension for navigation.
            .............<goal of the project>..................
            This extension is used for navigation. For example, if the user says "give me the menu of this hotel," convert the voice to text (already done) and then tag the query so that it can navigate accordingly.
          </principle of the tagger>`
        }
      ]
    })
  });
  
  const data = await response.json();
  console.log(data.content);
}
