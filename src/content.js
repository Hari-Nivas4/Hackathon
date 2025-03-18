document.addEventListener("DOMContentLoaded" , () => runApp());

async function runApp()
{
    chrome.runtime.sendMessage({background : ready} ,(response) => console.log(response.status)  );
}
  