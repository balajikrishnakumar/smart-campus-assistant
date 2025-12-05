const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  name: String,
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }]
});

module.exports = mongoose.model("User", UserSchema);
