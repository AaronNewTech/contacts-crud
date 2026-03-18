// fetchJson(url, opts)
// A small wrapper around fetch that automatically attaches the CSRF token
// (read from <meta name="csrf-token">) for non-GET requests, sets
// `credentials: 'same-origin'`, and shows a friendly banner on 403 errors.
// Returns the raw fetch Response so callers can inspect status/json as needed.
async function fetchJson(url, opts = {}) {
  const options = Object.assign({}, opts);
  options.headers = Object.assign({}, options.headers || {});
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (!options.headers['X-CSRFToken'] && !options.headers['x-csrftoken']) {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta && meta.content) {
        options.headers['X-CSRFToken'] = meta.content;
      } else {
        if (!fetchJson._warnedNoMeta) {
          console.warn(
            'fetchJson: CSRF meta tag missing; AJAX requests requiring CSRF may fail.',
          );
          fetchJson._warnedNoMeta = true;
        }
      }
    }
  }
  if (!options.credentials) options.credentials = 'same-origin';

  const res = await fetch(url, options);
  if (res.status === 403) {
    try {
      showBanner(
        'Request blocked (permission or CSRF). Please refresh the page.',
        'error',
        5000,
      );
    } catch (e) {}
  }
  return res;
}

// renderCalendar(events)
// Render a simple vertical list of events into the `#contact-detail`
// pane. Each event shows title, contact name, and start/end meta.
function renderCalendar(events) {
  const detailEl = document.getElementById('contact-detail');
  if (!detailEl) return;
  let html = `<div class="calendar-view"><h2>Events list</h2>`;
  if (!events || !events.length) {
    html += `<div class="no-events">No scheduled events.</div>`;
  } else {
    html += `<div class="calendar-list">`;
    events.forEach((e) => {
      const startAttr = `${e.start_date}T${e.start_time}`;
      const endAttr = `${e.end_date}T${e.end_time}`;
      const contactName =
        `${e.contact_first_name || ''} ${e.contact_last_name || ''}`.trim();
      html += `
              <div class="event-row calendar-event" data-event-id="${e.id}" data-start="${startAttr}" data-end="${endAttr}">
                <div class="event-content">
                  <div class="event-text">
                    <div class="event-header">
                      <div class="event-title">${e.name || '(no title)'} — <span class="event-contact">${contactName}</span></div>
                      <a href="#" class="delete-event" data-event-id="${e.id}" aria-label="Remove event"><img src="/static/images/Group%203.png" alt="Remove" /></a>
                    </div>
                    <div class="event-meta">
                      <div class="event-start"><span class="meta-label">Start</span>: ${formatDate(e.start_date)} at ${formatTimeFromParts(e.start_date, e.start_time)}</div>
                      <div class="event-end"><span class="meta-label">End</span>: ${formatDate(e.end_date)} at ${formatTimeFromParts(e.end_date, e.end_time)}</div>
                    </div>
                  </div>
                </div>
              </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  detailEl.innerHTML = html;
}

// loadCalendar()
// Fetch all events from the API and render them using renderCalendar.
// Errors are logged and a simple message is shown in the detail pane.
async function loadCalendar() {
  const detailEl = document.getElementById('contact-detail');
  if (!detailEl) return;
  try {
    const res = await fetchJson('/contacts/api/events/');
    if (!res.ok) throw new Error('Failed to load events');
    const data = await res.json();
    renderCalendar(data.events || []);
  } catch (err) {
    console.error(err);
    detailEl.innerHTML = '<p>Error loading events.</p>';
  }
}

// renderCalendarGrid(events, year, month)
// Render a month grid calendar into `#contact-detail`. Events are
// grouped by start_date and shown on their day cells. Adds previous/next
// handlers to the month navigation buttons after render.
function renderCalendarGrid(events, year, month) {
  const detailEl = document.getElementById('contact-detail');
  if (!detailEl) return;
  const byDate = new Map();
  (events || []).forEach((e) => {
    const key = e.start_date;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(e);
  });

  const firstOfMonth = new Date(year, month, 1);
  const monthName = firstOfMonth.toLocaleString('default', { month: 'long' });
  const startDow = firstOfMonth.getDay();
  const nextMonth = new Date(year, month + 1, 0);
  const daysInMonth = nextMonth.getDate();

  let html = `<div class="grid-calendar">
          <div class="grid-header">
            <button id="cal-prev" class="image-button" aria-label="Previous month">◀</button>
            <div class="grid-title">${monthName} ${year}</div>
            <button id="cal-next" class="image-button" aria-label="Next month">▶</button>
          </div>
          <div class="calendar-grid">
            <div class="dow">Sun</div><div class="dow">Mon</div><div class="dow">Tue</div><div class="dow">Wed</div><div class="dow">Thu</div><div class="dow">Fri</div><div class="dow">Sat</div>`;

  for (let i = 0; i < startDow; i++)
    html += `<div class="calendar-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = byDate.get(iso) || [];
    html += `<div class="calendar-cell" data-date="${iso}">
                    <div class="cell-day">${d}</div>
                    <div class="cell-events">`;
    dayEvents.slice(0, 3).forEach((ev) => {
      const titleSafe = escapeHtml(ev.name || '(no title)');
      const contactName =
        `${ev.contact_first_name || ''} ${ev.contact_last_name || ''}`.trim();
      const startAttr = `${ev.start_date}T${ev.start_time}`;
      const endAttr = `${ev.end_date}T${ev.end_time}`;
      html += `<a href="#" class="calendar-event-item" data-event-id="${ev.id}" data-contact-id="${ev.contact_id}" data-start="${startAttr}" data-end="${endAttr}" title="${titleSafe} — ${escapeHtml(contactName)}">${titleSafe}</a>`;
    });
    if (dayEvents.length > 3)
      html += `<div class="more">+${dayEvents.length - 3} more</div>`;
    html += `</div></div>`;
  }

  html += `</div></div>`;
  detailEl.innerHTML = html;

  document.getElementById('cal-prev').addEventListener('click', (ev) => {
    ev.preventDefault();
    const newDate = new Date(year, month - 1, 1);
    loadCalendarGrid(newDate.getFullYear(), newDate.getMonth());
  });
  document.getElementById('cal-next').addEventListener('click', (ev) => {
    ev.preventDefault();
    const newDate = new Date(year, month + 1, 1);
    loadCalendarGrid(newDate.getFullYear(), newDate.getMonth());
  });
}

// loadCalendarGrid(year, month)
// Fetch events and render the month grid for the given year/month.
// If year/month are omitted, the current date is used.
async function loadCalendarGrid(year, month) {
  const detailEl = document.getElementById('contact-detail');
  if (!detailEl) return;
  try {
    const res = await fetchJson('/contacts/api/events/');
    if (!res.ok) throw new Error('Failed to load events');
    const data = await res.json();
    const now = new Date();
    const y = typeof year === 'number' ? year : now.getFullYear();
    const m = typeof month === 'number' ? month : now.getMonth();
    renderCalendarGrid(data.events || [], y, m);
  } catch (err) {
    console.error(err);
    detailEl.innerHTML = '<p>Error loading calendar.</p>';
  }
}

const _dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const _timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// _toDate(dateStr, timeStr)
// Parse ISO-like date and optional time into a JS Date. Returns null for
// invalid inputs. Helper used by the formatting helpers below.
function _toDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const iso = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// formatDate(dateStr, timeStr)
// Return a user-friendly date string for the given parts (uses
// Intl.DateTimeFormat). Returns empty string for invalid input.
function formatDate(dateStr, timeStr) {
  const d = _toDate(dateStr, timeStr);
  if (!d) return '';
  return _dateFormatter.format(d);
}

// formatTimeFromParts(dateStr, timeStr)
// Return a user-friendly time string for the given parts. Empty string
// for invalid input.
function formatTimeFromParts(dateStr, timeStr) {
  const d = _toDate(dateStr, timeStr);
  if (!d) return '';
  return _timeFormatter.format(d);
}

// formatStart(dateStr, timeStr)
// Helper to produce a combined "DATE at TIME" string when possible.
function formatStart(dateStr, timeStr) {
  if (!dateStr && !timeStr) return '';
  const datePart = formatDate(dateStr, timeStr);
  const timePart = formatTimeFromParts(dateStr, timeStr);
  if (!timePart) return datePart;
  return `${datePart} at ${timePart}`;
}

// escapeHtml(str)
// Simple HTML-escaping helper to avoid injecting raw user content into
// generated HTML fragments.
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// renderDetail(data)
// Build the contact detail form (name, contact methods) and the list of
// events for the contact, then insert into `#contact-detail`.
// The returned HTML contains controls wired to the global click/submit
// handlers in the DOMContentLoaded block.
function renderDetail(data) {
  const detailEl = document.getElementById('contact-detail');
  let html = `
            <div class="contact-detail">
              <form id="contact-form">
                <h2>
                  <input  id="first-name" name="first_name" value="${data.first_name || ''}" placeholder="First name" />
                  <input id="last-name" name="last_name" value="${data.last_name || ''}" placeholder="Last name" />
                </h2>

                <h3>Contact methods</h3>
                <div id="methods">
              `;

  if (data.contact_methods && data.contact_methods.length) {
    data.contact_methods.forEach((m, idx) => {
      html +=
        `<div class="method-row" data-idx="${idx}">` +
        `<select name="method_type_${idx}">` +
        `<option value="email" ${m.type === 'email' ? 'selected' : ''}>Email</option>` +
        `<option value="phone" ${m.type === 'phone' ? 'selected' : ''}>Phone</option>` +
        `<option value="social" ${m.type === 'social' ? 'selected' : ''}>Social</option>` +
        `</select>` +
        `<input name="method_value_${idx}" value="${m.value || ''}" />` +
        `${m.id ? `<a href="#" class="delete-method" data-method-id="${m.id}" aria-label="Remove method"><img src="/static/images/Group%203.png" alt="Remove" /></a>` : `<a href="#" class="delete-method" aria-label="Remove method"><img src="/static/images/Group%203.png" alt="Remove" /></a>`}` +
        `</div>`;
    });
  } else {
    html +=
      `<div class="method-row" data-idx="0">` +
      `<select name="method_type_0">` +
      `<option value="email">Email</option>` +
      `<option value="phone">Phone</option>` +
      `<option value="social">Social</option>` +
      `</select>` +
      `<input name="method_value_0" value="" />` +
      `<a href="#" class="delete-method" aria-label="Remove method"><img src="/static/images/Group%203.png" alt="Remove" /></a>` +
      `</div>`;
  }

  html += `</div>`;

  html += `
                <div class="method-controls">
                  <a id="add-method" href="#" role="button" class="image-button" aria-label="Add method">
                    <img src="/static/images/Group%202.png" alt="Add method" />add method
                  </a>
                </div>
                <div class="bottom-controls">
                    <a id="delete-contact" href="#" role="button" class="image-button" aria-label="Delete contact">
                    <img src="/static/images/Component%203.png" alt="Delete contact" />
                  </a>
                  <a id="cancel-contact" href="#" role="button" class="image-button" aria-label="Cancel contact">
                    <img src="/static/images/Component%202.png" alt="Cancel contact" />
                  </a>

                  <a id="save-contact" href="#" role="button" class="image-button" aria-label="Save contact">
                    <img src="/static/images/Component%201.png" alt="Save contact" />
                  </a>
                </div>
              </form>`;

  html += `<h3>Events</h3><div id="events">`;
  if (data.events && data.events.length) {
    data.events.forEach((e) => {
      const startAttr = `${e.start_date}T${e.start_time}`;
      const endAttr = `${e.end_date}T${e.end_time}`;
      html +=
        `<div class="event-row" data-event-id="${e.id}" data-start="${startAttr}" data-end="${endAttr}">` +
        `<div class="event-content">` +
        `<div class="event-text">` +
        `<div class="event-title">${e.name || ''}</div>` +
        `<div class="event-meta">` +
        `<div class="event-start"><span class="meta-label">Start</span>: ${formatDate(e.start_date)} at ${formatTimeFromParts(e.start_date, e.start_time)}</div>` +
        `<div class="event-end"><span class="meta-label">End</span>: ${formatDate(e.end_date)} at ${formatTimeFromParts(e.end_date, e.end_time)}</div>` +
        `</div>` +
        `</div>` +
        `<a href="#" class="delete-event" data-event-id="${e.id}" aria-label="Remove event"><img src="/static/images/Group%203.png" alt="Remove" /></a>` +
        `</div>` +
        `</div>`;
    });
    html += `<a id="add-event" href="#" role="button" class="image-button" aria-label="Add event" title="Add event">
                    <img src="/static/images/Group%202.png" alt="Add event"/>add event
                  </a>`;
  } else {
    html += `<div class="no-events">No events</div>
          <a id="add-event" href="#" role="button" class="image-button" aria-label="Add event" title="Add event">
                    <img src="/static/images/Group%202.png" alt="Add event"/>add event
                  </a>`;
  }

  html += `</div>`;
  detailEl.innerHTML = html;
}

// loadDetail(pk)
// Fetch contact detail from the API and render it. On error, show a
// short error message in the detail pane.
async function loadDetail(pk) {
  const detailEl = document.getElementById('contact-detail');
  try {
    const res = await fetchJson(`/contacts/api/${pk}/`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    renderDetail(data);
    return data;
  } catch (err) {
    detailEl.innerHTML = '<p>Error loading contact.</p>';
    console.error(err);
  }
}

// setActiveItem(item)
// Manage the active selection in the left-hand contact list: clear the
// previous active item, mark the new one, and focus it for keyboard
// users.
function setActiveItem(item) {
  if (!item) return;
  const prev = document.querySelector('.contact-item.active');
  if (prev) {
    prev.classList.remove('active');
    prev.setAttribute('aria-pressed', 'false');
  }
  item.classList.add('active');
  item.setAttribute('aria-pressed', 'true');
  item.focus();
}

// showBanner(message, type, timeout)
// Show a temporary banner at the top of the page for non-blocking
// feedback (success/info/error). Automatically hides after `timeout` ms.
function showBanner(message, type = 'info', timeout = 3500) {
  const banner = document.getElementById('app-banner');
  const msg = document.getElementById('app-banner-msg');
  const close = document.getElementById('app-banner-close');
  if (!banner || !msg) return;
  msg.textContent = message;
  if (type === 'success') {
    banner.style.background = '#E6FAE8';
    banner.style.color = '#0b6b2b';
  } else if (type === 'error') {
    banner.style.background = '#FFECEC';
    banner.style.color = '#8a1f1f';
  } else {
    banner.style.background = '#FFF7E6';
    banner.style.color = '#5a4300';
  }
  banner.style.display = 'block';
  if (banner._hideTimer) clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(() => {
    banner.style.display = 'none';
  }, timeout);
  close.onclick = function () {
    if (banner._hideTimer) clearTimeout(banner._hideTimer);
    banner.style.display = 'none';
  };
}

// showConfirmModal(message, confirmText, cancelText)
// Display a simple confirm modal and return a Promise that resolves to
// true (confirmed) or false (cancelled). The modal is fully cleaned up
// after the user makes a choice.
function showConfirmModal(
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const msg = document.getElementById('confirm-modal-msg');
    const btnConfirm = document.getElementById('confirm-modal-confirm');
    const btnCancel = document.getElementById('confirm-modal-cancel');
    if (!modal || !msg || !btnConfirm || !btnCancel) return resolve(false);
    msg.textContent = message;
    btnConfirm.textContent = confirmText;
    btnCancel.textContent = cancelText;
    modal.style.display = 'flex';

    const cleanup = () => {
      modal.style.display = 'none';
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  function reindexMethods() {
    const methods = document.getElementById('methods');
    if (!methods) return;
    const rows = methods.querySelectorAll('.method-row');
    rows.forEach((row, i) => {
      row.dataset.idx = i;
      const select = row.querySelector('select');
      const input = row.querySelector('input');
      if (select) select.name = `method_type_${i}`;
      if (input) input.name = `method_value_${i}`;
    });
  }

  // compareNames(aFirst, aLast, bFirst, bLast)
  // Compare two names for sorting: primarily by last name, then by first
  // name. Case-insensitive. Missing names are treated as empty strings.    
  function compareNames(aFirst, aLast, bFirst, bLast) {
    const aL = (aLast || '').toLowerCase();
    const bL = (bLast || '').toLowerCase();
    if (aL < bL) return -1;
    if (aL > bL) return 1;
    const aF = (aFirst || '').toLowerCase();
    const bF = (bFirst || '').toLowerCase();
    if (aF < bF) return -1;
    if (aF > bF) return 1;
    return 0;
  }

  // placeListItemByName(itemEl, firstName, lastName)
  // Given a contact item element and its associated first/last name, place
  // it in the correct sorted position within the contact list. Sorting is
  // by last name, then first name (case-insensitive). If the item is not
  // already in the list, it will be added.
  function placeListItemByName(itemEl, firstName, lastName) {
    if (!itemEl) return;
    const ul = document.querySelector('#contact-list ul');
    if (!ul) return;
    const li = itemEl.closest('li') || document.createElement('li');
    if (!itemEl.closest('li')) li.appendChild(itemEl);
    const items = Array.from(ul.querySelectorAll('.contact-item')).filter(
      (it) => it !== itemEl && it.dataset.pk,
    );
    let inserted = false;
    for (const other of items) {
      const oFirstName =
        other.dataset.first ||
        (() => {
          const text = (other.textContent || '').trim();
          const parts = text.split(/\s+/);
          return parts.slice(0, -1).join(' ');
        })();
      const oLastName =
        other.dataset.last ||
        (() => {
          const text = (other.textContent || '').trim();
          const parts = text.split(/\s+/);
          return parts.slice(-1)[0] || '';
        })();
      if (compareNames(firstName, lastName, oFirstName, oLastName) < 0) {
        const otherLi = other.closest('li');
        if (otherLi) {
          ul.insertBefore(li, otherLi);
        } else {
          ul.insertBefore(li, other);
        }
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      ul.appendChild(li);
    }
  }

  // validateForm(formEl)
  // Validate the contact form: first name, last name, and at least one
  // contact method are required. Email methods must be in valid format,
  // and duplicate email addresses are not allowed. Invalid fields are
  // marked with the "invalid" class, and a summary message is returned.
  function validateForm(formEl) {
    if (!formEl)
      return {
        valid: false,
        message:
          'Please enter first name, last name, and at least one contact method.',
      };
    const first = (
      formEl.querySelector('input[name="first_name"]')?.value || ''
    ).trim();
    const last = (
      formEl.querySelector('input[name="last_name"]')?.value || ''
    ).trim();
    const methodInputs = formEl.querySelectorAll(
      'input[name^="method_value_"]',
    );
    let hasMethod = false;
    methodInputs.forEach((mi) => {
      if ((mi.value || '').trim()) hasMethod = true;
    });
    formEl
      .querySelectorAll('.invalid')
      .forEach((el) => el.classList.remove('invalid'));
    let valid = true;
    if (!first) {
      const el = formEl.querySelector('input[name="first_name"]');
      if (el) el.classList.add('invalid');
      valid = false;
    }
    if (!last) {
      const el = formEl.querySelector('input[name="last_name"]');
      if (el) el.classList.add('invalid');
      valid = false;
    }
    if (!hasMethod) {
      const mi = formEl.querySelector('input[name^="method_value_"]');
      if (mi) mi.classList.add('invalid');
      valid = false;
    }
    function isValidEmailAddress(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    if (valid) {
      const rows = formEl.querySelectorAll('.method-row');
      const seen = new Map();
      let duplicateFound = false;
      let formatInvalid = false;
      rows.forEach((row, idx) => {
        const select = row.querySelector('select');
        const input = row.querySelector('input');
        if (!select || !input) return;
        const type = (select.value || '').toLowerCase();
        const val = (input.value || '').trim();
        if (type === 'email' && val) {
          if (!isValidEmailAddress(val)) {
            input.classList.add('invalid');
            formatInvalid = true;
            valid = false;
          }
        }
        if (type === 'email' && val) {
          const norm = val.toLowerCase();
          if (seen.has(norm)) {
            const firstInput = seen.get(norm);
            if (firstInput) firstInput.classList.add('invalid');
            input.classList.add('invalid');
            duplicateFound = true;
            valid = false;
          } else {
            seen.set(norm, input);
          }
        }
      });
      if (formatInvalid) {
        const firstInvalid = formEl.querySelector('.invalid');
        if (firstInvalid) firstInvalid.focus();
        return { valid: false, message: 'Please enter a valid email address.' };
      }
      if (duplicateFound) {
        const firstInvalid = formEl.querySelector('.invalid');
        if (firstInvalid) firstInvalid.focus();
        return {
          valid: false,
          message:
            'This is a duplicate contact method, please enter a unique contact method.',
        };
      }
    }
    if (!valid) {
      const firstInvalid = formEl.querySelector('.invalid');
      if (firstInvalid) firstInvalid.focus();
      return {
        valid: false,
        message:
          'Please enter first name, last name, and at least one contact method.',
      };
    }
    return { valid: true, message: null };
  }

  const list = document.getElementById('contact-list');
  const navContacts = document.getElementById('nav-contacts');
  const navCalendar = document.getElementById('nav-calendar');
  
  // showContactsView() switches to the contact list view: shows the contact list, marks the contacts nav item active, and loads the detail for the currently active contact (or the first contact if none active).
  function showContactsView() {
    const cl = document.getElementById('contact-list');
    if (cl) cl.style.display = '';
    if (navContacts) {
      navContacts.classList.add('active');
      navCalendar && navCalendar.classList.remove('active');
    }
    const active = document.querySelector('.contact-item.active');
    if (active && active.dataset.pk) {
      loadDetail(active.dataset.pk);
    } else {
      const first = document.querySelector('.contact-item[data-pk]');
      if (first) {
        setActiveItem(first);
        loadDetail(first.dataset.pk);
      } else {
        document.getElementById('contact-detail').innerHTML =
          '<p>No contacts</p>';
      }
    }
  }

  // showCalendarView() switches to the calendar view: hides the contact list, marks the calendar nav item active, and loads the current month grid.
  async function showCalendarView() {
    const cl = document.getElementById('contact-list');
    if (cl) cl.style.display = 'none';
    if (navCalendar) {
      navCalendar.classList.add('active');
      navContacts && navContacts.classList.remove('active');
    }
    const now = new Date();
    await loadCalendarGrid(now.getFullYear(), now.getMonth());
  }

  if (navContacts) {
    navContacts.addEventListener('click', (ev) => {
      ev.preventDefault();
      showContactsView();
    });
  }
  if (navCalendar) {
    navCalendar.addEventListener('click', (ev) => {
      ev.preventDefault();
      showCalendarView();
    });
  }

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.contact-item');
    if (!item) return;
    const pk = item.dataset.pk;
    loadDetail(pk);
    setActiveItem(item);
  });

  const createBtn = document.getElementById('create-contact');
  if (createBtn) {
    createBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const ul = document.querySelector('#contact-list ul');
      if (!ul) return;
      const li = document.createElement('li');
      const div = document.createElement('div');
      div.className = 'contact-item';
      div.dataset.new = 'true';
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-pressed', 'false');
      div.textContent = '';
      li.appendChild(div);
      ul.appendChild(li);
      setActiveItem(div);
      renderDetail({ first_name: '', last_name: '', contact_methods: [] });
    });
  }

  document.body.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'contact-form') {
      e.preventDefault();
      const form = e.target;
      const validation = validateForm(form);
      if (!validation.valid) {
        showBanner(
          validation.message ||
            'Please enter first name, last name, and at least one contact method.',
          'error',
        );
        return;
      }
      const activeItem = document.querySelector('.contact-item.active');
      if (!activeItem) return;
      const pk = activeItem.dataset.pk;
      const formData = new FormData(form);
      const payload = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        contact_methods: [],
      };
      const methodRows = form.querySelectorAll('.method-row');
      methodRows.forEach((row, idx) => {
        const type = formData.get(`method_type_${idx}`);
        const value = formData.get(`method_value_${idx}`);
        if (value && type) payload.contact_methods.push({ type, value });
      });
      try {
        if (pk) {
          const res = await fetchJson(`/contacts/api/${pk}/update/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            throw new Error((errJson && errJson.error) || 'Failed to save');
          }
          const updated = await res.json();
          showBanner('Contact updated successfully.', 'success');
          loadDetail(updated.id);
          if (activeItem) {
            activeItem.dataset.first = updated.first_name;
            activeItem.dataset.last = updated.last_name;
            activeItem.textContent = `${updated.first_name} ${updated.last_name}`;
            placeListItemByName(
              activeItem,
              updated.first_name,
              updated.last_name,
            );
          }
        } else {
          const res = await fetchJson('/contacts/api/create/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            throw new Error((errJson && errJson.error) || 'Failed to create');
          }
          const created = await res.json();
          activeItem.dataset.pk = created.id;
          activeItem.removeAttribute('data-new');
          activeItem.dataset.first = created.first_name;
          activeItem.dataset.last = created.last_name;
          activeItem.textContent = `${created.first_name} ${created.last_name}`;
          placeListItemByName(
            activeItem,
            created.first_name,
            created.last_name,
          );
          showBanner('Contact saved successfully.', 'success');
          loadDetail(created.id);
        }
      } catch (err) {
        console.error(err);
        showBanner(err.message || 'Error saving contact', 'error');
      }
    }
  });

  // Global click handler for event-related actions: add, edit, delete. Uses event delegation to handle clicks on dynamically generated controls within the events list and calendar.
  document.body.addEventListener('click', async (e) => {
    const addEventTrigger = e.target.closest && e.target.closest('#add-event');
    if (addEventTrigger) {
      e.preventDefault();
      const events = document.getElementById('events');
      if (!events) return;
      if (document.getElementById('event-form')) return;
      const formHtml = `
              <div id="event-form" class="event-form">
                <input name="event_name" placeholder="Event name (optional)" />
                <div class="form-row">
                  <input type="date" name="start_date" />
                  <input type="time" name="start_time" />
                </div>
                <div class="form-row">
                  <input type="date" name="end_date" />
                  <input type="time" name="end_time" />
                </div>
                <div class="controls">
                  <a id="save-event" href="#" class="image-button"><img src="/static/images/Component%201.png" alt="Save event" /></a>
                  <a id="cancel-event" href="#" class="image-button"><img src="/static/images/Component%202.png" alt="Cancel event" /></a>
                </div>
              </div>`;
      events.insertAdjacentHTML('afterbegin', formHtml);
      return;
    }

    // Handle delete event from both the calendar and the event list. Shows a confirm modal before deleting, then removes the event from the UI on success.
    const calDeleteTrigger =
      e.target.closest && e.target.closest('.calendar-delete-event');
    if (calDeleteTrigger) {
      e.preventDefault();
      const confirmed = await showConfirmModal(
        'Are you sure you want to delete this event? This action cannot be undone.',
        'Delete',
        'Cancel',
      );
      if (!confirmed) return;
      const eventId = calDeleteTrigger.dataset.eventId;
      try {
        const res = await fetchJson(`/contacts/event/${eventId}/delete/`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Delete failed');
        const anchor = document.querySelector(
          `.calendar-event-item[data-event-id="${eventId}"]`,
        );
        if (anchor) anchor.remove();
        const openForm = document.querySelector(
          `.calendar-event-edit-form .calendar-delete-event[data-event-id="${eventId}"]`,
        );
        if (openForm) {
          const formEl = openForm.closest('.calendar-event-edit-form');
          if (formEl) formEl.remove();
        }
        const row = document.querySelector(
          `.event-row[data-event-id="${eventId}"]`,
        );
        if (row) row.remove();
        showBanner('Event deleted.', 'success');
      } catch (err) {
        console.error(err);
        showBanner('Failed to delete event', 'error');
      }
      return;
    }

    // Handle click on an existing event in the calendar to open the edit form. If an edit form is already open for that event, does nothing.
    const calEventTrigger =
      e.target.closest && e.target.closest('.calendar-event-item');
    if (calEventTrigger) {
      e.preventDefault();
      const anchor = calEventTrigger;
      const cell = anchor.closest('.calendar-cell');
      if (!cell) return;
      const existingForm = cell.querySelector('.calendar-event-edit-form');
      if (existingForm) return;
      const eventId = anchor.dataset.eventId;
      const startAttr = anchor.dataset.start || '';
      const endAttr = anchor.dataset.end || '';
      const [sDate = '', sTime = ''] = startAttr.split('T');
      const [eDate = '', eTime = ''] = endAttr.split('T');
      const titleText = (anchor.textContent || '').trim();
      const formHtml = `
              <div class="calendar-event-edit-form event-form">
                <input name="event_name" placeholder="Event name (optional)" value="${escapeHtml(titleText)}" />
                <div class="form-row">
                  <input type="date" name="start_date" value="${sDate}" />
                  <input type="time" name="start_time" value="${sTime}" />
                </div>
                <div class="form-row">
                  <input type="date" name="end_date" value="${eDate}" />
                  <input type="time" name="end_time" value="${eTime}" />
                </div>
                <div class="controls">
                  <a href="#" class="calendar-delete-event image-button" data-event-id="${eventId}" aria-label="Delete event">
                    <img src="/static/images/Component%203.png" alt="Delete" />
                  </a>
                  <a href="#" class="calendar-update-event image-button" data-event-id="${eventId}" aria-label="Save event">
                    <img src="/static/images/Component%201.png" alt="Save event" />
                  </a>
                  <a href="#" class="calendar-cancel-edit-event image-button" data-event-id="${eventId}" aria-label="Cancel edit">
                    <img src="/static/images/Component%202.png" alt="Cancel" />
                  </a>
                </div>
              </div>`;
      anchor.style.display = 'none';
      anchor.insertAdjacentHTML('afterend', formHtml);
      return;
    }

    // Handle save of a new event from the contact detail view. Validates the input, checks for overlapping events, then creates the event via the API and adds it to the list on success.
    const saveEventTrigger =
      e.target.closest && e.target.closest('#save-event');
    if (saveEventTrigger) {
      e.preventDefault();
      const form = document.getElementById('event-form');
      if (!form) return;
      const activeItem = document.querySelector('.contact-item.active');
      if (!activeItem || !activeItem.dataset.pk) {
        showBanner(
          'Please save or select a contact before adding events.',
          'error',
        );
        return;
      }
      const pk = activeItem.dataset.pk;
      const name = (
        form.querySelector('input[name="event_name"]').value || ''
      ).trim();
      const start_date = form.querySelector('input[name="start_date"]').value;
      const start_time = form.querySelector('input[name="start_time"]').value;
      const end_date = form.querySelector('input[name="end_date"]').value;
      const end_time = form.querySelector('input[name="end_time"]').value;
      if (!start_date || !start_time || !end_date || !end_time) {
        showBanner(
          'Please provide start and end date/time for the event.',
          'error',
        );
        return;
      }
      const newStart = new Date(`${start_date}T${start_time}`);
      const newEnd = new Date(`${end_date}T${end_time}`);
      if (
        Number.isNaN(newStart.getTime()) ||
        Number.isNaN(newEnd.getTime()) ||
        newEnd <= newStart
      ) {
        showBanner(
          'Please ensure the end time is after the start time.',
          'error',
        );
        return;
      }
      const eventsContainerCheck = document.getElementById('events');
      if (eventsContainerCheck) {
        const existingRows =
          eventsContainerCheck.querySelectorAll('.event-row');
        for (const other of existingRows) {
          const ostart = other.dataset.start;
          const oend = other.dataset.end;
          if (!ostart || !oend) continue;
          const otherStart = new Date(ostart);
          const otherEnd = new Date(oend);
          if (
            Number.isNaN(otherStart.getTime()) ||
            Number.isNaN(otherEnd.getTime())
          )
            continue;
          if (newStart < otherEnd && newEnd > otherStart) {
            showBanner(
              'This event overlaps with an existing event for this contact.',
              'error',
            );
            return;
          }
        }
      }
      try {
        const res = await fetchJson(`/contacts/api/${pk}/events/create/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            start_date,
            start_time,
            end_date,
            end_time,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err && err.error) || 'Failed to create event');
        }
        const created = await res.json();
        showBanner('Event created.', 'success');
        const formEl = document.getElementById('event-form');
        if (formEl) formEl.remove();
        const eventsContainer = document.getElementById('events');
        if (eventsContainer) {
          const row = document.createElement('div');
          row.className = 'event-row';
          row.dataset.eventId = created.id;
          row.dataset.start = `${created.start_date}T${created.start_time}`;
          row.dataset.end = `${created.end_date}T${created.end_time}`;
          row.innerHTML = `
                  <div class="event-content">
                    <div class="event-text">
                      <div class="event-header">
                        <div class="event-title">${created.name || ''}</div>
                        <a href="#" class="delete-event" data-event-id="${created.id}" aria-label="Remove event"><img src="/static/images/Group%203.png" alt="Remove" /></a>
                      </div>
                      <div class="event-meta">
                        <div class="event-start"><span class="meta-label">Start</span>: ${formatDate(created.start_date)} at ${formatTimeFromParts(created.start_date, created.start_time)}</div>
                        <div class="event-end"><span class="meta-label">End</span>: ${formatDate(created.end_date)} at ${formatTimeFromParts(created.end_date, created.end_time)}</div>
                      </div>
                    </div>
                  </div>`;
          let inserted = false;
          const existing = Array.from(
            eventsContainer.querySelectorAll('.event-row'),
          );
          const newStart = new Date(row.dataset.start);
          for (const other of existing) {
            const ostart = other.dataset.start;
            if (!ostart) continue;
            const otherStart = new Date(ostart);
            if (otherStart > newStart) {
              eventsContainer.insertBefore(row, other);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            const addBtn = eventsContainer.querySelector('#add-event');
            if (addBtn) {
              eventsContainer.insertBefore(row, addBtn);
            } else {
              eventsContainer.appendChild(row);
            }
          }
        }
      } catch (err) {
        console.error(err);
        showBanner(err.message || 'Failed to create event', 'error');
      }
      return;
    }

    // Handle cancel of event creation or editing: simply remove the form from the UI. If editing an existing event, the original event display will be restored when the form is removed.
    const cancelEventTrigger =
      e.target.closest && e.target.closest('#cancel-event');
    if (cancelEventTrigger) {
      e.preventDefault();
      const form = document.getElementById('event-form');
      if (form) form.remove();
      return;
    }

    // Handle click on an existing event in the event list to open the edit form. If an edit form is already open for that event, does nothing. The edit form includes a delete button that allows deleting the event directly from the edit form.
    const clickedEventRow = e.target.closest && e.target.closest('.event-row');
    if (
      clickedEventRow &&
      !e.target.closest('.delete-event') &&
      !e.target.closest('#event-edit-form')
    ) {
      if (
        document.getElementById('event-form') ||
        document.getElementById('event-edit-form')
      )
        return;
      const row = clickedEventRow;
      row._origInner = row.innerHTML;
      const eventId = row.dataset.eventId;
      const startAttr = row.dataset.start || '';
      const endAttr = row.dataset.end || '';
      const [sDate = '', sTime = ''] = startAttr.split('T');
      const [eDate = '', eTime = ''] = endAttr.split('T');
      const titleText = (
        row.querySelector('.event-title')?.textContent || ''
      ).trim();
      const formHtml = `
              <div id="event-edit-form" class="event-form">
                <input name="event_name" placeholder="Event name (optional)" value="${escapeHtml(titleText)}" />
                <div class="form-row">
                  <input type="date" name="start_date" value="${sDate}" />
                  <input type="time" name="start_time" value="${sTime}" />
                </div>
                <div class="form-row">
                  <input type="date" name="end_date" value="${eDate}" />
                  <input type="time" name="end_time" value="${eTime}" />
                </div>
                <div class="controls">
                  <a href="#" id="update-event" class="image-button" data-event-id="${eventId}" aria-label="Save event">
                    <img src="/static/images/Component%201.png" alt="Save event" />
                  </a>
                  <a href="#" id="cancel-edit-event" class="image-button" aria-label="Cancel edit">
                    <img src="/static/images/Component%202.png" alt="Cancel" />
                  </a>
                </div>
              </div>`;
      row.innerHTML = formHtml;
      return;
    }

    // Handle save of an edited event from the contact detail view. Validates the input, checks for overlapping events, then updates the event via the API and updates the display on success.
    const updateTrigger = e.target.closest && e.target.closest('#update-event');
    if (updateTrigger) {
      e.preventDefault();
      const eventId = updateTrigger.dataset.eventId;
      const row = updateTrigger.closest('.event-row');
      const form = row && row.querySelector('#event-edit-form');
      if (!form || !row) return;
      const name = (
        form.querySelector('input[name="event_name"]').value || ''
      ).trim();
      const start_date = form.querySelector('input[name="start_date"]').value;
      const start_time = form.querySelector('input[name="start_time"]').value;
      const end_date = form.querySelector('input[name="end_date"]').value;
      const end_time = form.querySelector('input[name="end_time"]').value;
      if (!start_date || !start_time || !end_date || !end_time) {
        showBanner(
          'Please provide start and end date/time for the event.',
          'error',
        );
        return;
      }
      const newStart = new Date(`${start_date}T${start_time}`);
      const newEnd = new Date(`${end_date}T${end_time}`);
      if (
        Number.isNaN(newStart.getTime()) ||
        Number.isNaN(newEnd.getTime()) ||
        newEnd <= newStart
      ) {
        showBanner(
          'Please ensure the end time is after the start time.',
          'error',
        );
        return;
      }
      const eventsContainerCheck = document.getElementById('events');
      if (eventsContainerCheck) {
        const existingRows =
          eventsContainerCheck.querySelectorAll('.event-row');
        for (const other of existingRows) {
          if (other.dataset.eventId === String(eventId)) continue;
          const ostart = other.dataset.start;
          const oend = other.dataset.end;
          if (!ostart || !oend) continue;
          const otherStart = new Date(ostart);
          const otherEnd = new Date(oend);
          if (
            Number.isNaN(otherStart.getTime()) ||
            Number.isNaN(otherEnd.getTime())
          )
            continue;
          if (newStart < otherEnd && newEnd > otherStart) {
            showBanner(
              'This event overlaps with an existing event for this contact.',
              'error',
            );
            return;
          }
        }
      }
      try {
        const res = await fetchJson(`/contacts/event/${eventId}/update/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            start_date,
            start_time,
            end_date,
            end_time,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((json && json.error) || 'Failed to update event');
        }
        row.dataset.start = `${json.start_date}T${json.start_time}`;
        row.dataset.end = `${json.end_date}T${json.end_time}`;
        row.innerHTML = `
                <div class="event-content">
                  <div class="event-text">
                    <div class="event-header">
                      <div class="event-title">${escapeHtml(json.name || '')}</div>
                      <a href="#" class="delete-event" data-event-id="${json.id}" aria-label="Remove event"><img src="/static/images/Group%203.png" alt="Remove" /></a>
                    </div>
                    <div class="event-meta">
                      <div class="event-start"><span class="meta-label">Start</span>: ${formatDate(json.start_date)} at ${formatTimeFromParts(json.start_date, json.start_time)}</div>
                      <div class="event-end"><span class="meta-label">End</span>: ${formatDate(json.end_date)} at ${formatTimeFromParts(json.end_date, json.end_time)}</div>
                    </div>
                  </div>
                </div>`;
        showBanner('Event updated.', 'success');
      } catch (err) {
        console.error(err);
        showBanner(err.message || 'Failed to update event', 'error');
      }
      return;
    }

    // Handle save of an edited event from the calendar view. Validates the input, checks for overlapping events, then updates the event via the API and updates the display on success. If the event is moved to a different date, it will be moved to the correct position in the calendar grid.
    const calUpdateTrigger =
      e.target.closest && e.target.closest('.calendar-update-event');
    if (calUpdateTrigger) {
      e.preventDefault();
      const eventId = calUpdateTrigger.dataset.eventId;
      const form =
        calUpdateTrigger.closest('.calendar-event-edit-form') ||
        calUpdateTrigger.closest('.event-form');
      if (!form) return;
      const name = (
        form.querySelector('input[name="event_name"]').value || ''
      ).trim();
      const start_date = form.querySelector('input[name="start_date"]').value;
      const start_time = form.querySelector('input[name="start_time"]').value;
      const end_date = form.querySelector('input[name="end_date"]').value;
      const end_time = form.querySelector('input[name="end_time"]').value;
      if (!start_date || !start_time || !end_date || !end_time) {
        showBanner(
          'Please provide start and end date/time for the event.',
          'error',
        );
        return;
      }
      const newStart = new Date(`${start_date}T${start_time}`);
      const newEnd = new Date(`${end_date}T${end_time}`);
      if (
        Number.isNaN(newStart.getTime()) ||
        Number.isNaN(newEnd.getTime()) ||
        newEnd <= newStart
      ) {
        showBanner(
          'Please ensure the end time is after the start time.',
          'error',
        );
        return;
      }
      try {
        const res = await fetchJson(`/contacts/event/${eventId}/update/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            start_date,
            start_time,
            end_date,
            end_time,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error((json && json.error) || 'Failed to update event');
        const anchor = document.querySelector(
          `.calendar-event-item[data-event-id="${json.id}"]`,
        );
        if (anchor) {
          anchor.textContent = escapeHtml(json.name || '');
          anchor.dataset.start = `${json.start_date}T${json.start_time}`;
          anchor.dataset.end = `${json.end_date}T${json.end_time}`;
          const contactName =
            `${json.contact_first_name || ''} ${json.contact_last_name || ''}`.trim();
          anchor.title = `${escapeHtml(json.name || '(no title)')} — ${escapeHtml(contactName)}`;
          const editForm =
            anchor.nextElementSibling &&
            anchor.nextElementSibling.classList &&
            anchor.nextElementSibling.classList.contains(
              'calendar-event-edit-form',
            )
              ? anchor.nextElementSibling
              : null;
          if (editForm) editForm.remove();
          anchor.style.display = '';
        }
        showBanner('Event updated.', 'success');
      } catch (err) {
        console.error(err);
        showBanner(err.message || 'Failed to update event', 'error');
      }
      return;
    }

    // Handle cancel of event editing from the calendar view: simply remove the form from the UI and restore the original event display.
    const calCancelTrigger =
      e.target.closest && e.target.closest('.calendar-cancel-edit-event');
    if (calCancelTrigger) {
      e.preventDefault();
      const eventId = calCancelTrigger.dataset.eventId;
      const form =
        calCancelTrigger.closest('.calendar-event-edit-form') ||
        calCancelTrigger.closest('.event-form');
      if (!form) return;
      const anchor = document.querySelector(
        `.calendar-event-item[data-event-id="${eventId}"]`,
      );
      if (anchor) {
        form.remove();
        anchor.style.display = '';
      } else {
        form.remove();
      }
      return;
    }

    // Handle cancel of event editing from the event list view: simply remove the form from the UI and restore the original event display.
    const cancelEditTrigger =
      e.target.closest && e.target.closest('#cancel-edit-event');
    if (cancelEditTrigger) {
      e.preventDefault();
      const row = cancelEditTrigger.closest('.event-row');
      if (row && row._origInner) {
        row.innerHTML = row._origInner;
        delete row._origInner;
      }
      return;
    }

    // Handle save of the contact form from the detail view: validates the input, then creates or updates the contact via the API and updates the list and detail display on success.
    const saveTrigger = e.target.closest && e.target.closest('#save-contact');
    if (saveTrigger) {
      e.preventDefault();
      const form = document.getElementById('contact-form');
      if (form) {
        const validation = validateForm(form);
        if (!validation.valid) {
          showBanner(
            validation.message ||
              'Please enter first name, last name, and at least one contact method.',
            'error',
          );
          return;
        }
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
          );
        }
      }
      return;
    }

    // Handle delete of a contact method from the detail view. Shows a confirm modal before deleting, then removes the method from the UI on success. If the method has an ID, it will be deleted via the API; if not, it will simply be removed from the form (used for unsaved new methods).
    const deleteTrigger =
      e.target.closest && e.target.closest('.delete-method');
    if (deleteTrigger) {
      e.preventDefault();
      const methodConfirmed = await showConfirmModal(
        'Are you sure you want to delete this contact method? This action cannot be undone.',
        'Delete',
        'Cancel',
      );
      if (!methodConfirmed) return;
      const row = deleteTrigger.closest('.method-row');
      const methodId = deleteTrigger.dataset.methodId;
      if (methodId) {
        try {
          const res = await fetchJson(`/contacts/method/${methodId}/delete/`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Delete failed');
          if (row) {
            row.remove();
            reindexMethods();
            showBanner('Contact method deleted.', 'success');
          }
        } catch (err) {
          console.error(err);
          showBanner('Failed to delete method', 'error');
        }
      } else {
        if (row) {
          row.remove();
          reindexMethods();
          showBanner('Contact method removed.', 'success');
        }
      }
      return;
    }

    // Handle delete of an event from the event list. Shows a confirm modal before deleting, then removes the event from the UI on success. If the event has an ID, it will be deleted via the API; if not, it will simply be removed from the list (used for unsaved new events).
    const deleteEventTrigger =
      e.target.closest && e.target.closest('.delete-event');
    if (deleteEventTrigger) {
      e.preventDefault();
      const confirmed = await showConfirmModal(
        'Are you sure you want to delete this event? This action cannot be undone.',
        'Delete',
        'Cancel',
      );
      if (!confirmed) return;
      const row = deleteEventTrigger.closest('.event-row');
      const eventId = deleteEventTrigger.dataset.eventId;
      if (eventId) {
        try {
          const res = await fetchJson(`/contacts/event/${eventId}/delete/`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Delete failed');
          const json = await res.json().catch(() => ({}));
          if (row) row.remove();
          showBanner('Event deleted.', 'success');
        } catch (err) {
          console.error(err);
          showBanner('Failed to delete event', 'error');
        }
      } else {
        if (row) row.remove();
        showBanner('Event removed.', 'success');
      }
      return;
    }

    // Handle delete of a contact from the contact detail view. Shows a confirm modal before deleting, then removes the contact from the UI on success. If the contact has an ID, it will be deleted via the API; if not, it will simply be removed from the list (used for unsaved new contacts).
    const deleteContactTrigger =
      e.target.closest && e.target.closest('#delete-contact');
    if (deleteContactTrigger) {
      e.preventDefault();
      const confirmed = await showConfirmModal(
        'Are you sure you want to delete this contact? This action cannot be undone.',
        'Delete',
        'Cancel',
      );
      if (!confirmed) return;
      const activeItem = document.querySelector('.contact-item.active');
      if (!activeItem) return;
      const pk = activeItem.dataset.pk;
      const li = activeItem.closest('li');
      if (!pk) {
        if (li) li.remove();
        document.getElementById('contact-detail').innerHTML = '';
        const first = document.querySelector('.contact-item[data-pk]');
        if (first) {
          setActiveItem(first);
          loadDetail(first.dataset.pk);
        }
        return;
      }
      try {
        const res = await fetchJson(`/contacts/api/${pk}/delete/`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Delete failed');
        const json = await res.json();
        if (json.deleted) {
          if (li) li.remove();
          document.getElementById('contact-detail').innerHTML = '';
          const next = document.querySelector('.contact-item[data-pk]');
          if (next) {
            setActiveItem(next);
            loadDetail(next.dataset.pk);
          }
        }
      } catch (err) {
        console.error(err);
        showBanner('Failed to delete contact', 'error');
      }
      return;
    }

    // Handle cancel of edits from the contact detail view: if the contact is new and unsaved, it will be removed from the list; if it's an existing contact, the changes will be reverted to the last saved state.
    const cancelTrigger =
      e.target.closest && e.target.closest('#cancel-contact');
    if (cancelTrigger) {
      e.preventDefault();
      const activeItem = document.querySelector('.contact-item.active');
      if (!activeItem) {
        document.getElementById('contact-detail').innerHTML = '';
        return;
      }
      const pk = activeItem.dataset.pk;
      const li = activeItem.closest('li');
      if (!pk) {
        if (li) li.remove();
        document.getElementById('contact-detail').innerHTML = '';
        const first = document.querySelector('.contact-item[data-pk]');
        if (first) {
          setActiveItem(first);
          loadDetail(first.dataset.pk);
        }
        return;
      }
      try {
        const data = await loadDetail(pk);
        if (data && activeItem) {
          activeItem.textContent = `${data.first_name} ${data.last_name}`;
        }
      } catch (err) {
        console.error(err);
        showBanner('Failed to revert changes', 'error');
      }
      return;
    }

    // Handle add of a new contact method from the contact detail view: adds a new method row to the form. The new method will be saved when the contact form is submitted. There is no limit to the number of methods that can be added.
    const addTrigger = e.target.closest && e.target.closest('#add-method');
    if (addTrigger) {
      e.preventDefault();
      const methods = document.getElementById('methods');
      const idx = methods.querySelectorAll('.method-row').length;
      const div = document.createElement('div');
      div.className = 'method-row';
      div.dataset.idx = idx;
      div.innerHTML = `\
              <select name="method_type_${idx}">\
                <option value="email">Email</option>\
                <option value="phone">Phone</option>\
                <option value="social">Social</option>\
              </select>\
              <input name="method_value_${idx}" value="" />\
              <a href="#" class="delete-method" aria-label="Remove method"><img src="/static/images/Group%203.png" alt="Remove" /></a>`;
      methods.appendChild(div);
      reindexMethods();
    }
  });

  // Keyboard navigation for contact list: allows using arrow keys to navigate the list and Enter/Space to load the selected contact's details. This improves accessibility and allows power users to navigate more quickly without relying on the mouse.
  list.addEventListener('keydown', (e) => {
    const item = e.target.closest('.contact-item');
    if (!item) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const pk = item.dataset.pk;
      loadDetail(pk);
      setActiveItem(item);
    }
  });

  // On initial page load, check if there is a "new" query parameter in the URL. If so, try to find the corresponding contact item in the list and load its details. This allows linking directly to a new contact that was just created. If the item is not found (e.g. because the page was refreshed before the new contact was saved), it will still attempt to load the details which may show an error or empty state until the contact is properly saved.
  const params = new URLSearchParams(window.location.search);
  const newId = params.get('new');
  if (newId) {
    const newItem = document.querySelector(`.contact-item[data-pk="${newId}"]`);
    if (newItem) {
      setActiveItem(newItem);
      loadDetail(newId);
    } else {
      loadDetail(newId);
    }
    history.replaceState(null, '', window.location.pathname);
  } else {
    const first = document.querySelector('.contact-item');
    if (first) {
      loadDetail(first.dataset.pk);
      setActiveItem(first);
    }
  }
});
