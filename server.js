// server.js





let importantToggleForFinding = false;
let related_to_toggle_string = "";
let ultimateNumber = 0;

const express = require("express");
const { compressDOM } = require("./domCompressor");
const cors = require("cors");

const pako = require("pako");


const app = express();
const port = process.env.PORT || 3000;

const fetch = require('node-fetch');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error("Bad JSON:", err);
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.text({ type: "/", limit: "100mb" }));

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { log } = require("neo-async");

let should_i_popUp = "no";


// Endpoint to get the current popup state.
app.get("/should-i-pop", (req, res) => {
  res.json({ ok: true, message: should_i_popUp });
});

// Endpoint to toggle the popup state.
app.post("/create-popup1", (req, res) => {
  should_i_popUp = should_i_popUp === "yes" ? "no" : "yes";
  res.json({ ok: true, message: should_i_popUp });
});




app.post("/dom-parser", async (req, res) => {
  let endpoints = req.body.end;
  console.log("Received endpoints:", endpoints);

  let results = [];
  for (let i = 0; i < endpoints.length; i++) {
    const url = endpoints[i];
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      results.push({ url, html });
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      results.push({ url, error: error.message });
    }
  }

  // Send the results as a JSON response
  res.json({ success: true, data: results });
});


app.post("/toggle", (req, res) => {
    let url;
    if(req.body.content !== null)
    {
      importantToggleForFinding = req.body.content;
    }
    if(req.body.content2 !== null )
    {
      related_to_toggle_string = req.body.content2;
    }
  });
 
  app.get("/toggle", (req, res) => {
    res.json({ ok: true, content: importantToggleForFinding , transcript : related_to_toggle_string  });
  });

// app.post("/class-adder", (req, res) => {
//   let url;
//   if(req.body.content !== null)
//   {
//     url = req.body.content;
//     console.log("is the url ",url);
    
//     async function processUrl(url) {
//       try {
//         // Fetch the HTML from the URL.
//         const response = await fetch(url);
//         const htmlText = await response.text();
    
//         // Parse the HTML text into a DOM.
//         const dom = new JSDOM(htmlText);
//         const document = dom.window.document;
    
//         // Get all elements in the document.
//         const allElements = document.querySelectorAll("*");
    
//         // Iterate over each element using a for loop.
//         for (let i = 0; i < allElements.length; i++) {
//           const element = allElements[i];
//           // Add a custom attribute to each element.
//           element.setAttribute("brain-ai-", ultimateNumber++);
//         }
    
//         // Return or log the modified HTML.
        
//       } catch (error) {
//         console.error("Error processing URL:", error);
//         throw error;
//       }
//     }
    
//     // Example usage:
//     processUrl(url)
//       .then(modifiedHtml => {
//         console.log("successfull");
//       })
//       .catch(error => {
//         console.error("Error:", error);
//       });

//   }
// });









app.post("/compress-dom", (req, res) => {
  try {
    const html = req.body;
    const compressedDom = compressDOM(html);
    // Optionally convert Uint8Array to Base64 if you want to send it as text
    const base64 = Buffer.from(compressedDom).toString("base64");
    res.send({ compressed: base64 });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});




// Endpoint to get the Groq chat completion.
app.post("/get-groq-chat-completion", async (req, res) => {
  try {
    // Extract messages array from the request body.
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages format; expected a non-empty array" });
    }

    // Combine all messages' content into one prompt string.
    const prompt = messages.map(msg => msg.content).join("\n");
    console.log("Received prompt:", prompt);

    // Initialize the GoogleGenerativeAI client.
    const genAI = new GoogleGenerativeAI("AIzaSyD_P_nTgaYqnqI-6pnzStsUPpYtJfSXJOw");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Generate content using the Gemini model.
    const result = await model.generateContent(prompt);
    const candidateText = result.response.text(); // Assuming this returns plain text

    console.log("Response from Gemini:", candidateText);
    res.send(candidateText);
  } catch (error) {
    console.error(
      "Error in /get-groq-chat-completion:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to generate content" });
  }
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});







