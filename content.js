

// Inject the provided CSS with "brain" prefixed class names
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
}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

let popupon = false;
let needPopup = false;
const SUBMIT_ENDPOINT = "http://localhost:3000/submit-element";

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

// Navigation event listeners
window.addEventListener("pageshow", handleNavigationChange);
window.addEventListener("hashchange", handleNavigationChange);
window.addEventListener("popstate", handleNavigationChange);

// History state overrides
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

// DOM MutationObserver for URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    handleNavigationChange();
  }
}).observe(document.body, { childList: true, subtree: true });

async function initContentScript() {
  console.log("Content script loaded!");
  await checkPopupStatus();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.event === "create-popup" && !popupon) {
      chrome.runtime.sendMessage({ action: "create-popup1" });
      popupon = true;
      createFloatingKey();
      needPopup = true;
    }
  });
}

function createFloatingKey() {
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
  background: rgba(0, 0, 0, 0.3);
  padding: 10px;
  border-radius: 5px;
  max-width: 300px;
  font-size: 14px;
  font-weight: bold;
  /* Set up the gradient for the text */
  background-image: linear-gradient(45deg, red, orange, black, green, blue, indigo, violet);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  color: transparent;
  animation: rainbowAnimation 5s linear infinite;
`;
container.appendChild(voiceOutput);

// Add keyframes for the rainbow animation
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

  // When the "a" key is held down, start speech recognition
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

  // When the "a" key is released, stop recognition and run the function
  document.addEventListener("keyup", async (e) => {
    if (e.key.toLowerCase() === "a" && recognizing) {
      recognition.stop();
      recognizing = false;
      floatingKey.classList.remove("brain-active");
      setTimeout(processDOMWithSpeech(transcript.trim()) , 10);
    }
  });
}

async function checkPopupStatus() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "should-i-pop" }, resolve);
    });

    needPopup = response?.message === "yes";
    const container = document.getElementById("brain-floating-key-container");

    if (needPopup && !popupon) {
      popupon = true;
      createFloatingKey();
    } else if (!needPopup && popupon) {
      popupon = false;
      container?.remove();
    }
  } catch (error) {
    console.error("Popup check error:", error);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////// Hari Nivas S/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function processDOMWithSpeech(target) {
  console.log("Processing target:", target);
  if (!target) return;
  if (target.toLowerCase().includes("scroll down") || target.toLowerCase().includes("roll down") || target.toLowerCase().includes("down") || target.toLowerCase().includes("move down") || target.toLowerCase().includes("call down")) {
    window.scrollBy({ top: window.innerHeight, left: 0, behavior: "smooth" });
    return;
  } else if (target.toLowerCase().includes("scroll up")  || target.toLowerCase().includes("roll up") || target.toLowerCase().includes("up") || target.toLowerCase().includes("move up") || target.toLowerCase().includes("call up")) {
    window.scrollBy({ top: -window.innerHeight, left: 0, behavior: "smooth" });
    return;
  }
  else if (target.toLowerCase().includes("scroll right") || target.toLowerCase().includes("roll right") || target.toLowerCase().includes("right") || target.toLowerCase().includes("move right") || target.toLowerCase().includes("call right")) {
    window.scrollBy({ top: 0, left: window.innerWidth, behavior: "smooth" });
    return;
  } else if (target.toLowerCase().includes("scroll left") || target.toLowerCase().includes("roll left") || target.toLowerCase().includes("left") || target.toLowerCase().includes("move left") || target.toLowerCase().includes("call left")) {
    window.scrollBy({ top: 0, left: -window.innerWidth, behavior: "smooth" });
    return;
  }
  processVoiceCommand(target);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function processVoiceCommand(transcript) {
  console.log("Voice command:", transcript);
  
  const transcript1 = {
    message: transcript
  };
  
  const response = await fetch("http://localhost:3000/ai-call-for-tag", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(transcript1)
  });


  const jsonData = await response.json();
  console.log(jsonData);


  console.log("is ai");

  const response1 = await fetch("http://localhost:3000/get-groq-chat-completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [
        { role: "user", content: `${transcript} just tell me something about large language models` }
      ]
    })
  });
  
  const data = await response1.json(); // Parse the response data as JSON
  console.log(data); // Log the parsed data
}
