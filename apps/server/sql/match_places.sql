-- Requires: create extension if not exists vector;
-- Table: public.bangkok_unseen with column embedding vector(1536)

create or replace function public.match_places(
  query_embedding vector(1536),
  match_count int,
  search text default null,
  similarity_threshold double precision default 0.4
)
returns table (
  id uuid,
  name text,
  description text,
  tags text[],
  lat double precision,
  lng double precision,
  address text,
  price int,
  image_url text,
  similarity double precision
)
language sql
stable
as $$
  select
    id,
    name,
    coalesce(description, '') as description,
    coalesce(tags, '{}') as tags,
    lat,
    lng,
    coalesce(address, '') as address,
    price,
    coalesce(image_url, '') as image_url,
    1 - (embedding <=> query_embedding) as similarity
  from public.bangkok_unseen
  where embedding is not null
    and (1 - (embedding <=> query_embedding)) >= similarity_threshold
    and (
      search is null
      or name ilike '%'||search||'%'
      or description ilike '%'||search||'%'
    )
  order by embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

