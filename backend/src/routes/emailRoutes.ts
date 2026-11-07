
import { Router } from "express";
import { pool } from "../config/db";
import { emailQueue } from "../queues/emailQueue";

export const emailRouter = Router();

emailRouter.post("/schedule", async (req, res) => {
  try {
    const { recipient, subject, body, scheduledAt } = req.body;

    if (!recipient || !subject || !body || !scheduledAt) {
      return res.status(400).json({
        message: "Please fill in all fields",
      });
    }

    const scheduleDate = new Date(scheduledAt);

    if (
      isNaN(scheduleDate.getTime()) ||
      scheduleDate.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message: "Please select a valid future date and time",
      });
    }

    const result = await pool.query(
      `INSERT INTO emails (subject, body, scheduled_at, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [subject, body, scheduleDate, "scheduled"]
    );

    const emailId = result.rows[0].id;

    await pool.query(
      `INSERT INTO recipients (email_id, recipient_email)
       VALUES ($1, $2)`,
      [emailId, recipient]
    );

    const delay = scheduleDate.getTime() - Date.now();

    await emailQueue.add(
      "send-email",
      { emailId, recipient, subject, body },
      {
        delay,
        jobId: `email-${emailId}`,
      }
    );

    return res.status(201).json({
      message: "Email scheduled successfully",
      emailId,
      status: "scheduled",
    });
  } catch (error) {
    console.error("SCHEDULING ERROR DETAILS:", error);

    return res.status(500).json({
      message: "Failed to schedule email",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

emailRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.subject, e.body, e.scheduled_at,
              e.status, r.recipient_email
       FROM emails e
       LEFT JOIN recipients r ON e.id = r.email_id
       ORDER BY e.created_at DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Fetching emails error:", error);

    return res.status(500).json({
      message: "Failed to fetch emails",
    });
  }
});

emailRouter.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.status(400).json({
        message: "Please enter a search term",
      });
    }

    const result = await pool.query(
      `SELECT e.id, e.subject, e.body, e.scheduled_at,
              e.status, r.recipient_email
       FROM emails e
       LEFT JOIN recipients r ON e.id = r.email_id
       WHERE e.subject ILIKE $1
          OR e.body ILIKE $1
          OR r.recipient_email ILIKE $1
       ORDER BY e.created_at DESC`,
      [`%${q}%`]
    );

    return res.json({
      count: result.rows.length,
      emails: result.rows,
    });
  } catch (error) {
    console.error("Email search error:", error);

    return res.status(500).json({
      message: "Email search failed",
    });
  }
});
