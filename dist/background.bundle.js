var __webpack_exports__ = {};
/*!***********************!*\
  !*** ./background.js ***!
  \***********************/
// Import the Gemini API from the local package installed in node_modules.
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { output } from "./webpack.config";

let should_i_popUp = "no";
let promptToAI = {
  DOM_DATA: "hello machi nan dha dom",
  IMPORTANT_NOTE: "You should give me a response that should contain only the code (that will be copied completely and will be pasted in the console of the webpage), so return only valid javascript syntax and it should be relevant to the action asked, to perform the actionToPerform precisely and efficiently you were given the htmlDomInStringFormat, so use the htmlDomInStringFormat to perform the actionToPerform",
  user_prompt: ""
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "should-i-pop") {
    sendResponse({ ok: true, message: should_i_popUp });
  }
  
  if (message.action === "create-popup1") {
    should_i_popUp = (should_i_popUp === "yes") ? "no" : "yes";
  }
  
  if (message.action === "dom-updation") {
    promptToAI.DOM_DATA = message.message;
    sendResponse({ message: promptToAI.DOM_DATA, ok: "true" });
  }
  
  if (message.action === "process-voice") {
    promptToAI.user_prompt = message.transcript;
    
    // Return true to keep the message channel open for the async response.
    (async () => {
      const genAI = new GoogleGenerativeAI("AIzaSyD_P_nTgaYqnqI-6pnzStsUPpYtJfSXJOw"); // replace with your API key
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = "true";
      let Ai_response = result.response.text();
      sendResponse({ result: "completed", output: promptToAI });
    })();
    sendResponse({ result: "completed", output: JSON.stringify(promptToAI) });
    
    return true;
  }
});


//# sourceMappingURL=background.bundle.js.map