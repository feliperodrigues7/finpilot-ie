const params = new URLSearchParams(location.search);
const lang = params.get('lang') || 'PT';
if (lang === 'EN') {
  document.getElementById('title').textContent = 'Thank you!';
  document.getElementById('msg').textContent = 'We received your data. We will contact you soon.';
}
