import { createClient } from '@supabase/supabase-js';
import { translations } from './translations.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Estado de idioma
const LS_KEY = 'finpilot_lang';
let currentLang = localStorage.getItem(LS_KEY) || 'PT';

// Elementos
const formEl = document.getElementById('intake-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const btnPT = document.getElementById('btn-pt');
const btnEN = document.getElementById('btn-en');

// I18n
function applyI18n() {
  // alterna classes ativas
  btnPT.classList.toggle('active', currentLang === 'PT');
  btnEN.classList.toggle('active', currentLang === 'EN');

  // define textos
  const dict = translations[currentLang];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  // placeholders
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  nameInput.placeholder = currentLang === 'PT' ? 'Seu nome' : 'Your name';
  emailInput.placeholder = currentLang === 'PT' ? 'voce@exemplo.com' : 'you@example.com';

  // título/atributos de idioma
  document.documentElement.lang = currentLang === 'PT' ? 'pt-BR' : 'en';
}
btnPT.addEventListener('click', () => { currentLang = 'PT'; localStorage.setItem(LS_KEY, currentLang); applyI18n(); });
btnEN.addEventListener('click', () => { currentLang = 'EN'; localStorage.setItem(LS_KEY, currentLang); applyI18n(); });
applyI18n();

// Validação simples
const errName = document.getElementById('err-name');
const errEmail = document.getElementById('err-email');
const errConsent = document.getElementById('err-consent');

function t(key) { return translations[currentLang][key] || key; }

function validateName(value) {
  if (!value || value.trim().length < 2) return t('val_name_short');
  return '';
}
function validateEmail(value) {
  if (!value) return ''; // opcional
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value)) return t('val_email_invalid');
  return '';
}
function validateConsent(checked) {
  if (!checked) return t('val_consent_required');
  return '';
}

document.getElementById('name').addEventListener('input', (e) => {
  errName.textContent = validateName(e.target.value);
});
document.getElementById('email').addEventListener('input', (e) => {
  errEmail.textContent = validateEmail(e.target.value);
});
document.getElementById('consent').addEventListener('change', (e) => {
  errConsent.textContent = validateConsent(e.target.checked);
});

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  // valida
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
    statusEl.textContent = t('val_fix_errors');
    return;
  }

  statusEl.textContent = t('status_sending');
  submitBtn.disabled = true;

  const payload = {
    profile: { name },
    consent: { terms: consent },
    client_email: email || null,
    locale: currentLang,
    source: 'pilot'
  };

  try {
    const { data, error } = await supabase
      .from('intakes_pf_ie')
      .insert(payload)
      .select();

    if (error) {
      console.error(error);
      statusEl.textContent = t('status_error');
    } else {
      // redireciona para página de sucesso com querystring de idioma
      window.location.href = `/finpilot-ie/success.html?lang=${currentLang}`;
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = t('status_unexpected');
  } finally {
    submitBtn.disabled = false;
  }
});
