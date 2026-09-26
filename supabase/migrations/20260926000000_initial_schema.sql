create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  native_language text,
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  code varchar(16) not null unique,
  name text not null,
  native_name text not null,
  bcp47 varchar(32) not null,
  iso_639_1 varchar(2),
  iso_639_3 varchar(3),
  script_code varchar(16),
  direction varchar(3) not null default 'ltr' check (direction in ('ltr', 'rtl')),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lexemes (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages(id) on delete restrict,
  term text not null,
  normalized_term text not null,
  romanization text,
  phonetic text,
  audio_url text,
  source varchar(80),
  source_reference text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_id, normalized_term)
);

create table if not exists public.senses (
  id uuid primary key default gen_random_uuid(),
  lexeme_id uuid not null references public.lexemes(id) on delete cascade,
  part_of_speech varchar(80),
  definition text not null,
  definition_language_id uuid references public.languages(id) on delete restrict,
  order_index integer not null default 0,
  source varchar(80),
  created_at timestamptz not null default now(),
  unique (lexeme_id, definition_language_id, definition, part_of_speech)
);

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  sense_id uuid not null references public.senses(id) on delete cascade,
  target_language_id uuid not null references public.languages(id) on delete restrict,
  translation text not null,
  romanization text,
  source varchar(80),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (sense_id, target_language_id, translation)
);

create table if not exists public.examples (
  id uuid primary key default gen_random_uuid(),
  sense_id uuid not null references public.senses(id) on delete cascade,
  sentence text not null,
  sentence_translation text,
  language_id uuid not null references public.languages(id) on delete restrict,
  source varchar(80),
  created_at timestamptz not null default now(),
  unique (sense_id, sentence)
);

create table if not exists public.lexicon_cache (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  language_code varchar(16) not null,
  target_language_code varchar(16) not null,
  provider varchar(80) not null,
  result jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (query, language_code, target_language_code, provider)
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  source_language_id uuid not null references public.languages(id) on delete restrict,
  target_language_id uuid not null references public.languages(id) on delete restrict,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_language_id <> target_language_id)
);

create table if not exists public.deck_items (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  lexeme_id uuid not null references public.lexemes(id) on delete restrict,
  preferred_translation_id uuid references public.translations(id) on delete set null,
  custom_meaning text,
  custom_note text,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  unique (deck_id, lexeme_id)
);

create table if not exists public.review_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_item_id uuid not null unique references public.deck_items(id) on delete cascade,
  mastery numeric not null default 0 check (mastery between 0 and 1),
  difficulty numeric not null default 0.5 check (difficulty between 0 and 1),
  stability numeric not null default 1 check (stability > 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  streak integer not null default 0 check (streak >= 0),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  title text not null,
  difficulty varchar(32) not null default 'adaptive',
  generator varchar(32) not null default 'deterministic',
  ai_model text,
  prompt_version text,
  total_questions integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_questions (
  id uuid primary key default gen_random_uuid(),
  exercise_set_id uuid not null references public.exercise_sets(id) on delete cascade,
  vocabulary_id uuid references public.deck_items(id) on delete set null,
  type varchar(40) not null,
  prompt text not null,
  payload jsonb not null default '{}'::jsonb,
  answer jsonb not null default '{}'::jsonb,
  explanation text,
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  order_index integer not null default 0
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  exercise_set_id uuid references public.exercise_sets(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  duration_seconds integer
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid references public.exercise_questions(id) on delete set null,
  deck_item_id uuid references public.deck_items(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_answer jsonb not null default '{}'::jsonb,
  is_correct boolean not null,
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_lexemes_language_term on public.lexemes(language_id, normalized_term);
create index if not exists idx_decks_user on public.decks(user_id, is_archived);
create index if not exists idx_deck_items_deck on public.deck_items(deck_id);
create index if not exists idx_review_next on public.review_states(user_id, next_review_at);
create index if not exists idx_attempts_session on public.question_attempts(session_id);
create index if not exists idx_cache_lookup on public.lexicon_cache(query, language_code, target_language_code, expires_at);

insert into public.languages (code, name, native_name, bcp47, iso_639_1, iso_639_3, script_code, direction)
values
  ('en', 'English', 'English', 'en', 'en', 'eng', 'Latn', 'ltr'),
  ('vi', 'Vietnamese', 'Tiếng Việt', 'vi', 'vi', 'vie', 'Latn', 'ltr'),
  ('ja', 'Japanese', '日本語', 'ja', 'ja', 'jpn', 'Jpan', 'ltr'),
  ('ko', 'Korean', '한국어', 'ko', 'ko', 'kor', 'Kore', 'ltr')
on conflict (code) do update set name = excluded.name, native_name = excluded.native_name, is_enabled = true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.import_vocabulary_batch(p_user_id uuid, p_deck_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_sense jsonb;
  v_translation jsonb;
  v_example jsonb;
  v_language_id uuid;
  v_definition_language_id uuid;
  v_target_language_id uuid;
  v_lexeme_id uuid;
  v_sense_id uuid;
  v_translation_id uuid;
  v_inserted integer := 0;
  v_duplicate integer := 0;
  v_failed integer := 0;
  v_normalized text;
begin
  if not exists (select 1 from public.decks where id = p_deck_id and user_id = p_user_id and not is_archived) then
    raise exception 'DECK_NOT_FOUND';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      select id into v_language_id from public.languages where code = v_item ->> 'languageCode' and is_enabled;
      v_normalized := coalesce(nullif(v_item ->> 'normalizedTerm', ''), lower(trim(v_item ->> 'term')));
      if v_language_id is null or v_normalized is null or v_normalized = '' then
        v_failed := v_failed + 1;
        continue;
      end if;

      insert into public.lexemes (language_id, term, normalized_term, romanization, phonetic, audio_url, source, source_reference, source_payload)
      values (v_language_id, coalesce(v_item ->> 'term', v_normalized), v_normalized, nullif(v_item ->> 'romanization', ''), nullif(v_item ->> 'phonetic', ''), nullif(v_item ->> 'audioUrl', ''), nullif(v_item ->> 'source', ''), nullif(v_item ->> 'sourceReference', ''), coalesce(v_item -> 'sourcePayload', '{}'::jsonb))
      on conflict (language_id, normalized_term) do update set
        term = coalesce(nullif(excluded.term, ''), public.lexemes.term),
        romanization = coalesce(excluded.romanization, public.lexemes.romanization),
        phonetic = coalesce(excluded.phonetic, public.lexemes.phonetic),
        audio_url = coalesce(excluded.audio_url, public.lexemes.audio_url),
        updated_at = now()
      returning id into v_lexeme_id;

      for v_sense in select value from jsonb_array_elements(coalesce(v_item -> 'senses', '[]'::jsonb)) loop
        select id into v_definition_language_id from public.languages where code = coalesce(v_sense ->> 'definitionLanguageCode', v_item ->> 'languageCode');
        insert into public.senses (lexeme_id, part_of_speech, definition, definition_language_id, order_index, source)
        values (v_lexeme_id, nullif(v_sense ->> 'partOfSpeech', ''), coalesce(nullif(v_sense ->> 'definition', ''), 'No definition available'), v_definition_language_id, coalesce((v_sense ->> 'orderIndex')::integer, 0), nullif(v_sense ->> 'source', ''))
        on conflict (lexeme_id, definition_language_id, definition, part_of_speech) do update set source = coalesce(excluded.source, public.senses.source)
        returning id into v_sense_id;

        for v_translation in select value from jsonb_array_elements(coalesce(v_sense -> 'translations', '[]'::jsonb)) loop
          select id into v_target_language_id from public.languages where code = coalesce(v_translation ->> 'targetLanguageCode', v_item ->> 'targetLanguageCode');
          if v_target_language_id is not null and nullif(v_translation ->> 'translation', '') is not null then
            insert into public.translations (sense_id, target_language_id, translation, romanization, source, confidence)
            values (v_sense_id, v_target_language_id, v_translation ->> 'translation', nullif(v_translation ->> 'romanization', ''), nullif(v_translation ->> 'source', ''), nullif(v_translation ->> 'confidence', '')::numeric)
            on conflict (sense_id, target_language_id, translation) do nothing;
          end if;
        end loop;

        for v_example in select value from jsonb_array_elements(coalesce(v_sense -> 'examples', '[]'::jsonb)) loop
          select id into v_definition_language_id from public.languages where code = coalesce(v_example ->> 'languageCode', v_item ->> 'languageCode');
          if nullif(v_example ->> 'sentence', '') is not null and v_definition_language_id is not null then
            insert into public.examples (sense_id, sentence, sentence_translation, language_id, source)
            values (v_sense_id, v_example ->> 'sentence', nullif(v_example ->> 'sentenceTranslation', ''), v_definition_language_id, nullif(v_example ->> 'source', ''))
            on conflict (sense_id, sentence) do nothing;
          end if;
        end loop;
      end loop;

      if exists (select 1 from public.deck_items where deck_id = p_deck_id and lexeme_id = v_lexeme_id) then
        v_duplicate := v_duplicate + 1;
      else
        insert into public.deck_items (deck_id, lexeme_id) values (p_deck_id, v_lexeme_id);
        v_inserted := v_inserted + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'duplicate', v_duplicate, 'failed', v_failed);
end;
$$;

create or replace function public.record_review(p_user_id uuid, p_deck_item_id uuid, p_is_correct boolean, p_response_time_ms integer default 0)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_state public.review_states%rowtype;
  v_gain numeric;
  v_days integer;
begin
  if not exists (
    select 1 from public.deck_items di join public.decks d on d.id = di.deck_id
    where di.id = p_deck_item_id and d.user_id = p_user_id and not d.is_archived
  ) then
    raise exception 'VOCABULARY_NOT_FOUND';
  end if;

  select * into v_state from public.review_states where deck_item_id = p_deck_item_id for update;
  if not found then
    v_state.id := gen_random_uuid();
    v_state.user_id := p_user_id;
    v_state.deck_item_id := p_deck_item_id;
    v_state.mastery := 0;
    v_state.difficulty := 0.5;
    v_state.stability := 1;
    v_state.correct_count := 0;
    v_state.incorrect_count := 0;
    v_state.streak := 0;
  end if;

  if p_is_correct then
    v_gain := case when p_response_time_ms between 1 and 5000 then 0.08 else 0.04 end;
    v_state.mastery := least(1, greatest(0, v_state.mastery + v_gain));
    v_state.stability := least(365, greatest(1, v_state.stability * 1.25));
    v_state.streak := v_state.streak + 1;
    v_state.correct_count := v_state.correct_count + 1;
    v_days := greatest(1, round(v_state.stability)::integer);
    v_state.next_review_at := now() + make_interval(days => v_days);
  else
    v_state.mastery := greatest(0, v_state.mastery - 0.1);
    v_state.stability := greatest(1, v_state.stability * 0.7);
    v_state.streak := 0;
    v_state.incorrect_count := v_state.incorrect_count + 1;
    v_state.next_review_at := now() + make_interval(mins => 10);
  end if;
  v_state.last_reviewed_at := now();
  v_state.updated_at := now();

  insert into public.review_states (id, user_id, deck_item_id, mastery, difficulty, stability, correct_count, incorrect_count, streak, last_reviewed_at, next_review_at, updated_at)
  values (v_state.id, p_user_id, v_state.deck_item_id, v_state.mastery, v_state.difficulty, v_state.stability, v_state.correct_count, v_state.incorrect_count, v_state.streak, v_state.last_reviewed_at, v_state.next_review_at, v_state.updated_at)
  on conflict (deck_item_id) do update set user_id = excluded.user_id, mastery = excluded.mastery, difficulty = excluded.difficulty, stability = excluded.stability, correct_count = excluded.correct_count, incorrect_count = excluded.incorrect_count, streak = excluded.streak, last_reviewed_at = excluded.last_reviewed_at, next_review_at = excluded.next_review_at, updated_at = excluded.updated_at;

  return (select to_jsonb(rs) from public.review_states rs where rs.deck_item_id = p_deck_item_id);
end;
$$;

alter table public.profiles enable row level security;
alter table public.languages enable row level security;
alter table public.lexemes enable row level security;
alter table public.senses enable row level security;
alter table public.translations enable row level security;
alter table public.examples enable row level security;
alter table public.lexicon_cache enable row level security;
alter table public.decks enable row level security;
alter table public.deck_items enable row level security;
alter table public.review_states enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.exercise_questions enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.question_attempts enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists languages_authenticated_read on public.languages;
create policy languages_authenticated_read on public.languages for select to authenticated using (is_enabled);
drop policy if exists lexemes_authenticated_read on public.lexemes;
create policy lexemes_authenticated_read on public.lexemes for select to authenticated using (true);
drop policy if exists senses_authenticated_read on public.senses;
create policy senses_authenticated_read on public.senses for select to authenticated using (true);
drop policy if exists translations_authenticated_read on public.translations;
create policy translations_authenticated_read on public.translations for select to authenticated using (true);
drop policy if exists examples_authenticated_read on public.examples;
create policy examples_authenticated_read on public.examples for select to authenticated using (true);

drop policy if exists decks_owner on public.decks;
create policy decks_owner on public.decks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists deck_items_owner on public.deck_items;
create policy deck_items_owner on public.deck_items for all using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid())) with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));
drop policy if exists review_states_owner on public.review_states;
create policy review_states_owner on public.review_states for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists exercise_sets_owner on public.exercise_sets;
create policy exercise_sets_owner on public.exercise_sets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists exercise_questions_owner on public.exercise_questions;
create policy exercise_questions_owner on public.exercise_questions for all using (exists (select 1 from public.exercise_sets es where es.id = exercise_set_id and es.user_id = auth.uid())) with check (exists (select 1 from public.exercise_sets es where es.id = exercise_set_id and es.user_id = auth.uid()));
drop policy if exists practice_sessions_owner on public.practice_sessions;
create policy practice_sessions_owner on public.practice_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists question_attempts_owner on public.question_attempts;
create policy question_attempts_owner on public.question_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.lexicon_cache from anon, authenticated;
revoke all on function public.import_vocabulary_batch(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.record_review(uuid, uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.import_vocabulary_batch(uuid, uuid, jsonb) to service_role;
grant execute on function public.record_review(uuid, uuid, boolean, integer) to service_role;
