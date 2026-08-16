let selectedRating = 0;

document.addEventListener('settings:loaded', (e) => {
  const s = e.detail;
  const phones = [s.phone_primary, s.phone_secondary, s.phone_tertiary].filter(Boolean);
  document.getElementById('contact-phones').innerHTML = phones
    .map((p) => `<a href="tel:${escapeHtml(p.replace(/\s/g, ''))}">${escapeHtml(p)}</a>`)
    .join('<br>');
  if (s.whatsapp_number) {
    document.getElementById('whatsapp-link').href = `https://wa.me/${s.whatsapp_number.replace(/[^0-9]/g, '')}`;
  }
  document.getElementById('contact-address').textContent = s.address;
  document.getElementById('contact-directions').href =
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.maps_query)}`;

  try {
    const hours = JSON.parse(s.opening_hours);
    const days = [['monday','Monday'],['tuesday','Tuesday'],['wednesday','Wednesday'],['thursday','Thursday'],['friday','Friday'],['saturday','Saturday'],['sunday','Sunday']];
    document.getElementById('contact-hours').innerHTML = days.map(([key, label]) => {
      const d = hours[key];
      const value = !d || d.closed ? 'Closed' : `${d.open} – ${d.close}`;
      return `<tr><td>${label}</td><td>${value}</td></tr>`;
    }).join('');
  } catch { /* ignore */ }
});

const starInput = document.getElementById('star-input');
starInput.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  selectedRating = Number(btn.dataset.v);
  starInput.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.v) <= selectedRating);
  });
});

document.getElementById('review-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertEl = document.getElementById('review-alert');
  const name = document.getElementById('review_name').value.trim();
  if (!name || !selectedRating) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Please enter your name and select a star rating.';
    return;
  }
  try {
    const result = await API.post('/reviews', {
      customer_name: name,
      rating: selectedRating,
      comment: document.getElementById('review_comment').value.trim(),
      order_number: document.getElementById('review_order').value.trim() || undefined,
    });
    alertEl.className = 'alert alert-success';
    alertEl.textContent = result.message;
    e.target.reset();
    selectedRating = 0;
    starInput.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  }
});

initLayout('contact');
