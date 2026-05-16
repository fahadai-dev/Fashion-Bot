require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const {
  testConnection,
  getAllProducts,
  saveMessage,
  getChatHistory,
  createOrder,
} = require("./db");

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

testConnection();

app.get("/", (req, res) => {
  res.send("BotBazaar Server চালু আছে ✅");
});

app.post("/chat", async (req, res) => {
  try {
    const { message, phone } = req.body;
    const customerPhone = phone || "guest";

    const products = await getAllProducts();
    const history = await getChatHistory(customerPhone);

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
- friendly ও natural ভাষায় কথা বলো, যেন বন্ধু কথা বলছে

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

    await saveMessage(customerPhone, "user", message);
    await saveMessage(customerPhone, "assistant", reply);

    res.json({ reply });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Order System
app.post("/order", async (req, res) => {
  try {
    const { customerPhone, productName, quantity, price, address } = req.body;
    const order = await createOrder(
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
      res.json({ success: false, message: "অর্ডার হয়নি, আবার চেষ্টা করুন" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes
app.get("/admin/orders", async (req, res) => {
  const { data } = await require("./db")
    .supabase.from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  res.json(data || []);
});

app.get("/admin/chats", async (req, res) => {
  const { data } = await require("./db")
    .supabase.from("conversations")
    .select("*")
    .order("created_at", { ascending: false });
  res.json(data || []);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server চালু আছে port ${process.env.PORT || 3000} এ`);
});
