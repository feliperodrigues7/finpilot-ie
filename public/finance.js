// FinPilot IE - LocalStorage Edition

// Util
const $ = (id) => document.getElementById(id);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const fmt = (n) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(n||0));
const toast = (msg) => { const t=$('toast'); if(!t){ alert(msg); return;} t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 3000); };
const uid = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

// Data Layer (LocalStorage)
const DB_KEYS = {
  people: 'fp_people',
  accounts: 'fp_accounts',
  categories: 'fp_categories',
  transactions: 'fp_transactions',
  recurring: 'fp_recurring'
};

const storage = {
  get: (k, d=[]) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch(_) { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

const data = {
  // People
  getPeople(){ return storage.get(DB_KEYS.people); },
  savePerson(name){ name = (name||'').trim(); if(!name) return null; const people=this.getPeople(); if(!people.includes(name)) { people.push(name); storage.set(DB_KEYS.people, people); } return name; },
  deletePerson(name){ let people=this.getPeople().filter(p=>p!==name); storage.set(DB_KEYS.people, people); },

  // Accounts
  getAccounts(){ return storage.get(DB_KEYS.accounts); },
  saveAccount(acc){ const list=this.getAccounts(); if(!acc.id){ acc.id=uid(); list.push(acc);} else { const i=list.findIndex(a=>a.id===acc.id); if(i>-1) list[i]=acc; else list.push(acc);} storage.set(DB_KEYS.accounts, list); return acc; },
  deleteAccount(id){ storage.set(DB_KEYS.accounts, this.getAccounts().filter(a=>a.id!==id)); },
  updateAccountBalance(id, newBalance){ const list=this.getAccounts(); const i=list.findIndex(a=>a.id===id); if(i>-1){ list[i].balance=Number(newBalance||0); storage.set(DB_KEYS.accounts, list); return list[i]; } return null; },

  // Categories
  getCategories(){ return storage.get(DB_KEYS.categories); },
  saveCategory(cat){ const list=this.getCategories(); if(!cat.id){ cat.id=uid(); list.push(cat);} else { const i=list.findIndex(c=>c.id===cat.id); if(i>-1) list[i]=cat; else list.push(cat);} storage.set(DB_KEYS.categories, list); return cat; },
  deleteCategory(id){ storage.set(DB_KEYS.categories, this.getCategories().filter(c=>c.id!==id)); },

  // Transactions
  getTransactions(){ return storage.get(DB_KEYS.transactions); },
  saveTransaction(tx){ const list=this.getTransactions(); if(!tx.id){ tx.id=uid(); list.push(tx);} else { const i=list.findIndex(t=>t.id===tx.id); if(i>-1) list[i]=tx; else list.push(tx);} storage.set(DB_KEYS.transactions, list); return tx; },
  deleteTransaction(id){ storage.set(DB_KEYS.transactions, this.getTransactions().filter(t=>t.id!==id)); },

  // Recurring
  getRecurring(){ return storage.get(DB_KEYS.recurring); },
  saveRecurring(r){ const list=this.getRecurring(); if(!r.id){ r.id=uid(); list.push(r);} else { const i=list.findIndex(x=>x.id===r.id); if(i>-1) list[i]=r; else list.push(r);} storage.set(DB_KEYS.recurring, list); return r; },
  deleteRecurring(id){ storage.set(DB_KEYS.recurring, this.getRecurring().filter(r=>r.id!==id)); }
};

// Render Helpers
function renderPeople(){
  const ul = $('people-list'); if(!ul) return; ul.innerHTML='';
  data.getPeople().forEach(p=>{
    const li=document.createElement('li'); li.className='mb-1 flex items-center justify-between';
    li.innerHTML = `<span>${p}</span><button data-name="${p}" class="del-person bg-red-500 text-white px-2 py-1 rounded text-sm">Excluir</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.del-person').forEach(btn=>on(btn,'click',()=>{ data.deletePerson(btn.dataset.name); renderPeople(); renderPeopleOptions(); toast('Pessoa excluída'); }));
}

function renderPeopleOptions(){
  // Preencher campos de texto com datalist para sugestão
  const makeDatalist = (idInput) => {
    const input=$(idInput); if(!input) return;
    const listId = idInput+'-list';
    let dl = document.getElementById(listId);
    if(!dl){ dl = document.createElement('datalist'); dl.id=listId; document.body.appendChild(dl); input.setAttribute('list', listId); }
    dl.innerHTML='';
    data.getPeople().forEach(p=>{ const opt=document.createElement('option'); opt.value=p; dl.appendChild(opt); });
  };
  ['account-owner-name','transaction-owner-name','category-owner-name','recurring-owner-name'].forEach(makeDatalist);
}

function renderAccounts(){
  const tbody=$('accounts-table-body'); if(!tbody) return; tbody.innerHTML='';
  const list=data.getAccounts();
  if(!list.length){ tbody.innerHTML='<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhuma conta.</td></tr>'; return; }
  list.forEach(acc=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="py-2 px-3 border-b">${acc.owner||''}</td>
      <td class="py-2 px-3 border-b">${acc.bank||''}</td>
      <td class="py-2 px-3 border-b">${acc.name||''}</td>
      <td class="py-2 px-3 border-b">${fmt(acc.balance)}</td>
      <td class="py-2 px-3 border-b">
        <button class="edit-acc bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${acc.id}">Editar</button>
        <button class="del-acc bg-red-500 text-white px-2 py-1 rounded" data-id="${acc.id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.edit-acc').forEach(b=>on(b,'click',()=>openAccountModal(b.dataset.id)));
  tbody.querySelectorAll('.del-acc').forEach(b=>on(b,'click',()=>{ data.deleteAccount(b.dataset.id); renderAccounts(); renderAccountSelects(); toast('Conta excluída'); }));
  renderAccountSelects();
  renderDashboard();
}

function renderAccountSelects(){
  const accs=data.getAccounts();
  const sel1=$('transaction-account'); const sel2=$('transaction-account-dst'); const selR=$('recurring-account');
  [sel1, sel2, selR].forEach(sel=>{ if(!sel) return; sel.innerHTML='<option value="">Selecione</option>'; accs.forEach(a=>{ const opt=document.createElement('option'); opt.value=a.id; opt.textContent=`${a.owner? a.owner+ ' - ':''}${a.bank? a.bank+' / ':''}${a.name}`; sel.appendChild(opt); }); });
}

function renderCategories(){
  const tbody=$('categories-table-body'); if(!tbody) return; tbody.innerHTML='';
  const list=data.getCategories(); if(!list.length){ tbody.innerHTML='<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhuma categoria.</td></tr>'; return; }
  list.forEach(cat=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="py-2 px-3 border-b">${cat.owner||''}</td>
      <td class="py-2 px-3 border-b">${cat.name||''}</td>
      <td class="py-2 px-3 border-b">${cat.type||''}</td>
      <td class="py-2 px-3 border-b">
        <button class="edit-cat bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${cat.id}">Editar</button>
        <button class="del-cat bg-red-500 text-white px-2 py-1 rounded" data-id="${cat.id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.edit-cat').forEach(b=>on(b,'click',()=>openCategoryModal(b.dataset.id)));
  tbody.querySelectorAll('.del-cat').forEach(b=>on(b,'click',()=>{ data.deleteCategory(b.dataset.id); renderCategories(); toast('Categoria excluída'); }));
  renderCategorySelects();
}

function renderCategorySelects(){
  const cats=data.getCategories();
  const selT=$('transaction-category'); const selR=$('recurring-category'); const selB=$('budget-category');
  [selT, selR, selB].forEach(sel=>{ if(!sel) return; sel.innerHTML='<option value="">Selecione</option>'; cats.forEach(c=>{ const opt=document.createElement('option'); opt.value=c.id; opt.textContent=`${c.owner? c.owner+' - ':''}${c.name} (${c.type})`; sel.appendChild(opt); }); });
}

function renderTransactions(){
  const tbody=$('transactions-table-body'); if(!tbody) return; tbody.innerHTML='';
  const list=[...data.getTransactions()].sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  if(!list.length){ tbody.innerHTML='<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhuma transação.</td></tr>'; return; }
  list.forEach(tx=>{
    const acc = data.getAccounts().find(a=>a.id===tx.account_id);
    const accDst = data.getAccounts().find(a=>a.id===tx.account_id_dst);
    const cat = data.getCategories().find(c=>c.id===tx.category_id);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="py-2 px-3 border-b">${tx.owner||''}</td>
      <td class="py-2 px-3 border-b">${tx.type}</td>
      <td class="py-2 px-3 border-b">${tx.date||''}</td>
      <td class="py-2 px-3 border-b">${tx.description||''}</td>
      <td class="py-2 px-3 border-b">${fmt(tx.amount)}</td>
      <td class="py-2 px-3 border-b">${acc? (acc.bank? acc.bank+' / ':'')+acc.name : ''}</td>
      <td class="py-2 px-3 border-b">${accDst? (accDst.bank? accDst.bank+' / ':'')+accDst.name : ''}</td>
      <td class="py-2 px-3 border-b">${cat? cat.name: ''}</td>
      <td class="py-2 px-3 border-b">
        <button class="edit-tx bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${tx.id}">Editar</button>
        <button class="del-tx bg-red-500 text-white px-2 py-1 rounded" data-id="${tx.id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.edit-tx').forEach(b=>on(b,'click',()=>openTransactionModal(b.dataset.id)));
  tbody.querySelectorAll('.del-tx').forEach(b=>on(b,'click',()=>{ deleteTransactionAndAdjust(b.dataset.id); renderTransactions(); renderAccounts(); toast('Transação excluída'); }));
  renderDashboard();
}

function renderRecurring(){
  const tbody=$('recurring-table-body'); if(!tbody) return; tbody.innerHTML='';
  const list=data.getRecurring(); if(!list.length){ tbody.innerHTML='<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhuma recorrência.</td></tr>'; return; }
  list.forEach(r=>{
    const acc = data.getAccounts().find(a=>a.id===r.account_id);
    const cat = data.getCategories().find(c=>c.id===r.category_id);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="py-2 px-3 border-b">${r.owner||''}</td>
      <td class="py-2 px-3 border-b">${r.title||''}</td>
      <td class="py-2 px-3 border-b">${fmt(r.amount)}</td>
      <td class="py-2 px-3 border-b">${r.type}</td>
      <td class="py-2 px-3 border-b">${r.frequency}</td>
      <td class="py-2 px-3 border-b">${r.next_date||''}</td>
      <td class="py-2 px-3 border-b">${acc? (acc.bank? acc.bank+' / ':'')+acc.name : ''}</td>
      <td class="py-2 px-3 border-b">${cat? cat.name: ''}</td>
      <td class="py-2 px-3 border-b">
        <button class="gen-now bg-blue-600 text-white px-2 py-1 rounded mr-2" data-id="${r.id}">Gerar agora</button>
        <button class="edit-rec bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${r.id}">Editar</button>
        <button class="del-rec bg-red-500 text-white px-2 py-1 rounded" data-id="${r.id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.gen-now').forEach(b=>on(b,'click',()=>{ generateRecurringNow(b.dataset.id); renderTransactions(); renderRecurring(); renderAccounts(); }));
  tbody.querySelectorAll('.edit-rec').forEach(b=>on(b,'click',()=>openRecurringModal(b.dataset.id)));
  tbody.querySelectorAll('.del-rec').forEach(b=>on(b,'click',()=>{ data.deleteRecurring(b.dataset.id); renderRecurring(); toast('Recorrência excluída'); }));
}

function renderDashboard(){
  const accs = data.getAccounts();
  const txs = data.getTransactions();
  const total = accs.reduce((s,a)=> s + Number(a.balance||0), 0);
  const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthTx = txs.filter(t=> (t.date||'').startsWith(ym));
  const income = monthTx.filter(t=>t.type==='income').reduce((s,t)=> s + Number(t.amount||0), 0);
  const expense = monthTx.filter(t=>t.type==='expense').reduce((s,t)=> s + Number(t.amount||0), 0);
  const tb=$('total-balance'); const mi=$('monthly-income'); const me=$('monthly-expenses');
  if(tb) tb.textContent=fmt(total); if(mi) mi.textContent=fmt(income); if(me) me.textContent=fmt(expense);
}

// CRUD helpers with side-effects
function openAccountModal(id){
  const modal=$('account-modal'); if(!modal) return; modal.style.display='block';
  const form=$('account-form'); form.reset();
  if(id){ const acc=data.getAccounts().find(a=>a.id===id); if(acc){ $('account-id').value=acc.id; $('account-owner-name').value=acc.owner||''; $('account-bank').value=acc.bank||''; $('account-name').value=acc.name||''; $('account-balance').value=acc.balance||0; }}
}

function openCategoryModal(id){
  const modal=$('category-modal'); if(!modal) return; modal.style.display='block';
  const form=$('category-form'); form.reset();
  if(id){ const c=data.getCategories().find(x=>x.id===id); if(c){ $('category-id').value=c.id; $('category-owner-name').value=c.owner||''; $('category-name').value=c.name||''; $('category-type').value=c.type||'expense'; }}
}

function openTransactionModal(id){
  const modal=$('transaction-modal'); if(!modal) return; modal.style.display='block';
  const form=$('transaction-form'); form.reset();
  if(id){ const t=data.getTransactions().find(x=>x.id===id); if(t){ $('transaction-id').value=t.id; $('transaction-owner-name').value=t.owner||''; $('transaction-type').value=t.type||'expense'; $('transaction-date').value=t.date||''; $('transaction-description').value=t.description||''; $('transaction-amount').value=t.amount||0; $('transaction-account').value=t.account_id||''; $('transaction-account-dst').value=t.account_id_dst||''; $('transaction-category').value=t.category_id||''; }}
}

function openRecurringModal(id){
  const modal=$('recurring-modal'); if(!modal) return; modal.style.display='block';
  const form=$('recurring-form'); form.reset();
  if(id){ const r=data.getRecurring().find(x=>x.id===id); if(r){ $('recurring-id').value=r.id; $('recurring-owner-name').value=r.owner||''; $('recurring-title').value=r.title||''; $('recurring-type').value=r.type||'expense'; $('recurring-amount').value=r.amount||0; $('recurring-frequency').value=r.frequency||'monthly'; $('recurring-next').value=r.next_date||''; $('recurring-account').value=r.account_id||''; $('recurring-category').value=r.category_id||''; }}
}

function deleteTransactionAndAdjust(id){
  const tx = data.getTransactions().find(t=>t.id===id); if(!tx){ data.deleteTransaction(id); return; }
  if(tx.type==='income'){ const a = data.getAccounts().find(a=>a.id===tx.account_id); if(a){ data.updateAccountBalance(a.id, Number(a.balance||0) - Number(tx.amount||0)); } }
  else if(tx.type==='expense'){ const a = data.getAccounts().find(a=>a.id===tx.account_id); if(a){ data.updateAccountBalance(a.id, Number(a.balance||0) + Number(tx.amount||0)); } }
  else if(tx.type==='transfer'){ const a = data.getAccounts().find(a=>a.id===tx.account_id); const b = data.getAccounts().find(a=>a.id===tx.account_id_dst); if(a){ data.updateAccountBalance(a.id, Number(a.balance||0) + Number(tx.amount||0)); } if(b){ data.updateAccountBalance(b.id, Number(b.balance||0) - Number(tx.amount||0)); } }
  data.deleteTransaction(id);
}

function nextDate(freq, d){
  const dt = new Date(d);
  if(freq==='weekly') dt.setDate(dt.getDate()+7);
  else if(freq==='biweekly') dt.setDate(dt.getDate()+14);
  else dt.setMonth(dt.getMonth()+1);
  return dt.toISOString().slice(0,10);
}

function generateRecurringNow(id){
  const r = data.getRecurring().find(x=>x.id===id); if(!r) return;
  const tx = { owner:r.owner, type:r.type, date:r.next_date || new Date().toISOString().slice(0,10), description:r.title, amount:Number(r.amount||0), account_id:r.account_id, account_id_dst:null, category_id:r.category_id };
  // Apply to accounts
  if(r.type==='income'){ const a=data.getAccounts().find(a=>a.id===r.account_id); if(a) data.updateAccountBalance(a.id, Number(a.balance||0)+Number(tx.amount)); }
  else if(r.type==='expense'){ const a=data.getAccounts().find(a=>a.id===r.account_id); if(a) data.updateAccountBalance(a.id, Number(a.balance||0)-Number(tx.amount)); }
  data.saveTransaction(tx);
  // Advance next date
  r.next_date = nextDate(r.frequency||'monthly', tx.date);
  data.saveRecurring(r);
  toast('Transação gerada a partir da recorrência');
}

// Exports
function exportTransactionsCSV(){
  const txs = data.getTransactions();
  const headers = ['id','owner','type','date','description','amount','account_id','account_id_dst','category_id'];
  const rows = [headers.join(',')].concat(txs.map(t=> headers.map(h=> JSON.stringify(t[h]!==undefined? t[h]: '')).join(',')));
  const blob = new Blob([rows.join('
')], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='transacoes.csv'; a.click(); URL.revokeObjectURL(url);
}

// Wire
function wireTabs(){
  const btns=document.querySelectorAll('.tab-button'); const contents=document.querySelectorAll('.tab-content');
  btns.forEach(b=>on(b,'click',()=>{ btns.forEach(x=>x.classList.remove('active')); contents.forEach(c=>c.classList.remove('active')); b.classList.add('active'); const el=$(b.dataset.tab); if(el) el.classList.add('active'); }));
}

function wireModals(){
  document.querySelectorAll('.modal').forEach(m=>{
    const close=m.querySelector('.close-button'); if(close) on(close,'click',()=>m.style.display='none');
    on(m,'click',(e)=>{ if(e.target===m) m.style.display='none'; });
    m.querySelectorAll('.cancel-btn').forEach(b=> on(b,'click',()=> m.style.display='none'));
  });
}

function wireButtons(){
  on($('add-account-button'),'click',()=>openAccountModal());
  on($('add-category-button'),'click',()=>openCategoryModal());
  on($('add-transaction-button'),'click',()=>openTransactionModal());
  on($('add-recurring-button'),'click',()=>openRecurringModal());
  on($('export-transactions-button'),'click',exportTransactionsCSV);
  on($('logout-button'),'click',()=> toast('Sessão encerrada (modo local)'));
}

function wireForms(){
  const accForm=$('account-form'); if(accForm) on(accForm,'submit',(e)=>{ e.preventDefault();
    const id=$('account-id').value||null; const owner=$('account-owner-name').value.trim(); const bank=$('account-bank').value.trim(); const name=$('account-name').value.trim(); const bal=Number($('account-balance').value||0);
    if(!owner||!name){ toast('Preencha Pessoa e Nome da Conta'); return; }
    data.savePerson(owner);
    const acc={ id, owner, bank, name, balance:bal };
    data.saveAccount(acc); toast(id? 'Conta atualizada':'Conta criada');
    $('account-modal').style.display='none'; renderPeople(); renderAccounts();
  });

  const catForm=$('category-form'); if(catForm) on(catForm,'submit',(e)=>{ e.preventDefault();
    const id=$('category-id').value||null; const owner=$('category-owner-name').value.trim(); const name=$('category-name').value.trim(); const type=$('category-type').value;
    if(!owner||!name){ toast('Preencha Pessoa e Nome'); return; }
    data.savePerson(owner);
    const cat={ id, owner, name, type };
    data.saveCategory(cat); toast(id? 'Categoria atualizada':'Categoria criada');
    $('category-modal').style.display='none'; renderPeople(); renderCategories();
  });

  const txForm=$('transaction-form'); if(txForm) on(txForm,'submit',(e)=>{ e.preventDefault();
    const id=$('transaction-id').value||null; const owner=$('transaction-owner-name').value.trim(); const type=$('transaction-type').value; const date=$('transaction-date').value; const description=$('transaction-description').value.trim(); const amount=Number($('transaction-amount').value||0); const account_id=$('transaction-account').value||null; const account_id_dst=$('transaction-account-dst').value||null; const category_id=$('transaction-category').value||null;
    if(!owner||!date||!description||!amount||!account_id){ toast('Preencha Pessoa, Data, Descrição, Valor e Conta'); return; }
    data.savePerson(owner);
    // Adjust balances
    if(!id){ // new
      if(type==='income'){ const a=data.getAccounts().find(a=>a.id===account_id); if(a) data.updateAccountBalance(a.id, Number(a.balance||0)+amount); }
      else if(type==='expense'){ const a=data.getAccounts().find(a=>a.id===account_id); if(a) data.updateAccountBalance(a.id, Number(a.balance||0)-amount); }
      else if(type==='transfer'){
        if(!account_id_dst || account_id_dst===account_id){ toast('Selecione uma conta destino diferente'); return; }
        const a=data.getAccounts().find(a=>a.id===account_id); const b=data.getAccounts().find(a=>a.id===account_id_dst);
        if(!a||!b){ toast('Contas inválidas'); return; }
        data.updateAccountBalance(a.id, Number(a.balance||0)-amount);
        data.updateAccountBalance(b.id, Number(b.balance||0)+amount);
      }
    } else {
      // For simplicity, não reprocessamos saldo em edição; recomendável excluir e recriar, mas mantemos simples
    }

    const tx={ id, owner, type, date, description, amount, account_id, account_id_dst: type==='transfer'? account_id_dst: null, category_id };
    data.saveTransaction(tx); toast(id? 'Transação atualizada':'Transação criada');
    $('transaction-modal').style.display='none'; renderPeople(); renderTransactions(); renderAccounts();
  });

  const recForm=$('recurring-form'); if(recForm) on(recForm,'submit',(e)=>{ e.preventDefault();
    const id=$('recurring-id').value||null; const owner=$('recurring-owner-name').value.trim(); const title=$('recurring-title').value.trim(); const type=$('recurring-type').value; const amount=Number($('recurring-amount').value||0); const frequency=$('recurring-frequency').value; const next_date=$('recurring-next').value; const account_id=$('recurring-account').value||null; const category_id=$('recurring-category').value||null;
    if(!owner||!title||!amount||!next_date||!account_id){ toast('Preencha Pessoa, Título, Valor, Próxima Data e Conta'); return; }
    data.savePerson(owner);
    const r={ id, owner, title, type, amount, frequency, next_date, account_id, category_id };
    data.saveRecurring(r); toast(id? 'Recorrência atualizada':'Recorrência criada');
    $('recurring-modal').style.display='none'; renderPeople(); renderRecurring();
  });
}

function init(){
  wireTabs(); wireModals(); wireButtons(); wireForms();
  renderPeople(); renderPeopleOptions(); renderAccounts(); renderCategories(); renderTransactions(); renderRecurring(); renderDashboard();
}

document.addEventListener('DOMContentLoaded', init);
