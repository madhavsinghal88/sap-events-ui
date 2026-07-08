const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SHEET_NAME = 'Events';
const HEADERS = ['id', 'title', 'date', 'location', 'type', 'link', 'status'];

function resolveCredentialsPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return path.resolve(fromEnv);
  }

  const defaultPath = path.join(process.cwd(), 'credentials', 'google-service-account.json');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
}

function loadServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  const credentialsPath = resolveCredentialsPath();
  if (!credentialsPath) {
    return null;
  }

  return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
}

function getCredentialHelp() {
  return [
    'Google credentials not found. To fix:',
    '1. Google Cloud Console -> APIs & Services -> Credentials',
    '2. Create a Service Account and download the JSON key',
    '3. Save it as credentials/google-service-account.json',
    '4. Enable Google Sheets API for the project',
    '5. Share your sheet with the service account email (Editor)',
    '6. Set GOOGLE_SHEET_ID in .env.local',
    '',
    'Or set GOOGLE_APPLICATION_CREDENTIALS to the JSON file path.',
  ].join('\n');
}

async function getSheetsClient() {
  const credentials = loadServiceAccount();
  if (!credentials) {
    throw new Error(getCredentialHelp());
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

function rowsToEvents(rows) {
  if (!rows || rows.length < 2) {
    return [];
  }

  const header = rows[0].map((value) => String(value).trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const event = {};
    HEADERS.forEach((key) => {
      const index = header.indexOf(key);
      event[key] = index >= 0 ? (row[index] ?? '') : '';
    });
    return event;
  }).filter((event) => event.id && event.title);
}

function eventsToRows(events) {
  return [
    HEADERS,
    ...events.map((event) => HEADERS.map((key) => event[key] ?? '')),
  ];
}

async function ensureSheet(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === SHEET_NAME);

  if (existing) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: SHEET_NAME },
          },
        },
      ],
    },
  });
}

async function readEventsFromSheet() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set in .env.local');
  }

  const sheets = await getSheetsClient();
  await ensureSheet(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:G`,
  });

  return rowsToEvents(response.data.values || []);
}

async function writeEventsToSheet(events) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set in .env.local');
  }

  const sheets = await getSheetsClient();
  await ensureSheet(sheets, spreadsheetId);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_NAME}!A:G`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: eventsToRows(events),
    },
  });
}

const SYNC_INFO_SHEET_NAME = 'SyncInfo';

async function readLastSyncFromSheet() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return null;
  const sheets = await getSheetsClient();
  
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === SYNC_INFO_SHEET_NAME);
  if (!existing) return null;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SYNC_INFO_SHEET_NAME}!A1`,
  });

  const val = response.data.values?.[0]?.[0];
  return val ? new Date(val).toISOString() : null;
}

async function writeLastSyncToSheet(timestamp) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;
  const sheets = await getSheetsClient();
  
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === SYNC_INFO_SHEET_NAME);
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: SYNC_INFO_SHEET_NAME },
            },
          },
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SYNC_INFO_SHEET_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[timestamp]],
    },
  });
}

function hasGoogleCredentials() {
  return Boolean(loadServiceAccount() && process.env.GOOGLE_SHEET_ID);
}

module.exports = {
  hasGoogleCredentials,
  readEventsFromSheet,
  writeEventsToSheet,
  readLastSyncFromSheet,
  writeLastSyncToSheet,
  getCredentialHelp,
};
