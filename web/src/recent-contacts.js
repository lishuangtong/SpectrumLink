const clean = (value, max) => String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
const STORAGE_KEY = 'spectrumlink.recentContacts.v1';

function validDate(value) {
  const text = String(value ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]) ? text : '';
}

export function normalizeRecentContacts(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const callsign = String(row?.callsign ?? '').toUpperCase().replace(/[^A-Z0-9/-]/g, '').slice(0, 12);
    if (!callsign) return [];
    const qth = clean(row?.qth, 24) || '未知 QTH';
    const date = validDate(row?.date);
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(row?.time ?? '')) ? String(row.time) : '--:--';
    return [{ callsign, qth, date, time }];
  }).slice(0, 12);
}

export function formatContactDateTime(contact) {
  const date = validDate(contact?.date);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(contact?.time ?? '')) ? String(contact.time) : '--:--';
  return `${date ? date.slice(5) : '-- --'} ${time}`;
}

export function loadRecentContacts(storage, fallback = []) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    const normalized = normalizeRecentContacts(saved);
    return normalized.length ? normalized : normalizeRecentContacts(fallback);
  } catch {
    return normalizeRecentContacts(fallback);
  }
}

export function saveRecentContacts(storage, rows) {
  const normalized = normalizeRecentContacts(rows);
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function upsertRecentContact(rows, contact, index = null) {
  const normalized = normalizeRecentContacts([contact]);
  if (!normalized.length) return normalizeRecentContacts(rows);
  const result = normalizeRecentContacts(rows);
  if (Number.isInteger(index) && index >= 0 && index < result.length) result[index] = normalized[0];
  else result.unshift(normalized[0]);
  return result.slice(0, 12);
}

export function renderRecentContacts(container, rows, documentRef = document, onEdit = null) {
  const contacts = normalizeRecentContacts(rows);
  container.replaceChildren();
  const header = documentRef.createElement('div'); header.className = 'contact-table-head';
  for (const label of ['日期 / 时间', '呼号', 'QTH']) { const cell = documentRef.createElement('span'); cell.textContent = label; header.append(cell); }
  const track = documentRef.createElement('div'); track.className = 'contact-track';
  const displayRows = contacts.length ? [...contacts, ...contacts] : [{ callsign: '等待通联', qth: '暂无记录', date: '', time: '--:--' }];
  displayRows.forEach((contact, index) => {
    const row = documentRef.createElement('div'); row.className = 'contact-row';
    const contactIndex = contacts.length ? index % contacts.length : -1;
    if (index >= contacts.length && contacts.length) row.setAttribute('aria-hidden', 'true');
    else if (contactIndex >= 0 && onEdit) {
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `编辑 ${contact.callsign} 通联记录`);
      row.addEventListener('click', () => onEdit(contact, contactIndex));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEdit(contact, contactIndex); }
      });
    }
    const callsign = documentRef.createElement('strong'); callsign.textContent = contact.callsign;
    const qth = documentRef.createElement('span'); qth.textContent = contact.qth;
    const time = documentRef.createElement('time'); time.textContent = formatContactDateTime(contact);
    if (contact.date && contact.time !== '--:--') time.dateTime = `${contact.date}T${contact.time}`;
    row.append(time, callsign, qth); track.append(row);
  });
  container.append(header, track);
  return contacts;
}
