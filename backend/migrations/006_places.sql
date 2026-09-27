-- Real places instead of a fixed destination list. Places come from a geocoding provider
-- (OpenStreetMap via Photon by default, Google Places when configured) and are cached here the
-- first time they are seen, so trips and profiles can point at them.

CREATE TABLE places (
  -- Provider-scoped id, e.g. 'osm:N756382658' or 'google:ChIJ...'.
  id           text PRIMARY KEY,
  name         text NOT NULL,
  -- Region and country, e.g. 'Himachal Pradesh, India'.
  subtitle     text,
  country      text,
  country_code char(2),
  -- city / town / village / region / country / island / area ...
  kind         text NOT NULL DEFAULT 'area',
  latitude     numeric(9, 6) NOT NULL,
  longitude    numeric(9, 6) NOT NULL,
  -- Looked up lazily (Wikipedia); `image_checked_at` stops repeated lookups for places without one.
  image_url        text,
  image_checked_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX places_name_lower_idx ON places (lower(name));

CREATE TRIGGER places_set_updated_at BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Autocomplete responses, so repeated searches don't hit the provider (and its rate limits).
CREATE TABLE place_search_cache (
  cache_key  text PRIMARY KEY,
  place_ids  text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trips
  ADD COLUMN place_id text REFERENCES places (id) ON DELETE SET NULL,
  ADD COLUMN country  text;

CREATE INDEX trips_place_id_idx ON trips (place_id);

-- The traveler's home city, picked from the same place search; also the map's fallback centre
-- when the device location isn't available.
ALTER TABLE travel_profiles
  ADD COLUMN city_place_id text REFERENCES places (id) ON DELETE SET NULL;

-- The curated list is kept only as a fallback for when the provider is unreachable and there are
-- no trips yet; "popular" and "trending" are now computed from real trip activity.
COMMENT ON TABLE destinations IS 'Fallback suggestions only. Popular/trending places come from trip activity.';

-- Link the sample trips (and any existing ones) to their catalog coordinates' country.
UPDATE trips SET country = 'India' WHERE country IS NULL AND destination IN
  ('Goa', 'Manali', 'Ladakh', 'Jaipur', 'Kasol', 'Rishikesh', 'Kerala');
UPDATE trips SET country = 'Indonesia' WHERE country IS NULL AND destination = 'Bali';
