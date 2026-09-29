-- Real-time events, push notifications and shared expenses.

-- ---------------------------------------------------------------------------
-- Real-time events. Every API instance LISTENs on "tripivo_events" and forwards these to
-- connected WebSocket clients. NOTIFY is delivered only when the inserting transaction commits,
-- so clients never hear about rows that were rolled back.
-- ---------------------------------------------------------------------------
CREATE FUNCTION notify_chat_message() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('tripivo_events', json_build_object(
    'type', 'chat.message', 'roomId', NEW.room_id, 'messageId', NEW.id, 'senderId', NEW.sender_id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_messages_notify AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION notify_chat_message();

CREATE FUNCTION notify_notification() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('tripivo_events', json_build_object(
    'type', 'notification', 'userId', NEW.user_id, 'notificationId', NEW.id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_notify AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_notification();

-- ---------------------------------------------------------------------------
-- Push notifications (Expo push tokens, one row per device).
-- ---------------------------------------------------------------------------
CREATE TABLE push_tokens (
  token        text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  platform     text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_tokens_user_id_idx ON push_tokens (user_id);

-- Set when a notification has been handed to the push service (or skipped). Existing
-- notifications are old news, so they are never pushed.
ALTER TABLE notifications ADD COLUMN pushed_at timestamptz;
UPDATE notifications SET pushed_at = now();

CREATE INDEX notifications_unpushed_idx ON notifications (created_at) WHERE pushed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Shared expenses: categories on group expenses, and settle-ups between members.
-- ---------------------------------------------------------------------------
ALTER TABLE group_expenses
  ADD COLUMN category   text NOT NULL DEFAULT 'other' CHECK (category IN (
                          'transport', 'accommodation', 'food', 'activities', 'shopping', 'other'
                        )),
  ADD COLUMN created_by uuid REFERENCES users (id) ON DELETE SET NULL;

-- A payment from one member to another that pays off what they owe. Payments are made
-- outside the app (cash, UPI) and recorded here.
CREATE TABLE group_settlements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  from_user  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount     numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency   char(3) NOT NULL DEFAULT 'INR',
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_user <> to_user)
);

CREATE INDEX group_settlements_group_id_idx ON group_settlements (group_id);
