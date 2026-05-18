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
  supabase,
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

app.get("/", (req, res) => res.send("BotBazaar Server চালু আছে ✅"));

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
    const systemPrompt = `তুমি Rina Fashion এর sales assistant "রিনা"।\nনিয়ম:\n- সবসময় বাংলায় কথা বলো\n- উত্তর সর্বোচ্চ ৩-৪ লাইন\n- শুধু নিচের product list থেকে তথ্য দাও\nআমাদের পণ্য:\n${productList}`;
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
    res.status(500).json({ error: error.message });
  }
});

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
    order
      ? res.json({
          success: true,
          orderId: order.id,
          message: "অর্ডার সফল হয়েছে! ✅",
        })
      : res.json({ success: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/admin/orders", async (req, res) => {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  res.json(data || []);
});

app.get("/admin/chats", async (req, res) => {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false });
  res.json(data || []);
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Server চালু আছে port ${process.env.PORT || 3000} এ`),
);
