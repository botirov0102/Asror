import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// We try to read the config if it's available, otherwise it might be in the environment
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: config.projectId,
    });
  }
} else if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Send Telegram Report
  app.post("/api/send-report", async (req, res) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        return res.status(500).json({ error: "Telegram configuration missing" });
      }

      // Fetch all students from Firestore to get the most up-to-date total scores
      const snapshot = await db.collection("students").orderBy("totalPoints", "desc").get();
      
      if (snapshot.empty) {
        return res.status(400).json({ error: "No students found to report" });
      }

      let message = "🏆 *O'quvchilar Reytingi*\n\n";
      snapshot.forEach((doc) => {
        const data = doc.data();
        message += `👤 ${data.name}: *${data.totalPoints}* ball\n`;
      });

      message += `\n🕒 Yangilandi: ${new Date().toLocaleString('uz-UZ')}`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      
      const response = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        console.error("Telegram API Error:", result);
        return res.status(500).json({ error: "Failed to send message to Telegram", details: result.description });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Server Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
