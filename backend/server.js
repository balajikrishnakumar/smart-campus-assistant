//---------------------------------------------------------
// SMART CAMPUS ASSISTANT - GROQ LLaMA-3.1-8B-INSTANT VERSION
//---------------------------------------------------------

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const unzipper = require("unzipper");
const xml2js = require("xml2js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");
require("dotenv").config();

// ----------------- MongoDB -----------------
const connectDB = require("./config/db");
const User = require("./models/User");
const Document = require("./models/Document");
const ChatHistory = require("./models/ChatHistory");

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ----------------- File Upload Setup -----------------
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});

const upload = multer({ storage });

// ----------------- Auth Middleware -----------------
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ---------------- PPTX Parser ----------------
async function parsePPTX(filePath) {
  let text = "";
  const zip = await unzipper.Open.file(filePath);

  for (const file of zip.files) {
    if (file.path.startsWith("ppt/slides/") && file.path.endsWith(".xml")) {
      const xml = await file.buffer();
      const parsed = await xml2js.parseStringPromise(xml);

      try {
        const shapes = parsed["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];
        shapes.forEach((shape) => {
          const t = shape["p:txBody"]?.[0]?.["a:p"]?.[0]?.["a:r"]?.[0]?.["a:t"];
          if (t) text += t + "\n";
        });
      } catch {}
    }
  }
  return text || "No readable text found";
}

// ---------------------------------------------------
// REGISTER USER
// ---------------------------------------------------
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "User already exists" });

  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({ email, passwordHash, documents: [] });

  res.json({ success: true });
});

// ---------------------------------------------------
// LOGIN USER
// ---------------------------------------------------
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.json({ token, email });
});

// ---------------------------------------------------
// UPLOAD DOCUMENT
// ---------------------------------------------------
app.post("/api/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = "";

    if (ext === ".pdf") {
      const buffer = fs.readFileSync(filePath);
      text = (await pdfParse(buffer)).text;
    } else if (ext === ".docx") {
      text = (await mammoth.extractRawText({ path: filePath })).value;
    } else if (ext === ".pptx") {
      text = await parsePPTX(filePath);
    } else {
      return res.status(400).json({ error: "Unsupported file format" });
    }

    const doc = await Document.create({
      ownerEmail: req.user.email,
      filename: req.file.filename,
      originalName: req.file.originalname,
      text,
    });

    await User.updateOne(
      { email: req.user.email },
      { $push: { documents: doc._id } }
    );

    await ChatHistory.create({
      filename: doc.filename,
      ownerEmail: req.user.email,
      messages: [],
    });

    res.json({ success: true, filename: doc.filename, originalName: doc.originalName });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ---------------------------------------------------
// GET USER DOCUMENTS
// ---------------------------------------------------
app.get("/api/my-documents", authenticate, async (req, res) => {
  const docs = await Document.find({ ownerEmail: req.user.email });

  res.json({
    documents: docs.map((d) => ({
      id: d.filename,
      name: d.originalName,
    })),
  });
});

// ---------------------------------------------------
// DELETE DOCUMENT + CHAT HISTORY
// ---------------------------------------------------
app.delete("/api/delete-document", authenticate, async (req, res) => {
  try {
    const { filename } = req.body;

    const doc = await Document.findOne({
      filename,
      ownerEmail: req.user.email,
    });

    if (!doc)
      return res.status(404).json({ error: "Document not found" });

    // Delete document DB entry
    await Document.deleteOne({ filename });

    // Delete chat history for this document
    await ChatHistory.deleteOne({ filename });

    // Remove reference from User.documents
    await User.updateOne(
      { email: req.user.email },
      { $pull: { documents: doc._id } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});


// ---------------------------------------------------
// GET CHAT HISTORY (Formatted for Frontend)
// ---------------------------------------------------
app.post("/api/chat-history", authenticate, async (req, res) => {
  try {
    const { filename } = req.body;

    const history = await ChatHistory.findOne({
      filename,
      ownerEmail: req.user.email
    });

    if (!history || !history.messages.length) {
      return res.json({ messages: [] });
    }

    // Convert DB format → ChatTab format
    const formatted = history.messages.flatMap(m => [
      { role: "user", content: m.q },
      { role: "assistant", content: m.a }
    ]);

    res.json({ messages: formatted });

  } catch (err) {
    console.error("CHAT HISTORY ERROR:", err);
    res.json({ messages: [] });
  }
});


// ---------------------------------------------------
// GROQ CHAT (LLaMA 3.1 8B INSTANT)
// ---------------------------------------------------
app.post("/api/chat", authenticate, async (req, res) => {
  try {
    const { filename, question } = req.body;

    const doc = await Document.findOne({
      filename,
      ownerEmail: req.user.email
    });

    if (!doc) return res.status(404).json({ error: "Document not found" });

    const prompt = `
You are a study assistant. ONLY answer using this document content:

${doc.text.substring(0, 8000)}

Question: ${question}
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Answer only using the provided document." },
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = response.data.choices[0].message.content;

    await ChatHistory.updateOne(
      { filename, ownerEmail: req.user.email },
      { $push: { messages: { q: question, a: answer } } }
    );

    res.json({ answer });

  } catch (err) {
    console.error("GROQ CHAT ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "GROQ request failed" });
  }
});

// ---------------------------------------------------
// SUMMARY (GROQ) - FIXED & STABLE
// ---------------------------------------------------
app.post("/api/summary", authenticate, async (req, res) => {
  try {
    const { filename } = req.body;

    const doc = await Document.findOne({
      filename,
      ownerEmail: req.user.email,
    });

    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Reduce text size (fixes Groq failure)
    const safeText = doc.text.substring(0, 6000);

    const prompt = `
Summarize the following document into 6–10 concise bullet points.
Do NOT exceed 120 words.

Document:
${safeText}
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Return only bullet points. No intro." },
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 20000 // Prevent timeout crash
      }
    );

    const summary = response.data?.choices?.[0]?.message?.content || "";

    if (!summary.trim()) {
      return res.status(500).json({ error: "Summary generation failed" });
    }

    res.json({ summary });

  } catch (err) {
    console.error("SUMMARY ERROR:", err.response?.data || err.message);
    return res.status(500).json({ error: "Summary failed. Try again." });
  }
});

// ---------------------------------------------------
// QUIZ GENERATOR (GROQ) — SUPPORTS MCQ + TRUE/FALSE
// ---------------------------------------------------
app.post("/api/quiz", authenticate, async (req, res) => {
  try {
    const { filename } = req.body;

    const doc = await Document.findOne({
      filename,
      ownerEmail: req.user.email,
    });

    if (!doc) return res.status(404).json({ error: "Document not found" });

    const safeText = doc.text.substring(0, 6000);

    const prompt = `
Generate a quiz of **5 mixed questions** (some True/False and some Multiple-Choice)
based ONLY on the document below.

STRICTLY return valid JSON array ONLY:

[
  {
    "type": "mcq" | "true_false",
    "question": "string",
    "options": ["A", "B", "C", "D"] OR ["True", "False"],
    "correctAnswer": 0,
    "explanation": "string"
  }
]

Rules:
- 2 questions must be true/false.
- 3 questions must be MCQ.
- For MCQ, include 4 options. For True/False, use only ["True","False"].
- correctAnswer MUST be the index number (0 or 1 for T/F).
- MUST include "explanation" for every answer.
- NO text outside JSON.

Document:
${safeText}
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Return ONLY valid JSON. No comments." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ quiz: response.data.choices[0].message.content });

  } catch (err) {
    console.error("QUIZ ERROR:", err.response?.data || err);
    res.status(500).json({ error: "Quiz generation failed" });
  }
});

// ---------------------------------------------------
// START SERVER
// ---------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
