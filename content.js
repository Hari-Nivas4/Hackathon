

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
      setTimeout(processDOMWithSpeech(transcript.trim()) , 100);
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
////////////////////////////////// Hari Nivas S////////////////////////////////////////////////////////////////////////////////////////////////////////////////// Global zoom level variable


let currentZoom = 1; // Global zoom level variable

async function processDOMWithSpeech(target) {
  console.log("Processing target:", target);
  if (!target) return;
  const lowerTarget = target.toLowerCase(); // Define once for reuse
  
  if (
    lowerTarget.includes("scroll down") ||
    lowerTarget.includes("roll down") ||
    lowerTarget.includes("down") ||
    lowerTarget.includes("move down") ||
    lowerTarget.includes("call down")
  ) {
    window.scrollBy({ top: window.innerHeight, left: 0, behavior: "smooth" });
    return;
  } else if (
    lowerTarget.includes("scroll up") ||
    lowerTarget.includes("roll up") ||
    lowerTarget.includes("up") ||
    lowerTarget.includes("move up") ||
    lowerTarget.includes("call up")
  ) {
    window.scrollBy({ top: -window.innerHeight, left: 0, behavior: "smooth" });
    return;
  } else if (
    lowerTarget.includes("scroll right") ||
    lowerTarget.includes("roll right") ||
    lowerTarget.includes("right") ||
    lowerTarget.includes("move right") ||
    lowerTarget.includes("call right")
  ) {
    window.scrollBy({ top: 0, left: window.innerWidth, behavior: "smooth" });
    return;
  } else if (
    lowerTarget.includes("scroll left") ||
    lowerTarget.includes("roll left") ||
    lowerTarget.includes("left") ||
    lowerTarget.includes("move left") ||
    lowerTarget.includes("call left")
  ) {
    window.scrollBy({ top: 0, left: -window.innerWidth, behavior: "smooth" });
    return;
  } else if (lowerTarget.includes("zoom in") || lowerTarget.includes("zoomin") || lowerTarget.includes("jhoom in") || lowerTarget.includes("zoomIn") || lowerTarget.includes("room ain")) {
    currentZoom += 0.1;
    document.body.style.zoom = currentZoom;
    return;
  } else if (lowerTarget.includes("zoom out")  || lowerTarget.includes("zoomout") || lowerTarget.includes("jhoom out") || lowerTarget.includes("zoomOut") || lowerTarget.includes("room out")) {
    currentZoom = Math.max(0.1, currentZoom - 0.1);
    document.body.style.zoom = currentZoom;
    return;
  }
  
  processVoiceCommand(target);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function processVoiceCommand(transcript) {
  console.log("Voice command:", transcript);
  
  const response = await fetch("http://localhost:3000/get-groq-chat-completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "key ":0,
      messages: [
        { role: "user", content: `<prompt > : ${transcript} : </prompt>
          <core point> This is going to be a prompt refiner that gives only the refined prompt only with zero extra text so that that can be directly feed to the ai for the process specified down</core point>
          <Important note> I want you to refine the prompt to send it the ai , that is "tagger" works with the below specified principle </important note>
          <principle of the tagger>
          
        ......<very important note> ........

        make sure you extract only the necessary data from the prompt and neglect the nouns like "for me" "for him " "please" and etc and process only the command
        and work accordingly , i expect high precesion and very high acceptance and take a little time and do it.
        ........<importtant note> ........

        example of how i want :
        <user ask> : "can you please tell me the weather"
        <actual answer i want you to return> : \`{"key" : -1}\`

        <user ask> : can you please summarise the web for me 
        <actual answer i want you to return> : \`{"key" : 2}\`

        <user ask> : "could you please find me the menu"
        <actual answer i want you to return> : \`{"key" : 3}\`

        <user ask> : "give me the location of login page "
        <actual answer i want you to return> : \`{"key" : 3}\`

        <user ask> : "what is the weather like today"
        <actual answer i want you to return> : \`{"key" : -1}\`

        
        ...........<pounts to ponder>.....................
        
        if a user asks for something that can be done just by iterating the current dom only and using ai by sending the dom means the ask of the user can be done there itself no need of endpoint navigation then key it as 2, 
        this API call is for tagging purposes only , what you will be returning is going to be a json like stringified object enclosed with "\`" nothing else.

        there are only three tags and an instruction .

        the instruction would be , if a very unrelated query or any persional query or that is off the website scope like <how are you , or something else like that > you have to answer normally as you do and return \`{"key" : -1}\`.
        if the user said some actions that can be done within the page where they are actualy in , you have to return \`{"key" : 2}\`

        if any other querry return \`{"key" : 3}\`

        another very important note , your output should contain only \`{"key" : <number>}\` and nothing else . like zero extra text , i want only that object. unless it is a very unrelated querry like i mentioned above . there you can reply normally and return -1 as key.

        do well

       


        ..............<extra>........................
        .............<WHAT AI IS USED FOR>.............
        you are going to work as a tagger for now , the tag you provide will be given to an extension that would do some flow changes with it , so act accordingly .
        .............<goal of the project> ..................
        this is a extension which will be used for navigation purposes , the bigest
        achievement that this extension has to  achieve is . if user said <"give me the menu of this hotel"> that voice will be converted to text (already done and thats how you recieved it) and have to 
        tag his query <what this call meant for > and has to navigate to the menu that can be in any form such as <a href = "menu.html"> or <a id = "menu"> or <a class = "menu"> or any other form and has to click on that or any type of span div that has some text or table or svgs etc <can be aby element that html has> .
          </principle of the tagger>
        ` 
      
      }
      ]
    })

  });
  //response one for tagging purposes 
  
  const data = await response.json(); // Parse the response data as JSON
  console.log(data.content); // Log the parsed data
}
