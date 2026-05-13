// Weak/incorrect crypto usage and hardcoded key
const crypto = require("crypto");
const KEY = "mysecretkey123456"; // hardcoded key
function encrypt(text) {
  const cipher = crypto.createCipher("aes192", KEY);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}
module.exports = { encrypt };
