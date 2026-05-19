require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const db = require("./db");

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
db.testConnection();

app.get("/", (req, res) => {
  res.send("BotBazaar Server চালু আছে ✅");
});

app.post("/chat", async (req, res) => {
  try {
    const { message, phone } = req.body;
    const customerPhone = phone || "guest";
    const products = await db.getAllProducts();
    const history = await db.getChatHistory(customerPhone);
    const productList = products
      .map(
        (p) =>
          `- ${p.name}: ${p.price} টাকা (স্টক: ${p.stock}টি) — ${p.description}`,
      )
      .join("\n");
    const historyMessages = history.map((h) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.message,
    }));
    const systemPrompt = `তুমি Rina Fashion এর sales assistant "রিনা"। তুমি একজন বাস্তব মানুষের মতো কথা বলো।
নিয়ম:
- সবসময় বাংলায় কথা বলো
- উত্তর সর্বোচ্চ ৩-৪ লাইন, ছোট ও সহজ
- কখনো বানোয়াট তথ্য দিও না
- শুধু নিচের product list থেকে তথ্য দাও
- অর্ডার করতে চাইলে শুধু নাম, ফোন ও ঠিকানা জিজ্ঞেস করো
- friendly ও natural ভাষায় কথা বলো
আমাদের পণ্য:
${productList}`;
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
      max_tokens: 500,
    });
    const reply = completion.choices[0].message.content;
    await db.saveMessage(customerPhone, "user", message);
    await db.saveMessage(customerPhone, "assistant", reply);
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/order", async (req, res) => {
  try {
    const { customerPhone, productName, quantity, price, address } = req.body;
    const order = await db.createOrder(
      customerPhone,
      productName,
      quantity,
      price,
      address,
    );
    if (order) {
      res.json({
        success: true,
        orderId: order.id,
        message: "অর্ডার সফল হয়েছে! ✅",
      });
    } else {
      res.json({ success: false, message: "অর্ডার হয়নি" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/admin/orders", async (req, res) => {
  const { data } = await db.supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  res.json(data || []);
});

app.get("/admin/chats", async (req, res) => {
  const { data } = await db.supabase
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false });
  res.json(data || []);
});

module.exports = app;
