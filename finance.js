import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

const statusEl = document.getElementById('status');

function setStatus(msg, color='#444'){ statusEl.textContent = msg; statusEl.style.color = color; }

// Tabs
const tabs = document.querySelectorAll('nav a[data-tab]');
const sections = {
  accounts: document.getElementById('tab-accounts'),
  transactions: document.getElementById('tab-transactions'),
  debts: document.getElementById('tab-debts')
};
tabs.forEach(a=>{
  a.onclick = (e)=>{
    e.preventDefault();
    tabs.forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    const t = a.dataset.tab;
    Object.entries(sections).forEach(([k,sec])=>sec.classList.toggle('hidden', k!==t));
  };
});

// Session check
async function getSession(){ const { data: { session } } = await supa.auth.getSession(); return session; }
async function ensureSession(){
  const s = await getSession();
  if (!s?.user){ setStatus('Faça login em admin.html antes.', '#b00020'); throw new Error('No session'); }
  setStatus('Logado.');
  return s;
}

// Utils
function fmt(n){ return Number(n).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
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

// Loaders init
let accounts = [];
let categories = [];

async function loadAccounts(){
  const { data, error } = await supa.from('accounts').select('*').order('created_at', { ascending:false });
  if (error) { console.error(error); setStatus('Erro ao carregar contas', '#b00020'); return; }
  accounts = data || [];
  const tbody = document.getElementById('tb-accounts');
  tbody.innerHTML = accounts.map(a => `
    <tr data-id="${a.id}">
      <td>${a.name}</td>
      <td>${a.type}</td>
      <td>${a.currency}</td>
      <td>€ ${fmt(a.opening_balance)}</td>
      <td>${new Date(a.created_at).toLocaleString()}</td>
      <td><button class="btn-del-acc" data-id="${a.id}" style="background:#9e1c1c;">Excluir</button></td>
    </tr>
  }).join('');

  // fill account select for transactions
  const sel = document.getElementById('tx-account');
  sel.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
}

async function loadCategories(){
  const { data, error } = await supa.from('categories').select('*').order('name', { ascending:true });
  if (error) { console.error(error); setStatus('Erro ao carregar categorias', '#b00020'); return; }
  categories = data || [];
  const sel = document.getElementById('tx-category');
  sel.innerHTML = categories.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join('');
}

async function loadTransactions(){
  const from = document.getElementById('tx-from').value;
  const to = document.getElementById('tx-to').value;

  let q = supa.from('transactions').select('id,date,account_id,category_id,amount,memo,created_at').order('date', { ascending:false }).order('created_at', { ascending:false });
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);

  const { data, error } = await q;
  if (error) { console.error(error); setStatus('Erro ao listar transações', '#b00020'); return; }
  const rows = data || [];

  const mapAcc = Object.fromEntries(accounts.map(a=>[a.id, a.name]));
  const mapCat = Object.fromEntries(categories.map(c=>[c.id, `${c.name}`]));

  const tbody = document.getElementById('tb-transactions');
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td>${r.date}</td>
      <td>${mapAcc[r.account_id] || r.account_id}</td>
      <td>${mapCat[r.category_id] || '-'}</td>
      <td>${r.amount >= 0 ? '+' : '-'} € ${fmt(Math.abs(r.amount))}</td>
      <td>${r.memo || ''}</td>
      <td><button class="btn-del-tx" data-id="${r.id}" style="background:#9e1c1c;">Excluir</button></td>
    </tr>
  `).join('');

  // Export
  document.getElementById('btn-export-tx').onclick = () => {
    const csv = toCSV(rows.map(r => ({
      id: r.id, date: r.date, account: mapAcc[r.account_id] || r.account_id,
      category: mapCat[r.category_id] || '', amount: r.amount, memo: r.memo || ''
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // Wire delete
  document.querySelectorAll('.btn-del-tx').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Excluir transação?')) return;
      const { error } = await supa.from('transactions').delete().eq('id', btn.dataset.id);
      if (error) { alert('Erro ao excluir'); console.error(error); }
      await loadTransactions();
    };
  });
}

async function loadDebts(){
  // usar view v_debt_balances para saldo atual
  const { data, error } = await supa.from('v_debt_balances').select('*');
  if (error) { console.error(error); setStatus('Erro ao listar dívidas', '#b00020'); return; }
  const rows = data || [];
  const tbody = document.getElementById('tb-debts');
  tbody.innerHTML = rows.map(d => `
    <tr data-id="${d.debt_id}">
      <td>${d.creditor}</td>
      <td>€ ${fmt(d.principal)}</td>
      <td>€ ${fmt(d.current_balance)}</td>
      <td>${d.apr_percent ?? ''}</td>
      <td>${d.monthly_interest_percent ?? ''}</td>
      <td>€ ${fmt(d.min_payment ?? 0)}</td>
      <td>${d.due_day ?? '-'}</td>
      <td>${d.status}</td>
      <td>
        <button class="btn-close-debt" data-id="${d.debt_id}" style="background:#555;">Fechar</button>
        <button class="btn-del-debt" data-id="${d.debt_id}" style="background:#9e1c1c;">Excluir</button>
      </td>
    </tr>
  `).join('');

  // wire actions
  document.querySelectorAll('.btn-close-debt').forEach(btn=>{
    btn.onclick = async ()=> {
      const { error } = await supa.from('debts').update({ status: 'closed' }).eq('id', btn.dataset.id);
      if (error) { alert('Erro ao fechar dívida'); console.error(error); }
      await loadDebts();
    };
  });
  document.querySelectorAll('.btn-del-debt').forEach(btn=>{
    btn.onclick = async ()=> {
      if (!confirm('Excluir dívida?')) return;
      const { error } = await supa.from('debts').delete().eq('id', btn.dataset.id);
      if (error) { alert('Erro ao excluir'); console.error(error); }
      await loadDebts();
    };
  });
}

// Add handlers
document.getElementById('btn-add-account').onclick = async () => {
  try {
    const name = document.getElementById('acc-name').value.trim();
    const type = document.getElementById('acc-type').value;
    const opening = parseFloat(document.getElementById('acc-opening').value || '0');
    if (!name) return alert('Informe o nome da conta.');
    const { error } = await supa.from('accounts').insert({ name, type, opening_balance: opening, currency: 'EUR' });
    if (error) { console.error(error); alert('Erro ao criar conta'); return; }
    document.getElementById('acc-name').value = '';
    document.getElementById('acc-opening').value = '';
    await loadAccounts();
  } catch(e){ console.error(e); }
};
document.getElementById('tb-accounts').addEventListener('click', async (e)=>{
  const btn = e.target.closest('.btn-del-acc'); if (!btn) return;
  if (!confirm('Excluir conta? Isso apagará transações associadas.')) return;
  const { error } = await supa.from('accounts').delete().eq('id', btn.dataset.id);
  if (error) { console.error(error); alert('Erro ao excluir conta'); return; }
  await loadAccounts(); await loadTransactions();
});

document.getElementById('btn-add-tx').onclick = async () => {
  try {
    const date = document.getElementById('tx-date').value || new Date().toISOString().slice(0,10);
    const account_id = document.getElementById('tx-account').value;
    const category_id = document.getElementById('tx-category').value || null;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const memo = document.getElementById('tx-memo').value.trim() || null;
    if (!account_id || !amount) return alert('Conta e valor são obrigatórios.');
    const { error } = await supa.from('transactions').insert({ date, account_id, category_id, amount, memo });
    if (error) { console.error(error); alert('Erro ao criar transação'); return; }
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-memo').value = '';
    await loadTransactions();
  } catch(e){ console.error(e); }
};
document.getElementById('btn-filter-tx').onclick = loadTransactions;

document.getElementById('btn-add-debt').onclick = async () => {
  try {
    const creditor = document.getElementById('debt-creditor').value.trim();
    const principal = parseFloat(document.getElementById('debt-principal').value);
    const apr = document.getElementById('debt-apr').value ? parseFloat(document.getElementById('debt-apr').value) : null;
    const monthly = document.getElementById('debt-monthly').value ? parseFloat(document.getElementById('debt-monthly').value) : null;
    const due_day = document.getElementById('debt-due-day').value ? parseInt(document.getElementById('debt-due-day').value) : null;
    const min_payment = document.getElementById('debt-min').value ? parseFloat(document.getElementById('debt-min').value) : 0;
    if (!creditor || !principal) return alert('Credor e principal são obrigatórios.');
    const { error } = await supa.from('debts').insert({
      creditor, principal, apr_percent: apr, monthly_interest_percent: monthly,
      due_day, min_payment, status: 'open'
    });
    if (error) { console.error(error); alert('Erro ao criar dívida'); return; }
    document.getElementById('debt-creditor').value = '';
    document.getElementById('debt-principal').value = '';
    document.getElementById('debt-apr').value = '';
    document.getElementById('debt-monthly').value = '';
    document.getElementById('debt-due-day').value = '';
    document.getElementById('debt-min').value = '';
    await loadDebts();
  } catch(e){ console.error(e); }
};

// Init
(async function init(){
  try {
    await ensureSession();
    // Defaults for date filters
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('tx-date').value = today;
    const firstOfMonth = new Date(); firstOfMonth.setDate(1);
    document.getElementById('tx-from').value = firstOfMonth.toISOString().slice(0,10);
    document.getElementById('tx-to').value = today;

    await loadAccounts();
    await loadCategories();
    await loadTransactions();
    await loadDebts();
  } catch(e){ /* sem sessão, já avisado */ }
})();
