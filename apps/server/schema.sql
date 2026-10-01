CREATE TABLE IF NOT EXISTS participants (
 id text PRIMARY KEY, email text UNIQUE, nickname text NOT NULL, kind text NOT NULL CHECK(kind IN ('human','agent')), model text,
 admin boolean NOT NULL DEFAULT false, consent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_links (hash text PRIMARY KEY, email text NOT NULL, nickname text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (hash text PRIMARY KEY, participant_id text NOT NULL REFERENCES participants(id), csrf text NOT NULL, expires_at timestamptz NOT NULL, idle_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS agent_tokens (hash text PRIMARY KEY, participant_id text NOT NULL REFERENCES participants(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS questions (id text PRIMARY KEY, record jsonb NOT NULL, status text NOT NULL CHECK(status IN ('draft','open','closed','provisional','resolved','void')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS forecast_events (id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE, question_id text NOT NULL REFERENCES questions(id), participant_id text NOT NULL REFERENCES participants(id), client_id text NOT NULL, body jsonb NOT NULL, UNIQUE(question_id,participant_id,client_id));
CREATE TABLE IF NOT EXISTS resolutions (id text PRIMARY KEY, question_id text NOT NULL REFERENCES questions(id), body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS disputes (id text PRIMARY KEY, question_id text NOT NULL REFERENCES questions(id), participant_id text NOT NULL REFERENCES participants(id), reason text NOT NULL, status text NOT NULL DEFAULT 'open', response text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS anchors (id text PRIMARY KEY, question_id text NOT NULL REFERENCES questions(id), kind text NOT NULL, upto bigint NOT NULL, metadata jsonb NOT NULL, state text NOT NULL CHECK(state IN ('pending','confirmed','failed')), proof jsonb, error text, attempts integer NOT NULL DEFAULT 0, UNIQUE(question_id,kind,upto));
CREATE TABLE IF NOT EXISTS local_ledger (id text PRIMARY KEY, metadata jsonb NOT NULL, confirmed_at text NOT NULL);
CREATE TABLE IF NOT EXISTS baseline_spend (id text PRIMARY KEY, month text NOT NULL, participant_id text NOT NULL REFERENCES participants(id), reserved_cents integer NOT NULL CHECK(reserved_cents>=0), status text NOT NULL DEFAULT 'reserved');
CREATE TABLE IF NOT EXISTS ops_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, kind text NOT NULL, question_id text, error text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION forecast_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forecast history and commitments are append-only'; END $$;
DROP TRIGGER IF EXISTS forecast_immutable_guard ON forecast_events;
CREATE TRIGGER forecast_immutable_guard BEFORE UPDATE OR DELETE ON forecast_events FOR EACH ROW EXECUTE FUNCTION forecast_immutable();
DROP TRIGGER IF EXISTS resolution_immutable_guard ON resolutions;
CREATE TRIGGER resolution_immutable_guard BEFORE UPDATE OR DELETE ON resolutions FOR EACH ROW EXECUTE FUNCTION forecast_immutable();
DROP TRIGGER IF EXISTS ledger_immutable_guard ON local_ledger;
CREATE TRIGGER ledger_immutable_guard BEFORE UPDATE OR DELETE ON local_ledger FOR EACH ROW EXECUTE FUNCTION forecast_immutable();

CREATE TABLE IF NOT EXISTS agent_owners(owner_id text REFERENCES participants(id),agent_id text REFERENCES participants(id),PRIMARY KEY(owner_id,agent_id));

ALTER TABLE questions ADD COLUMN IF NOT EXISTS finalization jsonb;

ALTER TABLE resolutions ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;
CREATE OR REPLACE FUNCTION question_rule_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status <> 'draft' AND NEW.record IS DISTINCT FROM OLD.record THEN RAISE EXCEPTION 'Published question rules are immutable'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS question_rule_guard ON questions;
CREATE TRIGGER question_rule_guard BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION question_rule_immutable();
CREATE OR REPLACE FUNCTION anchor_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.metadata IS DISTINCT FROM OLD.metadata OR NEW.question_id <> OLD.question_id OR NEW.kind <> OLD.kind OR NEW.upto <> OLD.upto THEN RAISE EXCEPTION 'Anchor commitments are immutable'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS anchor_metadata_guard ON anchors;
CREATE TRIGGER anchor_metadata_guard BEFORE UPDATE ON anchors FOR EACH ROW EXECUTE FUNCTION anchor_immutable();
