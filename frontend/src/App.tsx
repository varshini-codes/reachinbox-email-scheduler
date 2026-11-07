
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "./App.css";

interface Email {
  id: number;
  subject: string;
  body: string;
  scheduled_at: string;
  status: string;
  recipient_email: string;
}

type Page =
  | "login"
  | "inbox"
  | "compose"
  | "scheduled"
  | "sent"
  | "details";

function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/emails";

  const [page, setPage] = useState<Page>("login");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [schedule, setSchedule] = useState("");

  const [leads, setLeads] = useState<string[]>([]);
  const [leadFileName, setLeadFileName] = useState("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadEmails() {
    try {
      setLoading(true);

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Unable to load emails");
      }

      const data = await response.json();
      setEmails(data);
      setError("");
    } catch {
      setError("Backend connection failed. Please check your server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (page === "login") return;

    loadEmails();

    const timer = window.setInterval(loadEmails, 5000);

    return () => window.clearInterval(timer);
  }, [page]);

  function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!loginEmail.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setPage("inbox");
  }

  async function handleLeadUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedExtensions = [".csv", ".txt"];

    const isAllowed = allowedExtensions.some((extension) =>
      file.name.toLowerCase().endsWith(extension)
    );

    if (!isAllowed) {
      setError("Please upload a CSV or TXT file.");
      event.target.value = "";
      return;
    }

    try {
      const content = await file.text();

      const emailPattern =
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      const matches = content.match(emailPattern) || [];

      const uniqueEmails = [
        ...new Set(matches.map((email) => email.toLowerCase())),
      ];

      if (uniqueEmails.length === 0) {
        setError("No valid email addresses were found in this file.");
        setLeads([]);
        setLeadFileName("");
        return;
      }

      setLeads(uniqueEmails);
      setLeadFileName(file.name);
      setError("");
      setNotice(
        `${uniqueEmails.length} unique email addresses extracted successfully.`
      );
    } catch {
      setError("Unable to read this file. Please try another CSV or TXT file.");
    }
  }

  function removeLeads() {
    setLeads([]);
    setLeadFileName("");
    setNotice("Uploaded leads removed.");
  }

  async function scheduleEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!subject.trim() || !message.trim() || !schedule) {
      setError("Please complete the subject, message and schedule time.");
      return;
    }

    const recipients =
      leads.length > 0
        ? leads
        : recipient.trim()
        ? [recipient.trim()]
        : [];

    if (recipients.length === 0) {
      setError("Enter a recipient email or upload a CSV/TXT leads file.");
      return;
    }

    const scheduledDate = new Date(schedule);

    if (
      isNaN(scheduledDate.getTime()) ||
      scheduledDate.getTime() <= Date.now()
    ) {
      setError("Please choose a valid future date and time.");
      return;
    }

    try {
      setSending(true);
      setError("");
      setNotice("");

      let successfulCount = 0;

      for (const emailAddress of recipients) {
        const response = await fetch(`${API_URL}/schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: emailAddress,
            subject: subject.trim(),
            body: message.trim(),
            scheduledAt: scheduledDate.toISOString(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `${successfulCount} email(s) scheduled. Failed for ${emailAddress}: ${
              data.error || data.message || "Scheduling failed"
            }`
          );
        }

        successfulCount++;
      }

      setNotice(
        `${successfulCount} email(s) scheduled successfully.`
      );

      setRecipient("");
      setSubject("");
      setMessage("");
      setSchedule("");
      setLeads([]);
      setLeadFileName("");

      await loadEmails();
      setPage("scheduled");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Scheduling failed."
      );

      await loadEmails();
    } finally {
      setSending(false);
    }
  }

  const scheduled = emails.filter(
    (email) => email.status?.toLowerCase() === "scheduled"
  );

  const sent = emails.filter(
    (email) => email.status?.toLowerCase() === "sent"
  );

  const failed = emails.filter(
    (email) => email.status?.toLowerCase() === "failed"
  );

  const visibleEmails = emails.filter((email) => {
    const matches =
      email.subject?.toLowerCase().includes(search.toLowerCase()) ||
      email.recipient_email?.toLowerCase().includes(search.toLowerCase());

    if (page === "scheduled") {
      return email.status?.toLowerCase() === "scheduled" && matches;
    }

    if (page === "sent") {
      return email.status?.toLowerCase() === "sent" && matches;
    }

    if (page === "inbox") return matches;

    return false;
  });

  function openEmail(email: Email) {
    setSelected(email);
    setPage("details");
  }

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setNotice("");
    setError("");
    setSearch("");
  }

  if (page === "login") {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">ONB</div>

          <p className="login-subtitle">Email Workspace</p>

          <h1>Welcome back</h1>

          <p className="muted">
            Sign in to manage your email campaigns.
          </p>

          <button
            className="google-button"
            type="button"
            onClick={() =>
              setError(
                "Google OAuth is not configured yet. Use email login below."
              )
            }
          >
            <span className="google-icon">G</span>
            Continue with Google
          </button>

          <div className="or-divider">
            <span>or sign in with email</span>
          </div>

          <form onSubmit={login} className="login-form">
            <label>Email address</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />

            <label>Password</label>

            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <div className="notice error">{error}</div>
            )}

            <button
              className="primary-button full-button"
              type="submit"
            >
              Login
            </button>
          </form>

          <p className="login-footer">
            ReachInbox · Email scheduling workspace
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">O</span>
          <span>ONB</span>
        </div>

        <div className="profile">
          <div className="avatar">V</div>

          <div className="profile-info">
            <strong>
              {loginEmail.split("@")[0] || "My Account"}
            </strong>

            <small>{loginEmail || "Email Workspace"}</small>
          </div>
        </div>

        <button
          className="compose-button"
          onClick={() => navigate("compose")}
        >
          <span>＋</span> Compose
        </button>

        <p className="nav-label">MAILBOX</p>

        <button
          className={`nav-item ${page === "inbox" ? "active" : ""}`}
          onClick={() => navigate("inbox")}
        >
          <span>▣</span>
          Inbox
          <span className="nav-number">{emails.length}</span>
        </button>

        <button
          className={`nav-item ${
            page === "scheduled" ? "active" : ""
          }`}
          onClick={() => navigate("scheduled")}
        >
          <span>◷</span>
          Scheduled
          <span className="nav-number">{scheduled.length}</span>
        </button>

        <button
          className={`nav-item ${page === "sent" ? "active" : ""}`}
          onClick={() => navigate("sent")}
        >
          <span>➤</span>
          Sent
          <span className="nav-number">{sent.length}</span>
        </button>

        <div className="sidebar-bottom">
          <div className="connection">
            <span className="online-dot"></span>
            Email workspace
          </div>

          <button
            className="logout-button"
            onClick={() => navigate("login")}
          >
            ↪ Logout
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace /{" "}
            {page === "details" ? "Email Details" : page}
          </div>

          <div className="topbar-right">
            <div className="search-input">
              <span>⌕</span>

              <input
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="icon-button"
              title="Refresh"
              onClick={loadEmails}
            >
              ↻
            </button>

            <div className="top-avatar">V</div>
          </div>
        </header>

        <div className="page-content">
          {notice && (
            <div className="notice success">{notice}</div>
          )}

          {error && (
            <div className="notice error">{error}</div>
          )}

          {page === "compose" && (
            <section className="content-card compose-page">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">MESSAGE</span>

                  <h1>Compose New Email</h1>

                  <p>
                    Create and schedule an email for delivery.
                  </p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("inbox")}
                >
                  ← Back to Inbox
                </button>
              </div>

              <form onSubmit={scheduleEmail}>
                <div className="compose-field">
                  <label>From</label>

                  <input
                    value="Configured SMTP account"
                    disabled
                  />
                </div>

                <div className="compose-field">
                  <label>To</label>

                  <input
                    type="email"
                    placeholder="recipient@example.com (or upload leads below)"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    disabled={leads.length > 0}
                  />

                  {leads.length > 0 && (
                    <small>
                      Uploaded leads will be used as recipients.
                    </small>
                  )}
                </div>

                <div className="lead-upload-section">
                  <h3>Upload Leads</h3>

                  <p>
                    Upload a CSV or TXT file containing email
                    addresses. Duplicate addresses are removed
                    automatically.
                  </p>

                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleLeadUpload}
                  />

                  {leadFileName && (
                    <div className="lead-upload-result">
                      <p>
                        <strong>File:</strong> {leadFileName}
                      </p>

                      <p>
                        <strong>{leads.length}</strong>{" "}
                        unique email addresses found
                      </p>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={removeLeads}
                      >
                        Remove uploaded file
                      </button>
                    </div>
                  )}
                </div>

                <div className="compose-field">
                  <label>Subject</label>

                  <input
                    placeholder="Enter your subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="compose-field">
                  <label>Schedule delivery</label>

                  <input
                    type="datetime-local"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    required
                  />
                </div>

                <div className="editor-label">
                  Your message
                </div>

                <textarea
                  className="message-editor"
                  placeholder="Write your email message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />

                <div className="compose-bottom">
                  <span className="muted">
                    {leads.length > 0
                      ? `This email will be scheduled for ${leads.length} recipients.`
                      : "Your email will be sent at the selected time."}
                  </span>

                  <div className="button-group">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => navigate("inbox")}
                    >
                      Cancel
                    </button>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={sending}
                    >
                      {sending
                        ? "Scheduling..."
                        : leads.length > 0
                        ? `◷ Schedule ${leads.length} Emails`
                        : "◷ Schedule Email"}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {(page === "inbox" ||
            page === "scheduled" ||
            page === "sent") && (
            <>
              <div className="welcome-heading">
                <div>
                  <span className="eyebrow">
                    EMAIL MANAGEMENT
                  </span>

                  <h1>
                    {page === "inbox"
                      ? "Inbox"
                      : page === "scheduled"
                      ? "Scheduled Emails"
                      : "Sent Emails"}
                  </h1>

                  <p>
                    {page === "inbox"
                      ? "View and manage all your emails."
                      : page === "scheduled"
                      ? "Track emails waiting to be delivered."
                      : "Review emails successfully delivered."}
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => navigate("compose")}
                >
                  ＋ Compose Email
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon purple">▣</div>
                  <span>Total Emails</span>
                  <strong>{emails.length}</strong>
                  <small>All email records</small>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">◷</div>
                  <span>Scheduled</span>
                  <strong>{scheduled.length}</strong>
                  <small>Waiting for delivery</small>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">✓</div>
                  <span>Sent</span>
                  <strong>{sent.length}</strong>
                  <small>Successfully delivered</small>
                </div>

                <div className="stat-card">
                  <div className="stat-icon red">!</div>
                  <span>Failed</span>
                  <strong>{failed.length}</strong>
                  <small>Delivery errors</small>
                </div>
              </div>

              <section className="content-card">
                <div className="list-heading">
                  <div>
                    <h2>
                      {page === "inbox"
                        ? "All Emails"
                        : page === "scheduled"
                        ? "Upcoming Emails"
                        : "Delivered Emails"}
                    </h2>

                    <p>
                      {visibleEmails.length} email(s) found
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={loadEmails}
                  >
                    ↻ Refresh
                  </button>
                </div>

                <div className="email-table">
                  <div className="table-head">
                    <span>RECIPIENT / SUBJECT</span>
                    <span>DATE</span>
                    <span>STATUS</span>
                  </div>

                  {loading && emails.length === 0 ? (
                    <div className="empty-state">
                      Loading emails...
                    </div>
                  ) : visibleEmails.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">✉</div>

                      <h3>No emails found</h3>

                      <p>
                        Your emails will appear here when they
                        are created.
                      </p>

                      <button
                        className="primary-button"
                        onClick={() => navigate("compose")}
                      >
                        Compose your first email
                      </button>
                    </div>
                  ) : (
                    visibleEmails.map((email) => (
                      <button
                        className="email-table-row"
                        key={email.id}
                        onClick={() => openEmail(email)}
                      >
                        <span className="recipient-cell">
                          <span className="email-avatar">
                            {email.recipient_email
                              ?.charAt(0)
                              .toUpperCase() || "?"}
                          </span>

                          <span className="recipient-text">
                            <strong>
                              {email.recipient_email}
                            </strong>

                            <small>{email.subject}</small>
                          </span>
                        </span>

                        <span className="date-cell">
                          {new Date(
                            email.scheduled_at
                          ).toLocaleString()}
                        </span>

                        <span>
                          <span
                            className={`status-badge ${email.status?.toLowerCase()}`}
                          >
                            {email.status}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          {page === "details" && selected && (
            <section className="content-card detail-page">
              <button
                className="secondary-button"
                onClick={() => navigate("inbox")}
              >
                ← Back
              </button>

              <span className="eyebrow">EMAIL DETAILS</span>

              <h1>{selected.subject}</h1>

              <div className="detail-meta">
                <p>
                  <strong>To:</strong>{" "}
                  {selected.recipient_email}
                </p>

                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(
                    selected.scheduled_at
                  ).toLocaleString()}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`status-badge ${selected.status?.toLowerCase()}`}
                  >
                    {selected.status}
                  </span>
                </p>
              </div>

              <div className="detail-body">
                {selected.body}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
