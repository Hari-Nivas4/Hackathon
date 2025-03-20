

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
              { role: "user", content: `<prompt>: ${transcript}:</prompt>
              <array> ${endpoints.end} </array>
              <output format> should return one java script object {"index" : <number> } no other extra tesx and dont reply the users prompt at all , your role here is a tagger </output format> 
              <task : You were given multiple end point urls of a website and you have to tag the most relevant endpoint url to the users prompt  
              <the relation can be anything including word,sound , meaning , same word with different meaning , different word with same meaning , partially related , technically related , user ask , users understanding , users point of view , prediction algorithms , possibilty checks , often conflicting values , similiar but unrelated words , every thing has to be considered> 
              with all above considerations return a number that <important> is the index of the most relevant endpoint url from the array of endpoint urls that you were given</important>. 
              </task>   
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

            


      })();
    }
}






  
  // Example usage:
  
  
