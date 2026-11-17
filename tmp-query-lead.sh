#!/bin/bash
docker exec rnosai-postgres psql -U ptt -d rnosaidb -c "SELECT sqlite_lead_id, phone, full_name, created_at FROM crm_leads WHERE phone='0903000777' LIMIT 1;"
