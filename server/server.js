require("dotenv").config();
const mongoose = require("mongoose");
const Document = require("./Document");
const bodyParser = require("body-parser");
const User = require("./User");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { log } = require("console");
const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const port = 3002;

mongoose.connect("mongodb://127.0.0.1:27017/MSWord");

app.use(cors());
app.use(bodyParser.json());

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("User already exist");
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }
    const newUser = new User({ name, email, password });
    await newUser.save();
    console.log("User registered successfully");
    res.json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error. Please try again later." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });

    if (user) {
      const userId = user._id;
      res.json({ userId });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error. Please try again later." });
  }
});

// Add this route to fetch recent documents of the user
app.get("/api/recent-documents/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const documents = await Document.find({ createdBy: userId })
      .limit(5)
      .sort({ createdAt: -1 });
    res.json({ documents });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error. Please try again later." });
  }
});

const defaultValue = "";

io.on("connection", (socket) => {
  socket.on("get-document", async (documentId) => {
    const document = await findOrCreateDocument(documentId);
    socket.join(documentId);
    socket.emit("load-document", document.data);
    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });
    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(documentId, { data });
    });
  });
});

async function findOrCreateDocument(id) {
  if (id == null) return;
  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
