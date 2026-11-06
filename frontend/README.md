# ReachInbox – Email Scheduler

ReachInbox is an email scheduling application that allows users to compose emails, add multiple recipients, and schedule emails for future delivery. It uses a background job queue to process scheduled emails and provides a dashboard to track scheduled and sent emails.

The application is built using React, TypeScript, Node.js, Express, PostgreSQL, Redis, BullMQ, and Nodemailer.

## Features Implemented

### Backend

- Email scheduling through REST API endpoints.
- Email and recipient details stored in PostgreSQL.
- BullMQ used to manage scheduled email jobs.
- Redis used as the queue storage and supports job persistence.
- Background worker processes scheduled email jobs.
- Nodemailer used for email delivery through SMTP.
- Configurable worker concurrency.
- Configurable email sending interval and hourly sending limit.
- Email status and delivery logs maintained in the database.
- Elasticsearch integration for searching email records.
- Bull Board dashboard for monitoring background jobs.

### Frontend

- Email application dashboard.
- Login interface.
- Email composition section with recipient, subject, and message fields.
- CSV and TXT file upload for extracting recipient email addresses.
- Duplicate email address removal during lead processing.
- Scheduling emails for a selected date and time.
- Configurable delay between email deliveries.
- Dashboard displaying email statistics.
- Separate views for scheduled and sent emails.
- Email status tracking.
- Search functionality.
- Password visibility option.
- Responsive and user-friendly interface.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Job Queue | BullMQ |
| Queue Storage | Redis |
| Email Service | Nodemailer, SMTP |
| Testing Email Service | Ethereal Email |
| Search | Elasticsearch |
| Job Monitoring | Bull Board |

## Architecture Overview

### 1. How Email Scheduling Works

When a user composes an email and selects a future date and time, the frontend sends the email details to the backend through the scheduling API.

The backend validates the request and stores the email and recipient information in PostgreSQL. It then creates a delayed job in BullMQ using the selected scheduling time.

Redis stores the queue information, and BullMQ manages when the job becomes ready for processing.

Once the scheduled time is reached, the background worker picks up the job and uses Nodemailer to send the email through the configured SMTP service.

After processing, the email status and delivery details are updated in PostgreSQL.

### 2. Persistence Across Restarts

Email details are stored in PostgreSQL, so the application can retrieve previously scheduled and processed emails even after the backend restarts.

BullMQ uses Redis to store job information. Redis persistence is enabled using append-only file storage (AOF), helping retain queue data across Redis restarts.

When the application starts again, the worker reconnects to Redis and continues processing available jobs.

### 3. Rate Limiting and Concurrency

The application uses BullMQ to control background email processing.

Worker concurrency is configurable through the environment variable `WORKER_CONCURRENCY`. This controls how many jobs the worker can process concurrently.

Email sending frequency is controlled through the configurable environment variables `EMAIL_SEND_INTERVAL_MS` and `MAX_EMAILS_PER_HOUR`.

The BullMQ limiter is configured to regulate the job processing rate and maintain a minimum interval between email jobs.

### 4. Job Monitoring

Bull Board provides a dashboard for monitoring the email-scheduler queue.

It allows the developer to view job states such as waiting, active, completed, and failed.

## Project Setup

### Prerequisites

Make sure the following are installed:

- Node.js and npm
- Docker Desktop
- Git
- PostgreSQL
- Redis

### 1. Clone the Repository

```bash
git clone https://github.com/varshini-codes/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler
```

### 2. Start the Required Services

Make sure Docker Desktop is running.

Start the PostgreSQL, Redis, and Elasticsearch containers:

```bash
docker start scheduler-postgres
docker start scheduler-redis
docker start scheduler-elasticsearch
```

The application uses the following default service ports:

- PostgreSQL: 5432
- Redis: 6379
- Elasticsearch: 9200

### 3. Backend Setup

Open a terminal and navigate to the backend directory:

```bash
cd backend
npm install
```

Create a `.env` file inside the backend directory and configure the required environment variables.

### 4. Ethereal Email Setup

Ethereal Email is used as a test SMTP service to verify email delivery without sending messages to real recipients.

1. Visit https://ethereal.email/
2. Create a test account.
3. Copy the generated SMTP username and password.
4. Add the SMTP details to the backend `.env` file.

Example environment configuration:

```env
PORT=5000

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_username
SMTP_PASS=your_ethereal_password
EMAIL_FROM=your_ethereal_username

ELASTICSEARCH_URL=http://localhost:9200

MAX_EMAILS_PER_HOUR=200
EMAIL_SEND_INTERVAL_MS=2000
WORKER_CONCURRENCY=5
```

Use the SMTP credentials generated by Ethereal. Do not upload your `.env` file or share your SMTP credentials publicly.

Make sure the PostgreSQL connection settings in the backend environment file match your local database configuration.

### 5. Run the Backend Server

From the backend directory, run:

```bash
npm run dev
```

The backend API will be available at:

```text
http://localhost:5000
```

### 6. Run the BullMQ Worker

Open a separate terminal and navigate to the backend directory:

```bash
cd backend
npx tsx src/workers/emailWorker.ts
```

Keep the worker running so that scheduled jobs can be processed and emails can be sent.

### 7. Run the Frontend

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend in your browser:

```text
http://localhost:5173
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/emails/schedule` | Schedule an email |
| GET | `/api/emails` | Retrieve email records |
| GET | `/api/emails/search?q=search_term` | Search email records |

## Monitoring

The Bull Board dashboard is available at:

```text
http://localhost:5000/admin/queues
```

It provides visibility into the email-scheduler queue and its job statuses.

Elasticsearch is available at:

```text
http://localhost:9200
```

## Project Workflow

1. The user logs in and opens the dashboard.
2. The user composes an email and enters recipient details or uploads a CSV/TXT file.
3. The user selects the scheduled date and time.
4. The frontend sends the scheduling request to the backend.
5. The backend stores the email information in PostgreSQL.
6. BullMQ creates a delayed job and stores its queue information in Redis.
7. The worker processes the job when it becomes available.
8. Nodemailer sends the email through the configured SMTP service.
9. The database is updated with the email's processing status.
10. The user can view email records through the dashboard.

## Future Improvements

- Google OAuth authentication.
- Multiple sender account support.
- Advanced per-sender and global hourly rate limiting.
- Automatic rescheduling when sending limits are reached.
- Slack notifications for rate-limit events.
- Improved bulk email processing and delivery reporting.

## Repository

GitHub: https://github.com/varshini-codes/reachinbox-email-scheduler

