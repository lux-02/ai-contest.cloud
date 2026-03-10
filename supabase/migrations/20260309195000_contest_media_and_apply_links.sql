alter table public.contests
add column if not exists poster_image_url text,
add column if not exists apply_url text;
