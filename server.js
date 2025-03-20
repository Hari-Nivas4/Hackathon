// server.js







const express = require("express");
const { compressDOM } = require("./domCompressor");
const cors = require("cors");

const pako = require("pako");


const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.text({ type: "/", limit: "100mb" }));

const { GoogleGenerativeAI } = require("@google/generative-ai");

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

// Endpoint to update DOM data.
app.post("/ai-call-for-tag", (req, res) => {
  const promptToAI = {
    importantNote: "You are an AI assistant for a web-based task",
    message: req.body.message || "", // Ensure message exists
  };

  console.log(promptToAI);
  res.json({ ok: true, message: "AI call successful" });
});

// Function to get the Groq chat completion.



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







