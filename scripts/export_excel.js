const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const events = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/events.json'), 'utf8'));

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  
  // Handle various date formats
  let cleaned = dateStr.replace(/\|/g, '').replace(/·/g, '').trim();
  
  // Try to parse with Date
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  
  // Return original if can't parse
  return cleaned;
}

const headers = ['Date', 'Title', 'Company', 'Type', 'Location', 'Status', 'Link'];

const rows = events.map(e => [
  normalizeDate(e.date),
  e.title,
  e.company,
  e.type,
  e.location,
  e.status,
  e.link || ''
]);

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

// Set column widths
ws['!cols'] = [
  { wch: 12 },  // Date
  { wch: 50 },  // Title
  { wch: 10 },  // Company
  { wch: 15 },  // Type
  { wch: 30 },  // Location
  { wch: 12 },  // Status
  { wch: 60 },  // Link
];

// Add hyperlinks to Link column
const linkCol = 6; // 0-indexed
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
