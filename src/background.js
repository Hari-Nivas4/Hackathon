// src/background.js
// import {GoogleGenerativeAI} from "d:/AZ/Hackathon/node_modules/@google/generative-ai/dist/index.js"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if(message.background)
  {
    sendResponse({status : "working"});
  }
});

// async function gemini()
// {

//   const genAI = new GoogleGenerativeAI("YOUR_API_KEY");
//   const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
//   const prompt = "Explain how AI works";
  
//   const result = await model.generateContent(prompt);
//   console.log(result.response.text());
// }
