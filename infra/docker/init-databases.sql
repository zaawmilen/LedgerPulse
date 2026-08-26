-- Runs automatically by the official postgres image on first init of a
-- fresh volume (docker-entrypoint-initdb.d). POSTGRES_DB already creates
-- ledgerpulse_dev; this creates the second database the test suite needs
-- so `docker compose up -d` alone is enough to run both migrate targets.
CREATE DATABASE ledgerpulse_test;