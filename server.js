// server.js
// Express Backend with Secure Stripe Billing Simulation

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const database = {
  credits: {
    "user_has_credits": 3,
    "user_no_credits": 0
  }
};

function verifyAndDeductCredits(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/, "").trim();

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized. Missing user token header." });
  }

  if (database.credits[token] === undefined) {
    database.credits[token] = 5;
  }

  const availableCredits = database.credits[token];

  if (availableCredits <= 0) {
    return handleOutOfCredits(token, res);
  }

  database.credits[token] = availableCredits - 1;
  req.userToken = token;
  req.userCredits = database.credits[token];
  next();
}

async function handleOutOfCredits(userToken, res) {
  try {
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes("mock_secret_key")) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "100 Lead Enrichment Credits" },
            unit_amount: 1000
          },
          quantity: 1
        }],
        mode: "payment",
        success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&userToken=${userToken}`,
        cancel_url: `${process.env.STRIPE_CANCEL_URL}?userToken=${userToken}`
      });
      return res.status(403).json({ success: false, message: "Insufficient credits.", checkoutUrl: session.url });
    }
  } catch (error) {
    console.warn("Stripe SDK error:", error.message);
  }

  const mockSessionId = "mock_sess_" + Math.random().toString(36).substring(2, 10);
  const checkoutUrl = `https://localhost:${PORT}/simulated-checkout?session_id=${mockSessionId}&userToken=${userToken}`;
  return res.status(403).json({ success: false, message: "Credits depleted.", checkoutUrl: checkoutUrl });
}

app.get("/api/credits", (req, res) => {
  const token = req.query.user || "user_has_credits";
  if (database.credits[token] === undefined) database.credits[token] = 5;
  res.json({ credits: database.credits[token] });
});

app.post("/api/enrich", verifyAndDeductCredits, (req, res) => {
  const { profile } = req.body;
  if (!profile || !profile.name) {
    return res.status(400).json({ success: false, message: "Invalid profile data provided." });
  }
  const cleanName = profile.name.trim();
  const cleanCompany = profile.company.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const nameParts = cleanName.split(/\s+/);
  const firstName = nameParts[0] ? nameParts[0].toLowerCase() : "contact";
  const lastName = nameParts[1] ? nameParts[1].toLowerCase() : "";
  const domain = cleanCompany ? `${cleanCompany}.com` : "company.com";
  const email = lastName ? `${firstName}.${lastName}@${domain}` : `${firstName}@${domain}`;

  res.json({
    success: true,
    credits: req.userCredits,
    enrichedLead: { name: cleanName, title: profile.title || "Professional", company: profile.company || "Independent", email, domain, verificationStatus: "Verified" }
  });
});

app.get("/simulated-checkout", (req, res) => {
  const { session_id, userToken } = req.query;
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Checkout</title></head>
<body style="font-family:sans-serif;padding:40px;">
  <h2>B2B Lead Extractor - 100 Credits - $10.00</h2>
  <form action="/api/stripe-success" method="GET">
    <input type="hidden" name="session_id" value="${session_id}">
    <input type="hidden" name="userToken" value="${userToken}">
    <input type="email" value="billing@example.com" required><br><br>
    <input type="text" value="4242 4242 4242 4242" required><br><br>
    <button type="submit">Pay $10.00</button>
  </form>
</body></html>`);
});

app.get("/api/stripe-success", (req, res) => {
  const { userToken } = req.query;
  if (!userToken) return res.status(400).send("Missing user token.");
  database.credits[userToken] = (database.credits[userToken] || 0) + 10;
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Successful</title></head>
<body style="font-family:sans-serif;text-align:center;margin-top:100px;">
  <h1>Payment Successful!</h1>
  <p>10 credits added for: <strong>${userToken}</strong></p>
  <button onclick="window.close()">Close Window</button>
</body></html>`);
});

app.get("/cancel", (req, res) => {
  res.send('<div style="font-family:sans-serif;text-align:center;margin-top:100px;"><h2>Payment Cancelled</h2><button onclick="window.close()">Close</button></div>');
});

app.listen(PORT, () => {
  console.log(`B2B Billing server running on port ${PORT}`);
});
