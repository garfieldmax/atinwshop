-- Enable PostGIS extension for geography support
create extension if not exists postgis with schema extensions;

-- Users location table (RLS disabled explicitly to use service role key safely)
create table if not exists locations (
  user_id text primary key,
  coordinates geography(Point, 4326) not null,
  last_updated timestamp with time zone default now() not null,
  proximity_count integer not null default 0,
  last_notified_at timestamp with time zone
);

alter table locations disable row level security;

-- Spatial index and recency index for performance
create index if not exists idx_location_coords on locations using gist(coordinates);
create index if not exists idx_location_time on locations(last_updated);

-- Haversine helper for consistent distance calculations
create or replace function haversine_distance(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
) returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(
    sqrt(
      pow(sin(radians((lat2 - lat1) / 2)), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      pow(sin(radians((lon2 - lon1) / 2)), 2)
    )
  );
$$;

-- Function used by the API to retrieve nearby users with optional filters
create or replace function nearby_locations(
  query_lat double precision,
  query_lng double precision,
  radius_m double precision,
  exclude_user text,
  inactive_after_seconds integer default 120,
  limit_results integer default 10
) returns table (
  user_id text,
  distance_meters double precision,
  last_updated timestamp with time zone
)
language sql
stable
as $$
  select
    l.user_id,
    d.distance_meters,
    l.last_updated
  from locations l
  cross join lateral (
    select haversine_distance(
      query_lat,
      query_lng,
      ST_Y(l.coordinates::geometry),
      ST_X(l.coordinates::geometry)
    ) as distance_meters
  ) as d
  where l.user_id <> exclude_user
    and l.last_updated > now() - make_interval(secs => inactive_after_seconds)
    and d.distance_meters <= radius_m
  order by d.distance_meters asc
  limit limit_results;
$$;

-- Cleanup function for removing stale locations
create or replace function cleanup_stale_locations()
returns void
language sql
as $$
  delete from locations
  where last_updated < now() - interval '10 minutes';
$$;
