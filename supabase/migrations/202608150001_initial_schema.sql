create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '她' check (char_length(display_name) between 1 and 40),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 20000),
  happened_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0),
  analysis_status text not null default 'queued' check (analysis_status in ('idle', 'queued', 'processing', 'completed', 'failed')),
  analysis_error text,
  unique (id, user_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null,
  kind text not null check (kind in ('image', 'audio')),
  original_name text not null check (char_length(original_name) between 1 and 500),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  duration_seconds numeric check (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 300)),
  storage_path text not null unique,
  transcript text,
  ocr_text text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (entry_id, user_id) references public.entries(id, user_id) on delete cascade
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('like', 'dislike', 'quote', 'important', 'boundary', 'wish')),
  statement text not null check (char_length(statement) between 1 and 2000),
  evidence_level text not null check (evidence_level in ('explicit', 'inferred')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'confirmed', 'rejected')),
  lifecycle text not null default 'active' check (lifecycle in ('active', 'superseded')),
  happened_at timestamptz not null,
  supersedes_claim_id uuid,
  source_entry_id uuid not null,
  source_revision integer not null check (source_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (supersedes_claim_id, user_id) references public.claims(id, user_id) on delete set null (supersedes_claim_id),
  foreign key (source_entry_id, user_id) references public.entries(id, user_id) on delete cascade
);

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null,
  entry_id uuid not null,
  attachment_id uuid,
  quote text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (claim_id, entry_id, attachment_id),
  foreign key (claim_id, user_id) references public.claims(id, user_id) on delete cascade,
  foreign key (entry_id, user_id) references public.entries(id, user_id) on delete cascade,
  foreign key (attachment_id, user_id) references public.attachments(id, user_id) on delete cascade
);

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null,
  revision integer not null check (revision > 0),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, revision),
  foreign key (entry_id, user_id) references public.entries(id, user_id) on delete cascade
);

create index entries_user_happened_idx on public.entries(user_id, happened_at desc);
create index attachments_entry_idx on public.attachments(entry_id);
create index attachments_user_idx on public.attachments(user_id);
create index claims_user_category_idx on public.claims(user_id, category, happened_at desc);
create index claims_source_idx on public.claims(source_entry_id, source_revision);
create index claims_supersedes_idx on public.claims(supersedes_claim_id) where supersedes_claim_id is not null;
create index claim_evidence_claim_idx on public.claim_evidence(claim_id);
create index claim_evidence_entry_idx on public.claim_evidence(entry_id);
create index claim_evidence_attachment_idx on public.claim_evidence(attachment_id) where attachment_id is not null;
create index claim_evidence_user_idx on public.claim_evidence(user_id);
create index analysis_jobs_user_status_idx on public.analysis_jobs(user_id, status, created_at);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger entries_updated_at before update on public.entries for each row execute function public.set_updated_at();
create trigger claims_updated_at before update on public.claims for each row execute function public.set_updated_at();
create trigger analysis_jobs_updated_at before update on public.analysis_jobs for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.attachments enable row level security;
alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.analysis_jobs enable row level security;

revoke all on public.profiles, public.entries, public.attachments, public.claims, public.claim_evidence, public.analysis_jobs from anon;
grant select, insert, update, delete on public.profiles, public.entries, public.attachments, public.claims, public.claim_evidence, public.analysis_jobs to authenticated;

create policy "profiles own row" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "entries own rows" on public.entries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "attachments own rows" on public.attachments for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "claims own rows" on public.claims for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "evidence own rows" on public.claim_evidence for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "jobs own rows" on public.analysis_jobs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('memory-media', 'memory-media', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic','audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "media owner select" on storage.objects for select to authenticated
using (bucket_id = 'memory-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media owner insert" on storage.objects for insert to authenticated
with check (bucket_id = 'memory-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'memory-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.claim_analysis_job(p_entry_id uuid, p_revision integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare
  v_claimed integer;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  update analysis_jobs
  set status = 'processing', attempt_count = attempt_count + 1, started_at = now(), completed_at = null, error = null
  where entry_id = p_entry_id and revision = p_revision and user_id = v_user_id and status in ('queued', 'failed');
  get diagnostics v_claimed = row_count;
  return v_claimed = 1;
end;
$$;

revoke all on function public.claim_analysis_job(uuid, integer) from public;
grant execute on function public.claim_analysis_job(uuid, integer) to authenticated;

create function public.apply_entry_analysis(
  p_entry_id uuid,
  p_revision integer,
  p_claims jsonb,
  p_transcripts jsonb default '{}'::jsonb,
  p_ocr jsonb default '{}'::jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_user_id uuid := (select auth.uid());
  v_claim jsonb;
  v_claim_id uuid;
  v_attachment_id uuid;
  v_supersedes uuid;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from entries where id = p_entry_id and user_id = v_user_id and revision = p_revision) then
    raise exception 'entry or revision not found';
  end if;

  update claims set lifecycle = 'active'
  where id in (select supersedes_claim_id from claims where source_entry_id = p_entry_id and source_revision = p_revision and supersedes_claim_id is not null)
    and user_id = v_user_id;
  delete from claims where source_entry_id = p_entry_id and source_revision = p_revision and user_id = v_user_id;

  update attachments set transcript = p_transcripts ->> id::text, ocr_text = p_ocr ->> id::text
  where entry_id = p_entry_id and user_id = v_user_id
    and (p_transcripts ? id::text or p_ocr ? id::text);

  for v_claim in select value from jsonb_array_elements(p_claims)
  loop
    v_attachment_id := nullif(v_claim ->> 'attachmentId', '')::uuid;
    v_supersedes := nullif(v_claim ->> 'supersedesClaimId', '')::uuid;
    if v_attachment_id is not null and not exists (select 1 from attachments where id = v_attachment_id and entry_id = p_entry_id and user_id = v_user_id) then
      raise exception 'attachment evidence does not belong to entry';
    end if;
    if v_supersedes is not null then
      update claims set lifecycle = 'superseded' where id = v_supersedes and user_id = v_user_id;
      if not found then raise exception 'superseded claim not found'; end if;
    end if;
    v_claim_id := gen_random_uuid();
    insert into claims(id, user_id, category, statement, evidence_level, review_status, lifecycle, happened_at, supersedes_claim_id, source_entry_id, source_revision)
    values (v_claim_id, v_user_id, v_claim ->> 'category', v_claim ->> 'statement', v_claim ->> 'evidenceLevel', 'unreviewed', 'active', (v_claim ->> 'happenedAt')::timestamptz, v_supersedes, p_entry_id, p_revision);
    insert into claim_evidence(user_id, claim_id, entry_id, attachment_id, quote)
    values (v_user_id, v_claim_id, p_entry_id, v_attachment_id, nullif(v_claim ->> 'evidenceQuote', ''));
  end loop;

  update entries set analysis_status = 'completed', analysis_error = null where id = p_entry_id and user_id = v_user_id;
  update analysis_jobs set status = 'completed', error = null, completed_at = now()
  where entry_id = p_entry_id and revision = p_revision and user_id = v_user_id;
end;
$$;

revoke all on function public.apply_entry_analysis(uuid, integer, jsonb, jsonb, jsonb) from public;
grant execute on function public.apply_entry_analysis(uuid, integer, jsonb, jsonb, jsonb) to authenticated;
