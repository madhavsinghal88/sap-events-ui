const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_INDEX = Object.fromEntries(
  MONTHS.map((month, index) => [month.toLowerCase(), index])
);

function cleanHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function capitalizeMonth(month) {
  const normalized = String(month || '').toLowerCase();
  const match = MONTHS.find((name) => name.toLowerCase() === normalized);
  return match || month;
}

function normalizeDashes(value) {
  return String(value)
    .replace(/[–—−]/g, '–')
    .replace(/\s*-\s*/g, ' – ');
}

function extractDateFromUrl(link = '') {
  const match = String(link).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

function normalizeEventTitle(title) {
  let cleaned = cleanHtml(title);
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\s*\|\s*/g, ' | ');
  cleaned = cleaned.replace(/^\|\s*/, '').replace(/\s*\|$/, '');
  return cleaned;
}

function formatEventDate(rawDate, link = '') {
  if (!rawDate) {
    return extractDateFromUrl(link) || 'Date TBC';
  }

  let date = cleanHtml(String(rawDate)).trim();
  if (!date || date.toUpperCase() === 'TBC') {
    return extractDateFromUrl(link) || 'Date TBC';
  }

  date = date.replace(/\s00:00:00/g, '');
  date = date.replace(/\s[A-Z]{3,4}$/, '');
  date = normalizeDashes(date);

  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
  }

  const crossMonth = date.match(/^(\d{1,2})\s+([A-Za-z]+)\s*–\s*(\d{1,2})\s+([A-Za-z]+),?\s*(\d{4})$/);
  if (crossMonth) {
    const [, day1, month1, day2, month2, year] = crossMonth;
    return `${capitalizeMonth(month1)} ${Number(day1)} – ${capitalizeMonth(month2)} ${Number(day2)}, ${year}`;
  }

  const dayFirstRange = date.match(/^(\d{1,2})\s*–\s*(\d{1,2})\s+([A-Za-z]+),?\s*(\d{4})$/);
  if (dayFirstRange) {
    const [, day1, day2, month, year] = dayFirstRange;
    return `${capitalizeMonth(month)} ${Number(day1)}–${Number(day2)}, ${year}`;
  }

  const monthFirstRange = date.match(/^([A-Za-z]+)\s+(\d{1,2})\s*–\s*(\d{1,2}),?\s*(\d{4})$/);
  if (monthFirstRange) {
    const [, month, day1, day2, year] = monthFirstRange;
    return `${capitalizeMonth(month)} ${Number(day1)}–${Number(day2)}, ${year}`;
  }

  const singleMonthFirst = date.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (singleMonthFirst) {
    const [, month, day, year] = singleMonthFirst;
    return `${capitalizeMonth(month)} ${Number(day)}, ${year}`;
  }

  const dayFirstSingle = date.match(/^(\d{1,2})\s+([A-Za-z]+),?\s*(\d{4})$/);
  if (dayFirstSingle) {
    const [, day, month, year] = dayFirstSingle;
    return `${capitalizeMonth(month)} ${Number(day)}, ${year}`;
  }

  const ordinalDate = date.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th),?\s*(\d{4})$/i);
  if (ordinalDate) {
    const [, month, day, year] = ordinalDate;
    return `${capitalizeMonth(month)} ${Number(day)}, ${year}`;
  }

  const monthYear = date.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    return `${capitalizeMonth(monthYear[1])} ${monthYear[2]}`;
  }

  return date.replace(/,(\d{4})/, ', $1');
}

function parseEventDate(dateStr, link = '') {
  const normalized = formatEventDate(dateStr, link);
  if (normalized === 'Date TBC') {
    return new Date(0);
  }

  const crossMonth = normalized.match(/^([A-Za-z]+)\s+(\d{1,2})\s*–\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (crossMonth) {
    const [, month1, day1, , , year] = crossMonth;
    return new Date(`${month1} ${day1}, ${year}`);
  }

  const range = normalized.match(/^([A-Za-z]+)\s+(\d{1,2})–(\d{1,2}),\s*(\d{4})$/);
  if (range) {
    const [, month, day1, , year] = range;
    return new Date(`${month} ${day1}, ${year}`);
  }

  const single = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (single) {
    return new Date(`${single[1]} ${single[2]}, ${single[3]}`);
  }

  const monthYear = normalized.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    return new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(0);
}

function extractTime(rawDate) {
  if (!rawDate) return '';
  const cleaned = cleanHtml(String(rawDate)).trim();
  const part = cleaned.match(/[|·]\s*(.+)$/);
  if (part) {
    const timeMatch = part[1].match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)(?:\s*[–-]\s*(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?))?/i);
    return timeMatch ? timeMatch[0].trim() : '';
  }
  const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)(?:\s*[–-]\s*(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?))?/i);
  return timeMatch ? timeMatch[0].trim() : '';
}

function normalizeEvent(event = {}) {
  const link = event.link || '';
  return {
    ...event,
    title: normalizeEventTitle(event.title),
    date: formatEventDate(event.date, link),
    time: extractTime(event.date),
  };
}

function normalizeEvents(events = []) {
  return events.map((event) => normalizeEvent(event));
}

module.exports = {
  MONTHS,
  cleanHtml,
  normalizeEventTitle,
  formatEventDate,
  parseEventDate,
  extractTime,
  normalizeEvent,
  normalizeEvents,
  extractDateFromUrl,
};
