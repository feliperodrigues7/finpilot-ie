import { translations } from './translations.js';

function getLangFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang');
  if (lang === 'PT' || lang === 'EN') return lang;
  const stored = localStorage.getItem('finpilot_lang');
  return stored === 'EN' ? 'EN' : 'PT';
}

const lang = getLangFromQuery();
const dict = translations[lang];

document.documentElement.lang = lang === 'PT' ? 'pt-BR' : 'en';
document.getElementById('success-title').textContent = dict.success_title;
document.getElementById('success-msg').textContent = dict.success_msg;

const back = document.getElementById('back-home');
back.textContent = dict.success_back;
back.href = '/finpilot-ie/';
