// server.js
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS so that your extension (running on any origin) can communicate with this server.
app.use(cors());
app.use(express.json());

let should_i_popUp = "no";

const Groq = require("groq-sdk"); // Use require instead of import
const groq = new Groq({ apiKey: "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"});

// Endpoint to get the current popup state.
app.get("/should-i-pop", (req, res) => {
  res.json({ ok: true, message: should_i_popUp });
});

// Endpoint to toggle the popup state.
app.post("/create-popup1", (req, res) => {
  should_i_popUp = (should_i_popUp === "yes") ? "no" : "yes";
  res.json({ ok: true, message: should_i_popUp });
});

// Endpoint to update DOM data.
app.post("/ai-call-for-tag", (req, res) => {
  let promptToAI = {
    "importantNote" : "You are an Ai assistant for a web based task",
    "message" : req.body.message // Handle the request body
  };

  // You can use the promptToAI object as needed, for example:
  console.log(promptToAI);

  res.json({ ok: true, message: "AI call successful" });
});

// Endpoint to get the Groq chat completion.
app.post("/get-groq-chat-completion", async (req, res) => {
  try {
    const chatCompletion = await getGroqChatCompletion(req.body.messages);
    res.json({ ok: true, message: chatCompletion.choices[0]?.message?.content || "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Error getting chat completion" });
  }
});

// Function to get the Groq chat completion.
async function getGroqChatCompletion(messages) {
  return groq.chat.completions.create({
    messages: messages,
    model: "llama-3.3-70b-versatile",
  });
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});