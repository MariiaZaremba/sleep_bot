import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

// ───── USERS ─────

async function getUser(chatId) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'users!A:L',
  });

  const rows = res.data.values || [];
  const headers = rows[0];
  const row = rows.find(r => r[0] === String(chatId));
  if (!row) return null;

  return Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']));
}

async function createUser(data) {
  const sheets = await getSheets();
  const row = [
    String(data.chat_id),
    data.name,
    data.timezone,
    data.wake_time,
    data.bed_time,
    data.sleep_hours,
    data.evening_notify || '21:00',
    data.morning_notify || '07:00',
    data.start_date,
    '1',        // day_current
    'active',   // status
    '',         // reasons_why
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'users!A:L',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

async function updateUserDay(chatId, dayNum) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'users!A:A',
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === String(chatId));
  if (rowIndex === -1) return;

  // day_current — колонка J (індекс 9, рядок rowIndex+1)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `users!J${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[String(dayNum)]] },
  });
}

async function getActiveUsers() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'users!A:L',
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows
    .slice(1)
    .filter(r => r[10] === 'active') // status === active
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

// ───── DAILY LOGS ─────

async function saveLog(data) {
  const sheets = await getSheets();
  const row = [
    String(data.chat_id),
    data.date,
    String(data.day_num),
    data.task_done ? 'TRUE' : 'FALSE',
    data.skip_reasons || '',
    data.bed_time_actual || '',
    data.wake_time_actual || '',
    data.sleep_quality ? String(data.sleep_quality) : '',
    data.sleep_hours_actual ? String(data.sleep_hours_actual) : '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'daily_logs!A:I',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

async function getUserLogs(chatId) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'daily_logs!A:I',
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows
    .slice(1)
    .filter(r => r[0] === String(chatId))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

// ───── TASKS ─────

async function getTask(dayNum) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'tasks!A:E',
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return null;

  const headers = rows[0];
  const row = rows.find(r => r[0] === String(dayNum));
  if (!row) return null;

  return Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']));
}

export {
  getUser,
  createUser,
  updateUserDay,
  getActiveUsers,
  saveLog,
  getUserLogs,
  getTask,
};
