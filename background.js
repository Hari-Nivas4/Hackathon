// Background script for Brain AI extension

console.log("Brain AI Extension background script loaded");

// Listen for when a Tab is updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log("Tab updated, injecting content script:", tab.url);
    
    // Check if server is running by pinging it
    fetch('http://localhost:3000/should-i-pop')
      .then(response => response.json())
      .then(data => {
        console.log("Server response:", data);
        
        // Notify content script to check for popup status
        chrome.tabs.sendMessage(tabId, { event: "check-popup" })
          .catch(err => console.log("Content script not ready yet"));
      })
      .catch(error => {
        console.error("Server connection failed:", error);
      });
  }
});

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { event: "create-popup" })
    .catch(err => {
      console.log("Error sending message to content script:", err);
      // If content script is not ready, try to inject it
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: injectOverlay
      });
    });
});

// This function will be injected if the content script is not already running
function injectOverlay() {
  if (!document.getElementById('brain-floating-key-container')) {
    console.log("Injecting overlay from background script");
    // Create a simple notification since we can't directly run the content script functions
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;
    overlay.textContent = "Brain AI: Reload page to activate extension";
    document.body.appendChild(overlay);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      overlay.remove();
    }, 5000);
  }
} 