// FinPilot IE - front com anti-bot, hardening e enriquecimento automático
import { translations } from './translations.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
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

// UTM + contexto
function getUTMs() {
  const p = new URLSearchParams(location.search);
  const utm = {};
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k=>{
    if (p.get(k)) utm[k] = p.get(k);
  });
  return utm;
}
function getLocale() {
  return navigator.language || navigator.userLanguage || null;
}
function getSource() {
  const utm = getUTMs();
  if (Object.keys(utm).length) return JSON.stringify(utm);
  try { return new URL(document.referrer).host || 'direct'; } catch { return document.referrer ? 'ref' : 'direct'; }
}

// i18n
const LS_KEY = 'finpilot_lang';
let currentLang = localStorage.getItem(LS_KEY) || 'PT';
const formEl = document.getElementById('intake-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const btnPT = document.getElementById('btn-pt');
const btnEN = document.getElementById('btn-en');

function t(key) { return (translations[currentLang] && translations[currentLang][key]) || key; }
function applyI18n() {
  btnPT?.classList.toggle('active', currentLang === 'PT');
  btnEN?.classList.toggle('active', currentLang === 'EN');
  const dict = translations[currentLang] || {};
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

// Eventos de validação
document.getElementById('name')?.addEventListener('input', (e) => { errName.textContent = validateName(e.target.value); });
document.getElementById('email')?.addEventListener('input', (e) => { errEmail.textContent = validateEmail(e.target.value); });
document.getElementById('consent')?.addEventListener('change', (e) => { errConsent.textContent = validateConsent(e.target.checked); });

// Anti-bot e hardening
const HP_ID = 'hp';
const SUBMIT_HISTORY_KEY = 'finpilot_submit_hist';
const MAX_SUBMITS = 3;
const WINDOW_MINUTES = 5;
const MIN_DELAY_MS = 1000;

function getSubmitHistory() {
  try { return JSON.parse(sessionStorage.getItem(SUBMIT_HISTORY_KEY) || '[]'); } catch { return []; }
}
function addSubmitHistory() {
  const h = getSubmitHistory().filter(ts => Date.now() - ts < WINDOW_MINUTES * 60 * 1000);
  h.push(Date.now());
  sessionStorage.setItem(SUBMIT_HISTORY_KEY, JSON.stringify(h));
}
function canSubmitNow() {
  const h = getSubmitHistory().filter(ts => Date.now() - ts < WINDOW_MINUTES * 60 * 1000);
  return h.length < MAX_SUBMITS;
}
let firstInteractionAt = null;
['input','change','focus'].forEach(evt => {
  window.addEventListener(evt, () => { if (!firstInteractionAt) firstInteractionAt = Date.now(); }, { once: true, passive: true });
});

// Helper REST sem return=representation
async function insertIntakeNoReturn(payload) {
  const url = `${SUPABASE_URL}/rest/v1/intakes_pf_ie`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (res.status === 201 || res.status === 204) {
    return { ok: true, status: res.status };
  } else {
    let msg;
    try { msg = await res.json(); } catch { msg = await res.text(); }
    return { ok: false, status: res.status, message: msg };
  }
}

// Submit
formEl?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const consent = document.getElementById('consent').checked;
  const hpVal = document.getElementById(HP_ID)?.value || '';

  // Honeypot
  if (hpVal) {
    statusEl.style.color = '#c62828';
    statusEl.textContent = t('val_honeypot') || 'Submission blocked.';
    console.warn('Honeypot triggered');
    return;
  }

  // Rate limit
  if (!canSubmitNow()) {
    statusEl.style.color = '#c62828';
    statusEl.textContent = t('val_ratelimit') || 'Too many submissions. Try later.';
    return;
  }

  // Delay mínimo
  const since = firstInteractionAt ? (Date.now() - firstInteractionAt) : 0;
  if (since < MIN_DELAY_MS) {
    statusEl.style.color = '#c62828';
    statusEl.textContent = t('val_too_fast') || 'Please wait a second before submitting.';
    return;
  }

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
    debts: null,
    locale: getLocale(),
    source: getSource(),
    ua: navigator.userAgent || null
  };

  try {
    const r = await insertIntakeNoReturn(payload);
    if (r.ok) {
      addSubmitHistory();
      window.location.href = `/finpilot-ie/success.html?lang=${currentLang}`;
    } else {
      console.error('REST insert failed:', r.status, r.message);
      statusEl.style.color = '#c62828';
      const msg = typeof r.message === 'string' ? r.message : JSON.stringify(r.message);
      statusEl.textContent = `${t('status_error')} ${r.status} ${msg || ''}`;
      alert(`Erro: ${r.status} ${msg || ''}`);
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

// Botão de self-test
(function mountSelfTest() {
  const btn = document.createElement('button');
  btn.textContent = 'Self-test Supabase (insert)';
  btn.style.cssText = 'position:fixed;right:12px;bottom:12px;padding:8px 12px;border-radius:8px;background:#111;color:#fff;z-index:9999;cursor:pointer;';
  btn.onclick = async () => {
    try {
      const r = await insertIntakeNoReturn({
        profile: { name: 'SelfTest' },
        work: null,
        housing: null,
        debts: null,
        locale: getLocale(),
        source: getSource(),
        ua: navigator.userAgent || null
      });
      if (r.ok) {
        alert('OK! Inserido (sem retorno do corpo). Status: ' + r.status);
        console.log('SelfTest insert OK:', r.status);
      } else {
        alert('Erro: ' + r.status + ' ' + JSON.stringify(r.message || ''));
        console.error('SelfTest error:', r.status, r.message);
      }
    } catch (e) {
      alert('Falha: ' + e.message);
      console.error(e);
    }
  };
  document.body.appendChild(btn);
})();
