// server.js
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS so that your extension (running on any origin) can communicate with this server.
app.use(cors());
app.use(express.json());

// These variables mirror your original background.js state.
let should_i_popUp = "no";
let promptToAI = {
  DOM_DATA: "hello machi nan dha dom",
  IMPORTANT_NOTE: "You should give me a response that should contain only the code (that will be copied completely and pasted in the console), so return only valid javascript syntax and it should be relevant to the action asked, to perform the action precisely using the provided HTML DOM string.",
  user_prompt: ""
};

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
app.post("/dom-updation", (req, res) => {
  const { message } = req.body;
  promptToAI.DOM_DATA = message;
  res.json({ ok: true, message: promptToAI.DOM_DATA });
});

// Endpoint to process voice input.
// (Here we simply set the user prompt and return the current promptToAI object.)
app.post("/process-voice", (req, res) => {
  const { transcript } = req.body;
  promptToAI.user_prompt = transcript;
  res.json({ result: "completed", output: promptToAI });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
