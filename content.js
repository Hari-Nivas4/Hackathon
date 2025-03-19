

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
  z-index: 1;
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
  container.style.position = "fixed"; // Ensure it stays in place
  document.body.appendChild(container);

  // Create a close button so the container persists until manually closed.
  const closeButton = document.createElement("button");
  closeButton.textContent = "X";
  closeButton.style.cssText = "position: absolute; top: 5px; right: 5px; z-index: 10000; cursor: pointer;";
  closeButton.addEventListener("click", () => {
    container.remove();
  });
  container.appendChild(closeButton);

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
  // Start with a default transcript that is appended at start.
  let transcript = " ";
  let keyPressStartTime = 0;

  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        transcript += result[0].transcript + " ";
      } else {
        interimTranscript += result[0].transcript;
      }
    }
    voiceOutput.textContent = transcript + interimTranscript;
  };

  recognition.onerror = (event) => {
    console.error("Recognition error:", event.error);
  };

  // Start recording on keydown when "a" is pressed (if not already recognizing)
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
  
  try {
    const response = await fetch("http://localhost:3000/get-groq-chat-completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: 0,
        messages: [
          { role: "user", content: `<prompt > : ${transcript} : </prompt>
            <core point> This is going to be a prompt refiner that gives only the refined prompt only with zero extra text so that that can be directly feed to the ai for the process specified down and <must><must>work like llama-3.3-70b-specdec</must></must></core point>  
            
            <in short > if the query is based on personal stuff or any unrelated query or any random stuff than the website  then its key is 1 and if the query that can be done within the current dom then key it as 2 and if it is the query that can be processed by going through all end points connected to the dom will be keyed 3 if not falls or invalid on any category put it in key 7>
            <user was told that including "find" will be a best practice for across dom process such as key 3 and "this" for same page process such as key 2 this will not work all time >
            <Important note> I want you to refine the prompt to send it the ai , that is "tagger" works with the below specified principle </important note>
            <principle of the tagger>

            ......<very important note> ........

            make sure you extract only the necessary data from the prompt and neglect the nouns like "for me" "for him " "please" and etc and process only the command
            and work accordingly , i expect high precesion and very high acceptance and take a little time and do it.
            ........<importtant note> ........

            example of how i want :
            <user ask> : "can you please tell me the weather"
            <actual answer i want you to return> : \`{"key" : 1}\`

            <user ask> : can you please summarise the web for me 
            <actual answer i want you to return> : \`{"key" : 2}\`

            <user ask> : "could you please find me the menu"
            <actual answer i want you to return> : \`{"key" : 3}\`

            <user ask> : "give me the location of login page "
            <actual answer i want you to return> : \`{"key" : 3}\`

            <user ask> : "what is the weather like today"
            <actual answer i want you to return> : \`{"key" : 1}\`

            <user ask> : "Hope you can hear me well, so kindly reply me with something."
            <actual answer> : \`{"key" : 1}\`

            <user ask> : "See how finding it is."
            <actual answer i want you to return> : \`{"key" : 1}\`

            ...........<pounts to ponder>.....................
            
            if a user asks for something that can be done just by iterating the current dom only and using ai by sending the dom means the ask of the user can be done there itself no need of endpoint navigation then key it as 2, 
            this API call is for tagging purposes only , what you will be returning is going to be a json like stringified object enclosed with "\`" nothing else.

            there are only three tags and an instruction .

            the instruction would be , if a very unrelated query or any persional query or that is off the website scope like <how are you , or something else like that > you have to answer normally as you do and return \`{"key" : 1}\`.
            if the user said some actions that can be done within the page where they are actualy in , you have to return \`{"key" : 2}\`

            if any other querry return \`{"key" : 3}\`

            another very important note , your output should contain only \`{"key" : <number>}\` and nothing else . like zero extra text , i want only that object. unless it is a very unrelated querry like i mentioned above . there you can reply normally and return 1 as key.

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

    const responseData = await response.json();
    
    // Extracting the JSON object from the response
    let extractedJSON = responseData.content.substring(responseData.content.length - 13,responseData.content .length);
    console.log("extractedJSON: ",extractedJSON);
    

    try {
      globalThis.obj = JSON.parse(extractedJSON);
      console.log("Extracted JSON object:", obj);
    } catch (error) {
      console.error("Error parsing extracted JSON:", error);
    }

  } catch (error) {
    console.error("Error processing voice command:", error);
  }


  

  if(obj.key === 1){
    fetch("http://localhost:3000/get-groq-chat-completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "key ":0,
        messages: [
          { role: "user", content: `<prompt > : ${transcript} : </prompt><just answer as you like but friendly and no harming>
          ` 
        }
        ]
      })
  
    }).then(response => response.json())
    .then(response => {console.log(response.content)});

  }
  if (obj.key === 2) {
    const dom = document.documentElement.outerHTML;
    const partLength = Math.ceil(dom.length / 20);
    const parts = [];
  
    // Split the DOM into 6 parts.
    for (let i = 0; i < 20; i++) {
      parts.push(dom.slice(i * partLength, (i + 1) * partLength));
    }
  
    // Example transcript provided by the user.
    
  
    // Process each part by sending a request to the AI API.
    const promises = parts.map((part, index) => {
      // Build a prompt that includes both the transcript and the DOM snippet.
      const promptMessage = `<prompt>You will be given a DOM snippet and a transcript given from user for finding something from a website , since giving the entire dom to the AI is not effecient the dom is split into chunks and will be given you with transcript <important : What AI have to do is compare the TRANSCRIPT and the dom snippet and return a number ranging from 0 to 9 and must not allow any other text to get added to the output , (only one number output) representing the similarity between the transcript and dom snipet and most importantly your output should contain only one number 0 to 9 ></prompt>Transcript: ${transcript} | DOM snippet: ${part}`;
      
      return fetch("http://localhost:3000/get-groq-chat-completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          key: 0,
          messages: [
            { role: "user", content: promptMessage }
          ]
        })
      })
      .then(response => {
        // Expecting the response to return a number (as a string or number) representing the sync value.
        const syncValue = Number(response);
        console.log(`DOM Index: ${index}, Sync Value: ${syncValue}`);
        return syncValue;
      })
      .catch(error => {
        console.error(`Error processing DOM index ${index}:`, error);
      });
    });
  
    // When all promises are resolved, log the overall results.
    Promise.all(promises)
      .then(results => {
        console.log("All sync values:", results);
      });
  }
  
  
  
}
