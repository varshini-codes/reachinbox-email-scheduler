
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { emailRouter } from "./routes/emailRoutes";
import { pool } from "./config/db";
import { emailQueue } from "./queues/emailQueue";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Email API
app.use("/api/emails", emailRouter);

// Bull Board dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

app.get("/", (_req, res) => {
  res.json({
    message: "ReachInbox Email Scheduler API is running!",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "Server is healthy",
  });
});

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Bull Board: http://localhost:${PORT}/admin/queues`);

  try {
    await pool.query("SELECT NOW()");
    console.log("Database connection test successful");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
});
