const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  ownerEmail: String,
  filename: String,
  originalName: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Document", DocumentSchema);
