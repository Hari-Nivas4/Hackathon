// server.js







const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let should_i_popUp = "no";

const Groq = require("groq-sdk");
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "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",
});

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
async function getGroqChatCompletion(messages) {
  return groq.chat.completions.create({
    messages: messages,
    model: "qwen-qwq-32b",
  });
}

// Endpoint to get the Groq chat completion.
app.post("/get-groq-chat-completion", async (req, res) => {
  try {
    // Ensure req.body.messages is an array
    
    if(req.key === 0)
    {
      req.body = req.body;
    }
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      console.warn("Invalid messages format received, using default.");
      messages = [
        {
          role: "user",
          content: "Explain the importance of fast language models",
        },
      ];
    }

    console.log("Messages sent to Groq:", messages);

    const chatCompletion = await getGroqChatCompletion(messages);
    console.log("response from groq", chatCompletion.choices[0]?.message?.content || "");
    
    res.json({
      content: chatCompletion.choices[0]?.message?.content || "",
    });
  } catch (error) {
    console.error("Error getting chat completion:", error);
    res.status(500).json({ error: "Failed to get chat completion" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
