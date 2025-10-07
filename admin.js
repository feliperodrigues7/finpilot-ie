// Admin portal: login (email+senha) + listagem de intakes
const SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL || window.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta?.env?.VITE_SUPABASE_ANON_KEY || window.VITE_SUPABASE_ANON_KEY;

const statusEl = document.getElementById('status');
const loginCard = document.getElementById('login-card');
const appCard = document.getElementById('app-card');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnRefresh = document.getElementById('btn-refresh');
const whoamiEl = document.getElementById('whoami');
const tbody = document.getElementById('tbody');
const limitEl = document.getElementById('limit');
const offsetEl = document.getElementById('offset');
const qnameEl = document.getElementById('qname');

if (!SUPABASE_URL || !SUPABASE_ANON) {
  statusEl.textContent = 'Config do Supabase ausente.';
  throw new Error('Missing Supabase envs');
}

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

function setStatus(msg, color='#444'){ statusEl.textContent = msg; statusEl.style.color = color; }
function showLogin(){ loginCard.classList.remove('hidden'); appCard.classList.add('hidden'); }
function showApp(){ loginCard.classList.add('hidden'); appCard.classList.remove('hidden'); }

async function sessionCheck(){
  const { data: { session } } = await supa.auth.getSession();
  if (session?.user) {
    whoamiEl.textContent = session.user.email || session.user.id;
    setStatus('Logado.');
    showApp();
    await loadIntakes();
  } else {
    setStatus('Não logado.');
    showLogin();
  }
}

btnLogin.onclick = async () => {
  setStatus('Entrando...');
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(error);
    setStatus('Falha no login: ' + error.message, '#b00020');
  } else {
    setStatus('Login OK.');
    showApp();
    whoamiEl.textContent = data.user?.email || data.user?.id || '—';
    await loadIntakes();
  }
};

btnLogout.onclick = async () => {
  await supa.auth.signOut();
  tbody.innerHTML = '';
  showLogin();
  setStatus('Sessão encerrada.');
};

btnRefresh.onclick = async () => {
  await loadIntakes();
};

async function loadIntakes(){
  setStatus('Carregando intakes...');
  tbody.innerHTML = '';
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { setStatus('Sessão expirada.', '#b00020'); showLogin(); return; }
  const accessToken = session.access_token;

  const limit = Math.max(1, Math.min(500, parseInt(limitEl.value || '50', 10)));
  const offset = Math.max(0, parseInt(offsetEl.value || '0', 10));
  const qname = qnameEl.value.trim();

  const url = new URL(`${SUPABASE_URL}/rest/v1/intakes_pf_ie`);
  url.searchParams.set('select', 'id,created_at,profile,locale,source');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (qname) {
    // filtro por profile->>name com ilike (PostgREST)
    url.searchParams.set('profile->>name', `ilike.*${qname}*`);
  }

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact'
    }
  });

  if (!res.ok) {
    let msg;
    try { msg = await res.json(); } catch { msg = await res.text(); }
    console.error('List error:', res.status, msg);
    setStatus(`Erro ao listar: ${res.status} ${JSON.stringify(msg)}`, '#b00020');
    return;
  }

  const rows = await res.json();
  tbody.innerHTML = rows.map(r => {
    const name = r.profile?.name || '—';
    const email = r.profile?.email || '—';
    return `<tr>
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(email)}</td>
      <td>${r.locale || '—'}</td>
      <td>${r.source || '—'}</td>
    </tr>`;
  }).join('');
  setStatus(`Exibindo ${rows.length} registros (limit ${limit}, offset ${offset}).`);
}

// util
function escapeHtml(s){ return String(s ?? '').replace(/[&<>'\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',\"'\":'&#39;','\"':'&quot;' }[c])); }

sessionCheck();
