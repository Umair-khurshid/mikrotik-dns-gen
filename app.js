const STORAGE_KEY = 'mt-dns-gen';

const state = {
  domains: [],
  skipped: [],
  addressList: '',
  forwardTo: '',
  comment: '',
  output: '',
};

function rosQuote(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch];
  });
}

function isValidDomain(domain) {
  if (domain.length > 253) return false;
  const name = domain.startsWith('*.') ? domain.slice(2) : domain;
  const labels = name.split('.');
  if (labels.length < 2) return false;
  const label = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  for (const part of labels) {
    if (!label.test(part)) return false;
  }
  return /^[a-zA-Z]{2,}$/.test(labels[labels.length - 1]);
}

function $(id) {
  return document.getElementById(id);
}

function parseDomainList(raw) {
  const lines = raw.split('\n');
  const valid = [];
  const seen = new Set();
  const skipped = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped === '' || stripped.startsWith('#')) continue;
    const domain = stripped.split('#')[0].trim();
    if (!domain) continue;
    if (isValidDomain(domain)) {
      const key = domain.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        valid.push(domain);
      }
    } else {
      skipped.push(domain);
    }
  }
  return { valid, skipped };
}

function generateCommands(domains, addressList, forwardTo, comment) {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const lines = [];
  lines.push('# Generated: ' + timestamp);
  lines.push('# Domains: ' + domains.length);
  lines.push('');

  for (const domain of domains) {
    const parts = [];
    parts.push('/ip dns static');
    parts.push('add');
    if (addressList) parts.push('address-list=' + rosQuote(addressList));
    if (forwardTo) {
      parts.push('forward-to=' + rosQuote(forwardTo));
      parts.push('type=FWD');
    }
    if (comment) parts.push('comment=' + rosQuote(comment));
    parts.push('name=' + rosQuote(domain));
    lines.push(parts.join(' '));
  }

  return lines.join('\n');
}

const TOKEN_RE = /(\w+(?:-\w+)*)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g;

const FIELD_CLASS = {
  'address-list': 'syntax-keyword',
  'forward-to': 'syntax-keyword',
  'type': 'syntax-keyword',
  'comment': 'syntax-comment',
  'name': 'syntax-domain',
};

function buildCommandLine(line) {
  var html =
    '<span class="syntax-keyword">' + escapeHtml('/ip dns static add') + '</span>';

  var tokenRegex = new RegExp(TOKEN_RE.source, 'g');
  var match;
  while ((match = tokenRegex.exec(line)) !== null) {
    var key = match[1];
    var cssClass = FIELD_CLASS[key] || '';
    var rendered;
    if (match[2] !== undefined) {
      rendered = escapeHtml(key) + '=&quot;' + escapeHtml(match[2]) + '&quot;';
    } else {
      rendered = escapeHtml(key) + '=' + escapeHtml(match[3]);
    }
    html += ' <span class="' + cssClass + '">' + rendered + '</span>';
  }

  return html;
}

function highlightSyntax(text) {
  var lines = text.split('\n');
  var result = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (/^#\s+(Generated|Domains):/.test(line)) {
      result.push('<span class="syntax-meta">' + escapeHtml(line) + '</span>');
      continue;
    }

    if (line.trim() === '') {
      result.push('');
      continue;
    }

    if (line.indexOf('/ip dns static add') !== 0) {
      result.push(escapeHtml(line));
      continue;
    }

    result.push(buildCommandLine(line));
  }

  return result.join('\n');
}

function loadSettings() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.addressList = saved.addressList || '';
    state.forwardTo = saved.forwardTo || '';
    state.comment = saved.comment || '';
    state.domains = saved.domains || [];
    state.skipped = saved.skipped || [];
    $('addr-list').value = state.addressList;
    $('forward-to').value = state.forwardTo;
    $('comment').value = state.comment;
    $('domain-input').value = saved.domainText || '';
  } catch (_) {}
}

function saveSettings() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      addressList: state.addressList,
      forwardTo: state.forwardTo,
      comment: state.comment,
      domains: state.domains,
      skipped: state.skipped,
      domainText: $('domain-input').value,
    }));
  } catch (_) {}
}

function renderOutput() {
  const preEl = $('output-display');
  const codeEl = $('output-code');
  const statsEl = $('output-stats');
  const copyBtn = $('btn-copy');
  const downloadBtn = $('btn-download');

  if (!state.output) {
    codeEl.innerHTML = '';
    preEl.classList.add('is-empty');
    statsEl.textContent = '';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    return;
  }

  preEl.classList.remove('is-empty');
  codeEl.innerHTML = highlightSyntax(state.output);
  statsEl.textContent = state.domains.length + ' domains';
  copyBtn.disabled = false;
  downloadBtn.disabled = false;
}

function onGenerate() {
  state.addressList = $('addr-list').value.trim();
  state.forwardTo = $('forward-to').value.trim();
  state.comment = $('comment').value.trim();

  var parsed = parseDomainList($('domain-input').value);
  state.domains = parsed.valid;
  state.skipped = parsed.skipped;

  if (state.domains.length === 0) {
    state.output = '';
    renderOutput();
    if (state.skipped.length > 0) {
      showToast('No valid domains. ' + state.skipped.length + ' entries were invalid.', true);
    } else {
      showToast('No valid domains found', true);
    }
    return;
  }

  if (!state.addressList && !state.forwardTo) {
    state.output = '';
    renderOutput();
    showToast('address-list or forward-to is required', true);
    return;
  }

  state.output = generateCommands(
    state.domains,
    state.addressList,
    state.forwardTo,
    state.comment
  );

  renderOutput();
  saveSettings();

  var msg = 'Generated ' + state.domains.length + ' entries';
  if (state.skipped.length > 0) {
    msg += ' (' + state.skipped.length + ' invalid skipped)';
  }
  showToast(msg);
}

async function onCopy() {
  if (!state.output) return;
  try {
    await navigator.clipboard.writeText(state.output);
    showToast('Copied to clipboard');
  } catch (_) {
    const textarea = document.createElement('textarea');
    textarea.value = state.output;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copied to clipboard');
  }
}

function onDownload() {
  if (!state.output) return;
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = 'mikrotik-dns-' + timestamp + '.rsc';
  const blob = new Blob([state.output], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Saved as ' + filename);
}

let toastTimer = null;

function showToast(message, isError) {
  const el = $('toast');
  el.textContent = message;
  el.style.background = isError ? '#EF4444' : 'var(--accent)';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2000);
}

function onInputChange() {
  saveSettings();
}

function init() {
  loadSettings();

  $('btn-generate').addEventListener('click', onGenerate);
  $('btn-copy').addEventListener('click', onCopy);
  $('btn-download').addEventListener('click', onDownload);

  $('domain-input').addEventListener('input', onInputChange);
  $('addr-list').addEventListener('input', onInputChange);
  $('forward-to').addEventListener('input', onInputChange);
  $('comment').addEventListener('input', onInputChange);

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onGenerate();
    }
  });

  if (state.domains.length > 0 && state.output) {
    renderOutput();
  } else if ($('domain-input').value.trim()) {
    onGenerate();
  }
}

init();
