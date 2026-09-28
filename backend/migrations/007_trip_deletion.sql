-- Deleting a trip that other travelers have joined needs every one of them to agree.
-- The host opens a deletion request; each active member votes; the trip is deleted once all
-- of them approve, and the request ends as soon as one of them declines.

CREATE TABLE trip_deletion_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason       text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- At most one open request per trip.
CREATE UNIQUE INDEX trip_deletion_requests_one_pending ON trip_deletion_requests (trip_id) WHERE status = 'pending';

CREATE TABLE trip_deletion_votes (
  request_id uuid NOT NULL REFERENCES trip_deletion_requests (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  decision   text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
