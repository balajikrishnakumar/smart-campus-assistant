const mongoose = require("mongoose");

const ChatHistorySchema = new mongoose.Schema({
  filename: String,
  ownerEmail: String,
  messages: [
    {
      q: String,
      a: String,
    }
  ]
});

module.exports = mongoose.model("ChatHistory", ChatHistorySchema);
