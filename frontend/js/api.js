// Shared API client for the customer site.
const API = {
  async request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error('Unexpected server response. Please try again.');
    }
    if (!res.ok || !body.success) throw new Error(body.error || 'Request failed');
    return body.data;
  },
  get(path) { return this.request(path); },
  post(path, data) { return this.request(path, { method: 'POST', body: JSON.stringify(data) }); },
};

const naira = (n) => `\u20a6${Number(n).toLocaleString('en-NG')}`;

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
