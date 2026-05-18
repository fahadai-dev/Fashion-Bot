const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

async function testConnection() {
  const { data, error } = await supabase.from("products").select("id").limit(1);

  if (error) {
    console.error("❌ Supabase connection failed:", error.message);
    return false;
  }
  console.log("✅ Supabase connected successfully!");
  return true;
}

async function getAllProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("category");
  if (error) return [];
  return data;
}

async function findOrCreateCustomer(phone, name = null) {
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .single();

  if (existing) return existing;

  const { data: newCustomer, error } = await supabase
    .from("customers")
    .insert([{ phone, name }])
    .select()
    .single();

  if (error) return null;
  return newCustomer;
}

async function saveMessage(customerPhone, role, message) {
  await supabase
    .from("conversations")
    .insert([{ customer_phone: customerPhone, role, message }]);
}

async function getChatHistory(customerPhone) {
  const { data, error } = await supabase
    .from("conversations")
    .select("role, message")
    .eq("customer_phone", customerPhone)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return [];
  return data;
}

async function createOrder(
  customerPhone,
  productName,
  quantity,
  price,
  address,
) {
  const { data, error } = await supabase
    .from("orders")
    .insert([
      {
        customer_phone: customerPhone,
        product_name: productName,
        quantity,
        price,
        address,
        status: "pending",
      },
    ])
    .select()
    .single();
  if (error) return null;
  return data;
}

module.exports = {
  supabase,
  testConnection,
  getAllProducts,
  findOrCreateCustomer,
  saveMessage,
  getChatHistory,
  createOrder,
};
