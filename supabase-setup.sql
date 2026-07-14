-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_applied',
  company TEXT NOT NULL DEFAULT 'SAP',
  sapi_id TEXT NOT NULL DEFAULT '',
  in_person BOOLEAN NOT NULL DEFAULT false,
  virtual_live BOOLEAN NOT NULL DEFAULT false,
  virtual_on_demand BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS sync_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
