

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
  floatingKey.textContent = "🔘";
  container.appendChild(floatingKey);

  const voiceOutput = document.createElement("div");
  voiceOutput.id = "brain-voice-output";
  voiceOutput.style.cssText = `
    position: fixed; top: 100px; left: 20px;
    background: rgba(0, 0, 0, 0.7); color: white;
    padding: 10px; border-radius: 5px;
    max-width: 300px; font-size: 14px;
  `;
  container.appendChild(voiceOutput);

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
      await processDOMWithSpeech(transcript.trim());
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


async function processDOMWithSpeech(target) {
  processVoiceCommand(target);
}
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
