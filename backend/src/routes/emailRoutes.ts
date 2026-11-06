
import { Router } from "express";
import { pool } from "../config/db";
import { emailQueue } from "../queues/emailQueue";
import { elasticClient } from "../config/elasticsearch";

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
      scheduleDate <= new Date()
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
  
try {
  await elasticClient.index({
    index: "emails",
    id: String(emailId),
    document: {
      emailId,
      recipient,
      subject,
      body,
      scheduledAt: scheduleDate,
      status: "scheduled",
    },
  });

  console.log("Email indexed in Elasticsearch:", emailId);
} catch (error) {
  console.error("Elasticsearch indexing error:", error);
}

    await pool.query(
      `INSERT INTO recipients (email_id, recipient_email)
       VALUES ($1, $2)`,
      [emailId, recipient]
    );

    const delay = scheduleDate.getTime() - Date.now();

    await emailQueue.add(
  "send-email",
  { emailId, recipient, subject, body },
  { delay, jobId: `email-${emailId}` }
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

    const result = await elasticClient.search({
      index: "emails",
      query: {
        multi_match: {
          query: q,
          fields: ["recipient", "subject", "body"],
        },
      },
    });

    const emails = result.hits.hits.map((hit) => hit._source);

    return res.json({
      count: emails.length,
      emails,
    });
  } catch (error) {
    console.error("Elasticsearch search error:", error);

    return res.status(500).json({
      message: "Email search failed",
    });
  }
});