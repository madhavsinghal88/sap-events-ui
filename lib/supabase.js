const { createClient } = require('@supabase/supabase-js');

const TABLE_EVENTS = 'events';
const TABLE_SYNC_INFO = 'sync_info';

let _client = null;

function getClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  _client = createClient(url, key);
  return _client;
}

function hasSupabaseCredentials() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title || '',
    date: row.date || '',
    location: row.location || '',
    type: row.type || '',
    link: row.link || '',
    status: row.status || 'not_applied',
    company: row.company || 'SAP',
    sapId: row.sapi_id || '',
    inPerson: row.in_person ?? false,
    virtualLive: row.virtual_live ?? false,
    virtualOnDemand: row.virtual_on_demand ?? false,
  };
}

async function readEventsFromDb() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE_EVENTS)
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return (data || []).map(rowToEvent);
}

async function writeEventsToDb(events) {
  const supabase = getClient();

  const { error: deleteError } = await supabase
    .from(TABLE_EVENTS)
    .delete()
    .neq('id', '__placeholder__');

  if (deleteError) throw new Error(`Supabase delete failed: ${deleteError.message}`);

  if (events.length === 0) return;

  const rows = events.map((e) => ({
    id: String(e.id),
    title: e.title || '',
    date: e.date || '',
    location: e.location || '',
    type: e.type || '',
    link: e.link || '',
    status: e.status || 'not_applied',
    company: e.company || 'SAP',
    sapi_id: e.sapId || '',
    in_person: e.inPerson ?? false,
    virtual_live: e.virtualLive ?? false,
    virtual_on_demand: e.virtualOnDemand ?? false,
  }));

  // PostgREST can reject very large single inserts — write in chunks.
  const CHUNK_SIZE = 200;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await supabase
      .from(TABLE_EVENTS)
      .insert(chunk);

    if (insertError) throw new Error(`Supabase insert failed: ${insertError.message}`);
  }
}

async function readLastSyncFromDb() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE_SYNC_INFO)
    .select('value')
    .eq('key', 'lastSynced')
    .single();

  if (error || !data) return null;
  return data.value;
}

async function writeLastSyncToDb(timestamp) {
  const supabase = getClient();
  const { error } = await supabase
    .from(TABLE_SYNC_INFO)
    .upsert({ key: 'lastSynced', value: timestamp }, { onConflict: 'key' });

  if (error) throw new Error(`Supabase lastSync write failed: ${error.message}`);
}

module.exports = {
  hasSupabaseCredentials,
  readEventsFromDb,
  writeEventsToDb,
  readLastSyncFromDb,
  writeLastSyncToDb,
};
