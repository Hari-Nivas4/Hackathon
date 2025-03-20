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
  
  const selectors = "a, button, input, div, span";
  const candidates = Array.from(document.querySelectorAll(selectors));
  let overallBest = { element: null, score: 0 };
  candidates.forEach(candidate => {
    if (!candidate.offsetParent) return;
    let candidateBest = getBestMatch(candidate, keyword);
    if (candidateBest.score > overallBest.score) {
      overallBest = candidateBest;
    }
  });
  
  if (overallBest.score >= 0.8 && overallBest.element) {
    console.log("Clicking element with score:", overallBest.score, overallBest.element);
    overallBest.element.click();
    return;
  }
  
  console.log("No matching clickable element found (80%) in main approach; fallback to all elements.");
  
  let fallbackBest = { element: null, score: 0 };
  const allElements = document.querySelectorAll("*");
  allElements.forEach(elem => {
    if (!elem.offsetParent) return;
    const text = elem.innerText || "";
    const score = similarity(keyword, preprocessString(text));
    if (score > fallbackBest.score) {
      fallbackBest = { element: elem, score };
    }
  });
  
  if (fallbackBest.score >= 0.8) {
    const ancestor = findClickableAncestor(fallbackBest.element);
    if (ancestor) {
      console.log("Clicking fallback ancestor with score:", fallbackBest.score, ancestor);
      ancestor.click();
    } else {
      console.log("Found fallback text match but no clickable ancestor:", fallbackBest.element);
    }
  } else {
    console.log("No match found even in fallback approach for:", keyword);
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
      
      if(do_2 === true)
      {
        let str = do_1.transcript;
        run_it(str);
      }
  // If we previously set extensionClicked to 'true', keep it that way
  if (sessionStorage.getItem("extensionClicked") === "true") {
    extensionClicked = true;
    checkPopupStatus();
  }
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.event === "create-popup") {
      extensionClicked = true;
      sessionStorage.setItem("extensionClicked", "true");
      checkPopupStatus();
    }
  });
}

function createFloatingKey() {
  // Only create if persistent flag is "true"
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
      keyPressStartTime = Date.now();
      // Reset transcript to default message.
      transcript = " ";
      try {
        recognition.start();
        recognizing = true;
        floatingKey.classList.add("brain-active");
      } catch (err) {
        console.error("Speech recognition start error:", err);
      }
    }
  });

  // Stop recording on keyup only if the key was held for at least 300ms.
  document.addEventListener("keyup", (e) => {
    if (e.key.toLowerCase() === "a" && recognizing) {
      const holdDuration = Date.now() - keyPressStartTime;
      const MIN_HOLD_DURATION = 300; // 300ms threshold
      if (holdDuration < MIN_HOLD_DURATION) {
        try {
          recognition.abort();
        } catch (err) {
          console.error("Error aborting recognition:", err);
        }
        recognizing = false;
        floatingKey.classList.remove("brain-active");
        return;
      }
      try {
        recognition.stop();
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
      recognizing = false;
      floatingKey.classList.remove("brain-active");
      // Use setTimeout to pass a function reference.
      setTimeout(() => processDOMWithSpeech(transcript.trim()), 100);
    }
  });
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
      if (sessionStorage.getItem("instructionsAccepted") !== "true") {
        showInstructionsModal();
      } else {
        createFloatingKey();
      }
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
  
  // If the command includes "click cross" or "click cross button",
  // search for any element whose normalized text content is exactly "X" and click it.
  if (lowerTarget.includes("click cross") || lowerTarget.includes("click cross button")) {
    const crossElement = document.evaluate(
      "//*[normalize-space(text())='X']",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    if (crossElement) {
      console.log("Clicking cross element:", crossElement);
      crossElement.click();
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
  
  processVoiceCommand(target);
}

// ===================
// Process Voice Command via API Call (Tagger)
// ===================
async function processVoiceCommand(transcript) {
  console.log("Voice command:", transcript);
  let obj;
  try {
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

  }catch (error) {
    console.error("Error parsing extracted JSON:", error);
  }
    
// let obj;

  

  if(obj.key === 1){
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





    if(obj.key === 2 || obj.key === 3){

      


      (async function() {
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
      
        // Process script elements (<script src="...">).
        document.querySelectorAll("script[src]").forEach(script => {
          const src = script.src;
          if (isSameOrigin(src)) {
            urls.add(src);
          }
        });
      
        // Process link elements (<link href="...">).
        document.querySelectorAll("link[href]").forEach(link => {
          const href = link.href;
          if (isSameOrigin(href)) {
            urls.add(href);
          }
        });
      
        // Convert the Set to an array and log all unique endpoints.
     
      
      
        // Convert the Set to an array and log the unique endpoints.
        
     
      
      
        // Convert the Set to an array and log the endpoints.
        const endpoints ={end: Array.from(urls)};
        console.log("Endpoints connected to this website:", endpoints.end);


        try {
          const response = await fetch("http://localhost:3000/dom-parser", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(endpoints) // Must be a valid JSON string
          });
          const data = await response.json();
          
          let bigData = data.data;
          console.log("big Data" , bigData);
        } catch (error) {
          console.error("Error:", error);
        }
        
        
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

            const response2 = fetch("http://localhost:3000/toggle", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                
                  role: "user", content: true , content2 : transcript})
                 
                });
                window.location.href = `${endpoints.end[indexer.index]}`;
                console.log("thandeetan");

            // const response2 = await fetch("http://localhost:3000/class-adder", {
            //   method: "POST",
            //   headers: {
            //     "Content-Type": "application/json"
            //   },
            //   body: JSON.stringify({
                
            //       role: "user", content: `${endpoints.end[indexer.index]}`})
                 
            //     });


           
                

      })();
    }
}



async function run_it(transcript)
{
  // console.log("here with require" , transcript);
  // fetch("http://localhost:3000/toggle", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json"
  //   },
  //   body: JSON.stringify({
      
  //       role: "user", content: false , content2 : ""})
       
  //     });
  //     let div_numbering = 0;
  //   let allElements = document.querySelectorAll('div');
  //   allElements.forEach(element => {
  //     element.setAttribute("brain_ai_", `${div_numbering++}`);
  //    });

  //    const response7 = await fetch("http://localhost:3000/get-groq-chat-completion", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json"
  //     },
  //     body: JSON.stringify({
  //       key: 0,
  //       messages: [
  //         { role: "user", content: `
  //           <output format > the out put should contain only a object like {"index" : <index value of the given aray>} nothing else , no replies and etc , only that object and the result should be in the dom  </output format>
  //           <task > AI will be given a DOM (that has a brain_ai_ attribute on each div) and a TRANSCRIPT from user , The tas is to find a most relevant part of the DOM with the transcript <task>
  //           <most important to do : go to all elements , never leave a element , go to every element reach depth of every element and look for similarity and give marks that representing the similarity percentage between transcript and the dom given
  //           <if the element found but dont have a attribute in it so choose the nearby partner or a parent having the attribute>
  //           <element can be anything , button , div , p, iframe , svg and can be any html element , so search to all the depths of all the elements and find a right match of below bentioned quality and way >
  //           continuously evaluate the dom and get the top 20 high scorers and again compare them and agin choose the top 10, like this
  //           completely filter the webpage and choose one element .and return the <brain_ai_> attribute value like {"index" : <brain_ai_<number>} alone as output. no replies to transcript and all 
  //           <examples>
  //           user : find results 
  //           should return the brain_ai_attributes value that of a element that has a close relation with the transcript text 
  //           word matchings , meaning matchings , most importantly image matchings and etc etc .
  //           </examples>
  //         <prompt>: ${transcript}:</prompt>
  //         <dom> ${document.documentElement.innerHTML}<dom> 
  //         `
  //         }]
  //         })
  //       });

  //       function parseJsonResponse(input) {
  //         let cleaned = "";
  //         // Use a for loop to remove all backtick characters.
  //         for (let i = 0; i < input.length; i++) {
  //           if (input[i] !== "`") {
  //             cleaned += input[i];
  //           }
  //         }
  //         // Trim whitespace.
  //         cleaned = cleaned.trim();
  //         // If the cleaned text starts with "json" (case-insensitive), remove it.
  //         const lowerCleaned = cleaned.toLowerCase();
  //         if (lowerCleaned.startsWith("json")) {
  //           cleaned = cleaned.substring(4);
  //         }
  //         // Final trim and parse the JSON.
  //         return cleaned.trim();
  //       }


        
  //       const candidateText7 = await response7.text();
  //       console.log("Gemini candidate text:", candidateText7);
  //       let obk = parseJsonResponse(candidateText7);
  //       console.log(obk);
        

  //       const element = document.querySelector(`[brain_ai_${obk}]`); // Select element with attribute
  //       if (element) {
  //           element.scrollIntoView({ behavior: "smooth", block: "center" }); // Scroll to element
  //           element.focus({ preventScroll: true }); // Set focus
  //       } else {
  //           console.warn("Element with attribute 'brain_ai_1' not found.");
  //       }

        console.log("done and dusted ");
        
}


  
  // Example usage:
  
  
  // Example usage: