// FinPilot IE - front minimal com fetch explícito para Supabase REST
import { translations } from './translations.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL; // ex: https://sfffjmtklryxjwmvsqfa.supabase.co
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug/health
console.log('DBG VITE_SUPABASE_URL:', SUPABASE_URL);
console.log('DBG VITE_SUPABASE_ANON_KEY length:', SUPABASE_ANON ? SUPABASE_ANON.length : 0);
(function showHealth() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:12px;bottom:12px;padding:6px 10px;border-radius:6px;border:1px solid #ccc;background:#f6f6f6;font:12px system-ui;z-index:9999;';
  el.textContent = (SUPABASE_URL && SUPABASE_ANON) ? 'Supabase config: OK' : 'Supabase config: AUSENTE';
  document.body.appendChild(el);
})();

// Helpers i18n
const LS_KEY = 'finpilot_lang';
let currentLang = localStorage.getItem(LS_KEY) || 'PT';
const formEl = document.getElementById('intake-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const btnPT = document.getElementById('btn-pt');
const btnEN = document.getElementById('btn-en');

function t(key) { return translations[currentLang][key] || key; }
function applyI18n() {
  btnPT?.classList.toggle('active', currentLang === 'PT');
  btnEN?.classList.toggle('active', currentLang === 'EN');
  const dict = translations[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  if (nameInput) nameInput.placeholder = currentLang === 'PT' ? 'Seu nome' : 'Your name';
  if (emailInput) emailInput.placeholder = currentLang === 'PT' ? 'voce@exemplo.com' : 'you@example.com';
  document.documentElement.lang = currentLang === 'PT' ? 'pt-BR' : 'en';
}
btnPT?.addEventListener('click', () => { currentLang = 'PT'; localStorage.setItem(LS_KEY, currentLang); applyI18n(); });
btnEN?.addEventListener('click', () => { currentLang = 'EN'; localStorage.setItem(LS_KEY, currentLang); applyI18n(); });
applyI18n();

// Validação
const errName = document.getElementById('err-name');
const errEmail = document.getElementById('err-email');
const errConsent = document.getElementById('err-consent');

function validateName(value) { return (!value || value.trim().length < 2) ? t('val_name_short') : ''; }
function validateEmail(value) { if (!value) return ''; const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; return re.test(value) ? '' : t('val_email_invalid'); }
function validateConsent(checked) { return checked ? '' : t('val_consent_required'); }

document.getElementById('name')?.addEventListener('input', (e) => { errName.textContent = validateName(e.target.value); });
document.getElementById('email')?.addEventListener('input', (e) => { errEmail.textContent = validateEmail(e.target.value); });
document.getElementById('consent')?.addEventListener('change', (e) => { errConsent.textContent = validateConsent(e.target.checked); });

// Função REST helper para inserir
async function insertIntake(payload) {
  const url = `${SUPABASE_URL}/rest/v1/intakes_pf_ie`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, data: json };
}

// Submit do formulário - usa somente colunas existentes (profile, work, housing, debts)
formEl?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const consent = document.getElementById('consent').checked;

  const nameErr = validateName(name);
  const emailErr = validateEmail(email);
  const consentErr = validateConsent(consent);
  errName.textContent = nameErr;
  errEmail.textContent = emailErr;
  errConsent.textContent = consentErr;

  if (nameErr || emailErr || consentErr) {
    statusEl.style.color = '#c62828';
    statusEl.textContent = t('val_fix_errors');
    return;
  }

  statusEl.style.color = '#111';
  statusEl.textContent = t('status_sending');
  submitBtn.disabled = true;

  const payload = {
    profile: { name, ...(email ? { email } : {}) },
    work: null,
    housing: null,
    debts: null
  };

  try {
    const { status, data } = await insertIntake(payload);
    if (status >= 200 && status < 300) {
      window.location.href = `/finpilot-ie/success.html?lang=${currentLang}`;
    } else {
      console.error('REST insert failed:', status, data);
      statusEl.style.color = '#c62828';
      const msg = data?.message || data?.hint || JSON.stringify(data);
      statusEl.textContent = `${t('status_error')} ${status} ${msg || ''}`;
      alert(`Erro: ${status} ${msg || ''}`);
    }
  } catch (err) {
    console.error('Unexpected:', err);
    statusEl.style.color = '#c62828';
    statusEl.textContent = `${t('status_unexpected')} ${err?.message || ''}`;
    alert(`Falha: ${err?.message || ''}`);
  } finally {
    submitBtn.disabled = false;
  }
});

// Botão de self-test (usa o mesmo helper com headers explícitos)
(function mountSelfTest() {
  const btn = document.createElement('button');
  btn.textContent = 'Self-test Supabase (insert)';
  btn.style.cssText = 'position:fixed;right:12px;bottom:12px;padding:8px 12px;border-radius:8px;background:#111;color:#fff;z-index:9999;';
  btn.onclick = async () => {
    try {
      const { status, data } = await insertIntake({
        profile: { name: 'SelfTest' },
        work: null,
        housing: null,
        debts: null
      });
      if (status >= 200 && status < 300) {
        alert('OK! Inserido id: ' + (data?.[0]?.id || '—'));
        console.log('SelfTest insert:', data);
      } else {
        alert('Erro: ' + status + ' ' + (data?.message || data?.hint || JSON.stringify(data)));
        console.error('SelfTest error:', status, data);
      }
    } catch (e) {
      alert('Falha: ' + e.message);
      console.error(e);
    }
  };
  document.body.appendChild(btn);
})();
