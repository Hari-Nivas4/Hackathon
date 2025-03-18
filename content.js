// Inject the provided CSS with "brain" prefixed class names
(function injectCSS() {
  const css = `
/* Container for the floating key */
#brain-floating-key-container {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  pointer-events: none; /* Ensures container doesn’t block page events */
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
  pointer-events: auto; /* Allows the button to be clickable */
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
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();


let popupon = false;
let needPopup = false;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContentScript);
} else {
  initContentScript();
}

async function update_dom(){
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: "dom-updation",
      message: `${document.documentElement.innerHTML}`
    }, resolve);
  });
  if(response && response.ok) {
    console.log(response.message);
  }
}

function handleNavigationChange() {
  console.log("Navigation detected!");
  console.log(window.location.href);
  (async () => {
    await checkPopupStatus();
  })();
}

// 1. Detect page show (fires on load, refresh, back/forward including from bfcache)
window.addEventListener("pageshow", handleNavigationChange);
// 2. Detect hash changes (when URL fragment changes)
window.addEventListener("hashchange", handleNavigationChange);
// 3. Detect back/forward navigation
window.addEventListener("popstate", handleNavigationChange);
// 4. Override pushState and replaceState to capture programmatic URL changes
(function () {
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

  // Also trigger on initial page load
  window.addEventListener("load", handleNavigationChange);
})();

// 5. As a backup, use a MutationObserver to detect any URL change
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  (async () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handleNavigationChange();
    }
  })();
});
observer.observe(document.body, { childList: true, subtree: true });

async function initContentScript() {
  console.log("Content script loaded!");
  await checkPopupStatus();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.event === "create-popup") {
      if (!popupon) {
        chrome.runtime.sendMessage({ action: "create-popup1" });
        popupon = true;
        createFloatingKey();
        needPopup = true;
      }
    }
  });
}

/* ---------------- REPLACED FUNCTION ---------------- */
// Instead of creating a floating chat window with mic functionality,
// we create a floating key (ball) inside its own container with "brain" prefixed classes.
function createFloatingKey() {
  // Avoid duplicating the key
  if (document.getElementById("brain-floating-key")) {
    return;
  }
  // Create a container for the ball
  let container = document.createElement("div");
  container.id = "brain-floating-key-container";
  document.body.appendChild(container);

  // Create the floating key (ball) using the provided CSS class
  let floatingKey = document.createElement("button");
  floatingKey.id = "brain-floating-key";
  floatingKey.className = "brain-voice-btn";
  // No inner content per instructions
  floatingKey.innerHTML = "";
  container.appendChild(floatingKey);

  // Optional: add a click listener to log a message
  floatingKey.addEventListener("click", function() {
    console.log("Floating key clicked");
  });
}

async function checkPopupStatus() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "should-i-pop" }, resolve);
    });

    console.log(`here with ${JSON.stringify(response)}`);

    if (response && response.ok) {
      needPopup = response.message === "yes";
      if (needPopup && !popupon) {
        popupon = true;
        createFloatingKey();
      } else {
        if (needPopup === false) {
          let container = document.getElementById("brain-floating-key-container");
          popupon = false;
          if (container) {
            container.remove();
          } else {
            console.warn("Floating key container not found. Nothing to remove.");
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking popup status:", error);
  }
}
