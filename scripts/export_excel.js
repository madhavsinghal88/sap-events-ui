const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const events = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/events.json'), 'utf8'));

function extractTime(rawDate) {
  if (!rawDate) return '';
  const cleaned = String(rawDate).replace(/&[a-z]+;/gi, ' ').trim();
  const part = cleaned.match(/[|·]\s*(.+)$/);
  if (part) {
    const timeMatch = part[1].match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)(?:\s*[–-]\s*(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?))?/i);
    return timeMatch ? timeMatch[0].trim() : '';
  }
  const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)(?:\s*[–-]\s*(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?))?/i);
  return timeMatch ? timeMatch[0].trim() : '';
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  let d = dateStr.replace(/\s*[|·]\s*.*$/, '');
  d = d.replace(/\s+\d{1,2}:\d{2}.*$/, '');
  return d.trim();
}

const headers = ['Date', 'Time', 'Upcoming', 'Title', 'Company', 'Type', 'Location', 'Status', 'Link'];

function isUpcoming(dateStr) {
  if (!dateStr) return 'No';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'No';
  return d > new Date() ? 'Yes' : 'No';
}

const rows = events.map(e => [
  normalizeDate(e.date),
  extractTime(e.date),
  isUpcoming(e.date),
  e.title,
  e.company,
  e.type,
  e.location,
  e.status,
  e.link || ''
]);

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

ws['!cols'] = [
  { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 50 },
  { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 12 },
  { wch: 60 },
];
ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };

const linkCol = 8;
events.forEach((e, idx) => {
  const cellRef = XLSX.utils.encode_cell({ r: idx + 1, c: linkCol });
  if (e.link && ws[cellRef]) {
    ws[cellRef].l = { Target: e.link, Tooltip: 'Open link' };
  }
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Events');
XLSX.writeFile(wb, path.join(__dirname, '../sap-events.xlsx'));

console.log(`Exported ${events.length} events to sap-events.xlsx`);
