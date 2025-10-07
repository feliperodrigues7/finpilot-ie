import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

document.addEventListener('DOMContentLoaded', () => {
  initAdmin().catch(err => {
    console.error(err);
    alert('Erro ao iniciar Admin. Ver console.');
  });
});

async function initAdmin() {
  // Elements (IDs garantidos pelo admin.html fornecido)
  const info = document.getElementById('info');
  const loginCard = document.getElementById('login-card');
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const btnLogin = document.getElementById('btn-login');

  const appCard = document.getElementById('app-card');
  const sessionWho = document.getElementById('session-who');
  const btnExport = document.getElementById('btn-export');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnLogout = document.getElementById('btn-logout');

  const limitEl = document.getElementById('limit');
  const offsetEl = document.getElementById('offset');
  const statusFilterEl = document.getElementById('status-filter');
  const searchEl = document.getElementById('search');
  const tbody = document.getElementById('tbody');

  function setInfo(msg, color='#666') { info.textContent = msg; info.style.color = color; }

  // Sessão
  const { data: { session } } = await supa.auth.getSession();
  if (session?.user) {
    await afterLogin(session.user);
  } else {
    setInfo('Faça login.');
    loginCard.style.display = '';
    appCard.style.display = 'none';
  }

  // Handlers
  btnLogin.addEventListener('click', async (e) => {
    e.preventDefault();
    setInfo('Autenticando...');
    const email = emailEl.value.trim();
    const password = passEl.value;
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) { setInfo('Erro no login: ' + error.message, '#b00020'); return; }
    await afterLogin(data.user);
  });

  btnLogout.addEventListener('click', async () => {
    await supa.auth.signOut();
    loginCard.style.display = '';
    appCard.style.display = 'none';
    setInfo('Sessão encerrada.');
  });

  btnRefresh.addEventListener('click', () => loadLeads());
  btnExport.addEventListener('click', () => exportCSV());

  limitEl.addEventListener('change', () => loadLeads());
  offsetEl.addEventListener('change', () => loadLeads());
  statusFilterEl.addEventListener('change', () => loadLeads());
  searchEl.addEventListener('input', debounce(() => loadLeads(), 400));

  async function afterLogin(user) {
    // Confirma se é admin
    const { data: adminRow, error: adminErr } = await supa.from('admins')
      .select('user_id').eq('user_id', user.id).maybeSingle();
    if (adminErr) { setInfo('Erro conferindo admin', '#b00020'); console.error(adminErr); return; }
    if (!adminRow) { setInfo('Este usuário não é admin.', '#b00020'); return; }

    loginCard.style.display = 'none';
    appCard.style.display = '';
    sessionWho.textContent = `Logado como: ${user.email || user.id}`;
    await loadLeads();
  }

  function debounce(fn, t=300) {
    let id; return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), t); };
  }

  async function loadLeads() {
    setInfo('Carregando leads...');
    const limit = parseInt(limitEl.value || '50');
    const offset = parseInt(offsetEl.value || '0');
    const statusFilter = statusFilterEl.value;
    const search = searchEl.value.trim();

    let q = supa.from('intakes')
      .select('id, created_at, profile, email, locale, source, status', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (search) q = q.ilike('profile->>name', `%${search}%`);

    const { data, error } = await q;
    if (error) { setInfo('Erro ao carregar leads', '#b00020'); console.error(error); return; }
    renderTable(data || []);
    setInfo(`Exibindo ${data?.length || 0} registros (limit ${limit}, offset ${offset}).`);
  }

  function renderTable(rows) {
    tbody.innerHTML = rows.map(r => {
      const name = r.profile?.name || '—';
      const email = r.email || '—';
      const locale = r.locale || '—';
      const source = r.source || '—';
      const status = r.status || 'new';
      return `
        <tr data-id="${r.id}">
          <td>${new Date(r.created_at).toLocaleString()}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(email)}</td>
          <td>${escapeHtml(locale)}</td>
          <td>${escapeHtml(source)}</td>
          <td>
            <span class="pill">${status}</span>
            <select class="status-dd">
              <option value="new" ${status==='new'?'selected':''}>Novo</option>
              <option value="in_progress" ${status==='in_progress'?'selected':''}>Em andamento</option>
              <option value="closed" ${status==='closed'?'selected':''}>Concluído</option>
            </select>
          </td>
          <td>
            <button class="btn-add-note">Adicionar nota</button>
            <button class="btn-view-notes">Ver notas</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire actions por linha
    tbody.querySelectorAll('tr').forEach(tr => {
      const id = tr.getAttribute('data-id');
      const dd = tr.querySelector('.status-dd');
      const btnAdd = tr.querySelector('.btn-add-note');
      const btnView = tr.querySelector('.btn-view-notes');

      dd.addEventListener('change', async () => {
        const { error } = await supa.from('intakes').update({ status: dd.value }).eq('id', id);
        if (error) { alert('Erro ao atualizar status'); console.error(error); }
      });

      btnAdd.addEventListener('click', async () => {
        const note = prompt('Digite a nota:');
        if (!note) return;
        const { error } = await supa.from('intake_notes').insert({ intake_id: id, note });
        if (error) { alert('Erro ao salvar nota'); console.error(error); }
      });

      btnView.addEventListener('click', async () => {
        const { data, error } = await supa.from('intake_notes')
          .select('note, created_at').eq('intake_id', id).order('created_at', { ascending: false });
        if (error) { alert('Erro ao carregar notas'); console.error(error); return; }
        alert((data || []).map(n => `- ${new Date(n.created_at).toLocaleString()}: ${n.note}`).join('\n') || 'Sem notas.');
      });
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
    );
  }

  function toCSV(rows){
    if (!rows.length) return '';
    const header = Object.keys(rows[0]);
    const lines = [header.join(',')];
    for (const r of rows){
      const vals = header.map(k => `"${String(r[k] ?? '').replace(/"/g,'""')}"`);
      lines.push(vals.join(','));
    }
    return lines.join('\n');
  }

  async function exportCSV(){
    const { data, error } = await supa.from('intakes')
      .select('id, created_at, profile, email, locale, source, status')
      .order('created_at', { ascending:false }).limit(1000);
    if (error) { alert('Erro ao exportar'); console.error(error); return; }
    const rows = (data || []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      name: r.profile?.name || '',
      email: r.email || '',
      locale: r.locale || '',
      source: r.source || '',
      status: r.status || ''
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `intakes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }
}
