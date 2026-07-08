export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { number, message } = req.body;
  const apiKey = process.env.REACT_APP_SEMAPHORE_KEY;

  if (!apiKey) { res.status(500).json({ error: "API key not configured" }); return; }
  if (!number || !message) { res.status(400).json({ error: "Missing number or message" }); return; }

  const cleanNum = number.replace(/\D/g, "").replace(/^0/, "63");

  try {
    const params = new URLSearchParams();
    params.append("apikey", apiKey);
    params.append("number", cleanNum);
    params.append("message", message);
    params.append("sendername", "SEMAPHORE");

    const response = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
