#!/usr/bin/env bash
# Shared PostgreSQL-only environment for local ops-web E2E runners.

: "${DATABASE_URL:?DATABASE_URL required for PostgreSQL E2E}"
export DATABASE_URL
export PTT_LEADS_READ_SOURCE="${PTT_LEADS_READ_SOURCE:-pg}"
export PTT_LEADS_WRITE_SOURCE="${PTT_LEADS_WRITE_SOURCE:-pg}"
