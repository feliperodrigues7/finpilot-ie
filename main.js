import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY ausentes.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const formEl = document.getElementById('intake-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = 'Enviando...';
  submitBtn.disabled = true;

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const consent = document.getElementById('consent').checked;

  const payload = {
    profile: { name },
    consent: { terms: consent },
    client_email: email || null,
    locale: 'PT',
    source: 'pilot'
  };

  try {
    const { data, error } = await supabase
      .from('intakes_pf_ie')
      .insert(payload)
      .select();

    if (error) {
      console.error(error);
      statusEl.textContent = 'Erro ao enviar. Tente novamente.';
    } else {
      statusEl.textContent = 'Enviado com sucesso! Obrigado.';
      formEl.reset();
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Falha inesperada. Verifique sua conexão.';
  } finally {
    submitBtn.disabled = false;
  }
});
