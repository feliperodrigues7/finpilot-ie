// Admin portal: login + listagem + status + notas + CSV
import { SUPABASE_URL, SUPABASE_ANON } from './config.js';


const statusEl = document.getElementById('status');
const loginCard = document.getElementById('login-card');
const appCard = document.getElementById('app-card');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnRefresh = document.getElementById('btn-refresh');
const btnExport = document.getElementById('btn-export');
const whoamiEl = document.getElementById('whoami');
const tbody = document.getElementById('tbody');
const limitEl = document.getElementById('limit');
const offsetEl = document.getElementById('offset');
const qnameEl = document.getElementById('qname');
const fstatusEl = document.getElementById('fstatus');

const modal = document.getElementById('modal-notes');
const notesList = document.getElementById('notes-list');
const noteText = document.getElementById('note-text');
const btnSaveNote = document.getElementById('btn-save-note');
const btnCloseModal = document.getElementById('btn-close-modal');

let currentIntakeIdForNotes = null;

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

async function getSession() { const { data: { session } } = await supa.auth.getSession(); return session; }

async function sessionCheck(){
  const session = await getSession();
  if (session?.user) { whoamiEl.textContent = session.user.email || session.user.id; setStatus('Logado.'); showApp(); await loadIntakes(); }
  else { setStatus('Não logado.'); showLogin(); }
}

btnLogin.onclick = async () => {
  setStatus('Entrando...');
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if (error) { console.error(error); setStatus('Falha no login: ' + error.message, '#b00020'); }
  else { setStatus('Login OK.'); showApp(); whoamiEl.textContent = data.user?.email || data.user?.id || '—'; await loadIntakes(); }
};

btnLogout.onclick = async () => { await supa.auth.signOut(); tbody.innerHTML = ''; showLogin(); setStatus('Sessão encerrada.'); };
btnRefresh.onclick = async () => { await loadIntakes(); };
fstatusEl.onchange = async () => { await loadIntakes(); };

btnExport.onclick = async () => {
  const rows = await fetchIntakes({ forExport: true });
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `intakes_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
};

function toCSV(rows){
  const header = ['id','created_at','name','email','locale','source','status'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const vals = [
      r.id,
      r.created_at,
      quote(r.profile?.name),
      quote(r.profile?.email),
      quote(r.locale || ''),
      quote(typeof r.source === 'string' ? r.source : JSON.stringify(r.source || '')),
      r.status || ''
    ];
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}
function quote(v){ const s = (v ?? '').toString().replace(/"/g,'""'); return `"${s}"`; }

async function fetchIntakes({ forExport = false } = {}){
  const session = await getSession();
  if (!session) { setStatus('Sessão expirada.', '#b00020'); showLogin(); return []; }
  const accessToken = session.access_token;

  const limit = forExport ? 1000 : Math.max(1, Math.min(500, parseInt(limitEl.value || '50', 10)));
  const offset = forExport ? 0 : Math.max(0, parseInt(offsetEl.value || '0', 10));
  const qname = qnameEl.value.trim();
  const fstatus = fstatusEl.value;

  const url = new URL(`${SUPABASE_URL}/rest/v1/intakes_pf_ie`);
  url.searchParams.set('select', 'id,created_at,profile,locale,source,status');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (qname) url.searchParams.set('profile->>name', `ilike.*${qname}*`);
  if (fstatus) url.searchParams.set('status', `eq.${fstatus}`);

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact'
    }
  });
  if (!res.ok) { let msg; try { msg = await res.json(); } catch { msg = await res.text(); } console.error('List error:', res.status, msg); setStatus(`Erro ao listar: ${res.status} ${JSON.stringify(msg)}`, '#b00020'); return []; }
  return await res.json();
}

async function loadIntakes(){
  setStatus('Carregando intakes...');
  tbody.innerHTML = '';
  const rows = await fetchIntakes();
  tbody.innerHTML = rows.map(r => renderRow(r)).join('');
  setStatus(`Exibindo ${rows.length} registros.`);
  wireRowHandlers();
}

function renderRow(r){
  const name = r.profile?.name || '—';
  const email = r.profile?.email || '—';
  const pill = `<span class="pill ${r.status || 'new'}">${(r.status || 'new').replace('_',' ')}</span>`;
  return `<tr data-id="${r.id}">
    <td class="nowrap">${new Date(r.created_at).toLocaleString()}</td>
    <td>${escapeHtml(name)}</td>
    <td>${escapeHtml(email)}</td>
    <td>${r.locale || '—'}</td>
    <td>${escapeHtml(typeof r.source === 'string' ? r.source : JSON.stringify(r.source || ''))}</td>
    <td>${pill}<br/>
      <select class="status-select" style="margin-top:6px;">
        <option value="new" ${r.status==='new'?'selected':''}>Novo</option>
        <option value="in_progress" ${r.status==='in_progress'?'selected':''}>Em andamento</option>
        <option value="closed" ${r.status==='closed'?'selected':''}>Concluído</option>
      </select>
    </td>
    <td class="actions">
      <button class="btn-note">Adicionar nota</button>
      <button class="btn-view-notes" style="background:#555;">Ver notas</button>
    </td>
  </tr>`;
}

function wireRowHandlers(){
  document.querySelectorAll('.status-select').forEach(sel => {
    sel.onchange = async (e) => {
      const tr = e.target.closest('tr');
      const id = tr.getAttribute('data-id');
      const value = e.target.value;
      await updateStatus(id, value);
      await loadIntakes();
    };
  });
  document.querySelectorAll('.btn-note').forEach(btn => {
    btn.onclick = (e) => {
      const tr = e.target.closest('tr');
      currentIntakeIdForNotes = tr.getAttribute('data-id');
      noteText.value = '';
      notesList.innerHTML = '<div class="muted">Carregando notas...</div>';
      openNotesModal();
      loadNotes(currentIntakeIdForNotes);
    };
  });
  document.querySelectorAll('.btn-view-notes').forEach(btn => {
    btn.onclick = (e) => {
      const tr = e.target.closest('tr');
      currentIntakeIdForNotes = tr.getAttribute('data-id');
      noteText.value = '';
      notesList.innerHTML = '<div class="muted">Carregando notas...</div>';
      openNotesModal();
      loadNotes(currentIntakeIdForNotes, { hideComposer: true });
    };
  });
}

async function updateStatus(id, status){
  const session = await getSession();
  if (!session) { setStatus('Sessão expirada.', '#b00020'); showLogin(); return; }
  const accessToken = session.access_token;
  const url = `${SUPABASE_URL}/rest/v1/intakes_pf_ie?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ status })
  });
  if (!res.ok) { let msg; try { msg = await res.json(); } catch { msg = await res.text(); } console.error('Update status error:', res.status, msg); alert('Erro ao atualizar status: ' + res.status); }
}

function openNotesModal(){ modal.style.display = 'flex'; }
function closeNotesModal(){ modal.style.display = 'none'; currentIntakeIdForNotes = null; }
btnCloseModal.onclick = closeNotesModal;

btnSaveNote.onclick = async () => {
  const text = noteText.value.trim();
  if (!text) return;
  const session = await getSession();
  if (!session) { alert('Sessão expirada'); closeNotesModal(); return; }
  const accessToken = session.access_token;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/intake_notes`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ intake_id: currentIntakeIdForNotes, author_id: session.user.id, note: text })
  });
  if (res.ok) { noteText.value = ''; await loadNotes(currentIntakeIdForNotes); }
  else { let msg; try { msg = await res.json(); } catch { msg = await res.text(); } console.error('Insert note error:', res.status, msg); alert('Erro ao salvar nota: ' + res.status); }
};

async function loadNotes(intakeId, { hideComposer = false } = {}){
  const session = await getSession();
  if (!session) { alert('Sessão expirada'); closeNotesModal(); return; }
  const accessToken = session.access_token;
  const url = new URL(`${SUPABASE_URL}/rest/v1/intake_notes`);
  url.searchParams.set('select', 'id,author_id,note,created_at');
  url.searchParams.set('intake_id', `eq.${intakeId}`);
  url.searchParams.set('order', 'created_at.desc');

  const res = await fetch(url.toString(), { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) { let msg; try { msg = await res.json(); } catch { msg = await res.text(); } console.error('Load notes error:', res.status, msg); notesList.innerHTML = `<div class="muted">Erro ao carregar notas: ${res.status}</div>`; return; }
  const notes = await res.json();
  notesList.innerHTML = notes.length
    ? notes.map(n => `<div style="border-left:3px solid #1976d2; padding:8px; margin:8px 0;">
        <div class="muted">${new Date(n.created_at).toLocaleString()} — ${n.author_id}</div>
        <div>${escapeHtml(n.note)}</div>
      </div>`).join('')
    : '<div class="muted">Sem notas ainda.</div>';

  noteText.parentElement.style.display = hideComposer ? 'none' : 'block';
  btnSaveNote.style.display = hideComposer ? 'none' : 'inline-block';
}

function escapeHtml(s){ return String(s ?? '').replace(/[&<>'\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;' }[c])); }

sessionCheck();
