-- Ryvoki Mail tables (live in the same D1 database as the store).
-- Apply to production:  npm run schema      (from mail/worker)
-- Apply locally:        npm run schema:local

CREATE TABLE IF NOT EXISTS mail_messages (
  id               TEXT PRIMARY KEY,                 -- time-sortable id, also the KV key suffix
  folder           TEXT NOT NULL DEFAULT 'inbox',    -- inbox | sent | archive | trash | drafts
  direction        TEXT NOT NULL,                    -- in | out
  mailbox          TEXT,                             -- the @ryvoki.com address it arrived at / was sent from
  from_addr        TEXT,
  from_name        TEXT,
  to_addrs         TEXT,                             -- comma-separated display list
  subject          TEXT,
  snippet          TEXT,
  date             TEXT NOT NULL,                    -- ISO 8601, from the message or receipt time
  unread           INTEGER NOT NULL DEFAULT 1,
  starred          INTEGER NOT NULL DEFAULT 0,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  size             INTEGER,
  message_id       TEXT,                             -- Message-ID header (for threading / replies)
  in_reply_to      TEXT,
  provider_id      TEXT,                             -- Resend id for sent mail
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mail_folder_date ON mail_messages(folder, date DESC);
CREATE INDEX IF NOT EXISTS idx_mail_unread ON mail_messages(folder, unread);
CREATE INDEX IF NOT EXISTS idx_mail_message_id ON mail_messages(message_id);
