// FinPilot IE - LocalStorage Edition (ASCII-safe)
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function on(el, ev, fn){ if(el) el.addEventListener(ev, fn); }
  function fmt(n){ return new Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR' }).format(Number(n||0)); }
  function toast(msg){ var t=$('toast'); if(!t){ alert(msg); return; } t.textContent=msg; t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 3000); }
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

  var DB_KEYS = { people:'fp_people', accounts:'fp_accounts', categories:'fp_categories', transactions:'fp_transactions', recurring:'fp_recurring' };
  var storage = {
    get: function(k, d){ if(d===void 0) d=[]; try{ var v=localStorage.getItem(k); return v? JSON.parse(v): d; } catch(e){ return d; } },
    set: function(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };

  var data = {
    getPeople: function(){ return storage.get(DB_KEYS.people); },
    savePerson: function(name){ name=(name||'').trim(); if(!name) return null; var people=this.getPeople(); if(people.indexOf(name)===-1){ people.push(name); storage.set(DB_KEYS.people, people);} return name; },
    deletePerson: function(name){ var people=this.getPeople().filter(function(p){ return p!==name; }); storage.set(DB_KEYS.people, people); },

    getAccounts: function(){ return storage.get(DB_KEYS.accounts); },
    saveAccount: function(acc){ var list=this.getAccounts(); if(!acc.id){ acc.id=uid(); list.push(acc);} else { var i=list.findIndex(function(a){ return a.id===acc.id; }); if(i>-1) list[i]=acc; else list.push(acc);} storage.set(DB_KEYS.accounts, list); return acc; },
    deleteAccount: function(id){ storage.set(DB_KEYS.accounts, this.getAccounts().filter(function(a){ return a.id!==id; })); },
    updateAccountBalance: function(id, newBalance){ var list=this.getAccounts(); var i=list.findIndex(function(a){ return a.id===id; }); if(i>-1){ list[i].balance=Number(newBalance||0); storage.set(DB_KEYS.accounts, list); return list[i]; } return null; },

    getCategories: function(){ return storage.get(DB_KEYS.categories); },
    saveCategory: function(cat){ var list=this.getCategories(); if(!cat.id){ cat.id=uid(); list.push(cat);} else { var i=list.findIndex(function(c){ return c.id===cat.id; }); if(i>-1) list[i]=cat; else list.push(cat);} storage.set(DB_KEYS.categories, list); return cat; },
    deleteCategory: function(id){ storage.set(DB_KEYS.categories, this.getCategories().filter(function(c){ return c.id!==id; })); },

    getTransactions: function(){ return storage.get(DB_KEYS.transactions); },
    saveTransaction: function(tx){ var list=this.getTransactions(); if(!tx.id){ tx.id=uid(); list.push(tx);} else { var i=list.findIndex(function(t){ return t.id===tx.id; }); if(i>-1) list[i]=tx; else list.push(tx);} storage.set(DB_KEYS.transactions, list); return tx; },
    deleteTransaction: function(id){ storage.set(DB_KEYS.transactions, this.getTransactions().filter(function(t){ return t.id!==id; })); },

    getRecurring: function(){ return storage.get(DB_KEYS.recurring); },
    saveRecurring: function(r){ var list=this.getRecurring(); if(!r.id){ r.id=uid(); list.push(r);} else { var i=list.findIndex(function(x){ return x.id===r.id; }); if(i>-1) list[i]=r; else list.push(r);} storage.set(DB_KEYS.recurring, list); return r; },
    deleteRecurring: function(id){ storage.set(DB_KEYS.recurring, this.getRecurring().filter(function(r){ return r.id!==id; })); }
  };

  function renderPeople(){
    var ul=$('people-list'); if(!ul) return; ul.innerHTML='';
    data.getPeople().forEach(function(p){
      var li=document.createElement('li'); li.className='mb-1 flex items-center justify-between';
      li.innerHTML='<span>'+p+'</span><button data-name="'+p+'" class="del-person bg-red-500 text-white px-2 py-1 rounded text-sm">Excluir</button>';
      ul.appendChild(li);
    });
    ul.querySelectorAll('.del-person').forEach(function(btn){ on(btn,'click',function(){ data.deletePerson(btn.getAttribute('data-name')); renderPeople(); renderPeopleOptions(); toast('Pessoa excluida'); }); });
  }

  function renderPeopleOptions(){
    function makeDatalist(idInput){
      var input=$(idInput); if(!input) return;
      var listId=idInput+'-list'; var dl=document.getElementById(listId);
      if(!dl){ dl=document.createElement('datalist'); dl.id=listId; document.body.appendChild(dl); input.setAttribute('list', listId); }
      dl.innerHTML='';
      data.getPeople().forEach(function(p){ var opt=document.createElement('option'); opt.value=p; dl.appendChild(opt); });
    }
    ['account-owner-name','transaction-owner-name','category-owner-name','recurring-owner-name'].forEach(makeDatalist);
  }

  function renderAccounts(){
    var tbody=$('accounts-table-body'); if(!tbody) return; tbody.innerHTML='';
    var list=data.getAccounts(); if(!list.length){ tbody.innerHTML='<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhuma conta.</td></tr>'; return; }
    list.forEach(function(acc){
      var tr=document.createElement('tr');
      tr.innerHTML=
        '<td class="py-2 px-3 border-b">'+(acc.owner||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(acc.bank||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(acc.name||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+fmt(acc.balance)+'</td>'+
        '<td class="py-2 px-3 border-b">'+
          '<button class="edit-acc bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="'+acc.id+'">Editar</button>'+
          '<button class="del-acc bg-red-500 text-white px-2 py-1 rounded" data-id="'+acc.id+'">Excluir</button>'+
        '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.edit-acc').forEach(function(b){ on(b,'click',function(){ openAccountModal(b.getAttribute('data-id')); }); });
    tbody.querySelectorAll('.del-acc').forEach(function(b){ on(b,'click',function(){ data.deleteAccount(b.getAttribute('data-id')); renderAccounts(); renderAccountSelects(); toast('Conta excluida'); }); });
    renderAccountSelects(); renderDashboard();
  }

  function renderAccountSelects(){
    var accs=data.getAccounts();
    var sel1=$('transaction-account'); var sel2=$('transaction-account-dst'); var selR=$('recurring-account');
    [sel1, sel2, selR].forEach(function(sel){ if(!sel) return; sel.innerHTML='<option value="">Selecione</option>'; accs.forEach(function(a){ var opt=document.createElement('option'); opt.value=a.id; opt.textContent=(a.owner? a.owner+' - ':'')+(a.bank? a.bank+' / ':'')+a.name; sel.appendChild(opt); }); });
  }

  function renderCategories(){
    var tbody=$('categories-table-body'); if(!tbody) return; tbody.innerHTML='';
    var list=data.getCategories(); if(!list.length){ tbody.innerHTML='<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhuma categoria.</td></tr>'; return; }
    list.forEach(function(cat){
      var tr=document.createElement('tr');
      tr.innerHTML=
        '<td class="py-2 px-3 border-b">'+(cat.owner||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(cat.name||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(cat.type||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+
          '<button class="edit-cat bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="'+cat.id+'">Editar</button>'+
          '<button class="del-cat bg-red-500 text-white px-2 py-1 rounded" data-id="'+cat.id+'">Excluir</button>'+
        '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.edit-cat').forEach(function(b){ on(b,'click',function(){ openCategoryModal(b.getAttribute('data-id')); }); });
    tbody.querySelectorAll('.del-cat').forEach(function(b){ on(b,'click',function(){ data.deleteCategory(b.getAttribute('data-id')); renderCategories(); toast('Categoria excluida'); }); });
    renderCategorySelects();
  }

  function renderCategorySelects(){
    var cats=data.getCategories();
    var selT=$('transaction-category'); var selR=$('recurring-category'); var selB=$('budget-category');
    [selT, selR, selB].forEach(function(sel){ if(!sel) return; sel.innerHTML='<option value="">Selecione</option>'; cats.forEach(function(c){ var opt=document.createElement('option'); opt.value=c.id; opt.textContent=(c.owner? c.owner+' - ':'')+c.name+' ('+c.type+')'; sel.appendChild(opt); }); });
  }

  function renderTransactions(){
    var tbody=$('transactions-table-body'); if(!tbody) return; tbody.innerHTML='';
    var list=data.getTransactions().slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    if(!list.length){ tbody.innerHTML='<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhuma transacao.</td></tr>'; return; }
    list.forEach(function(tx){
      var acc=data.getAccounts().find(function(a){ return a.id===tx.account_id; });
      var accDst=data.getAccounts().find(function(a){ return a.id===tx.account_id_dst; });
      var cat=data.getCategories().find(function(c){ return c.id===tx.category_id; });
      var tr=document.createElement('tr');
      tr.innerHTML=
        '<td class="py-2 px-3 border-b">'+(tx.owner||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+tx.type+'</td>'+
        '<td class="py-2 px-3 border-b">'+(tx.date||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(tx.description||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+fmt(tx.amount)+'</td>'+
        '<td class="py-2 px-3 border-b">'+(acc? (acc.bank? acc.bank+' / ':'')+acc.name : '')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(accDst? (accDst.bank? accDst.bank+' / ':'')+accDst.name : '')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(cat? cat.name: '')+'</td>'+
        '<td class="py-2 px-3 border-b">'+
          '<button class="edit-tx bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="'+tx.id+'">Editar</button>'+
          '<button class="del-tx bg-red-500 text-white px-2 py-1 rounded" data-id="'+tx.id+'">Excluir</button>'+
        '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.edit-tx').forEach(function(b){ on(b,'click',function(){ openTransactionModal(b.getAttribute('data-id')); }); });
    tbody.querySelectorAll('.del-tx').forEach(function(b){ on(b,'click',function(){ deleteTransactionAndAdjust(b.getAttribute('data-id')); renderTransactions(); renderAccounts(); toast('Transacao excluida'); }); });
    renderDashboard();
  }

  function renderRecurring(){
    var tbody=$('recurring-table-body'); if(!tbody) return; tbody.innerHTML='';
    var list=data.getRecurring(); if(!list.length){ tbody.innerHTML='<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhuma recorrencia.</td></tr>'; return; }
    list.forEach(function(r){
      var acc=data.getAccounts().find(function(a){ return a.id===r.account_id; });
      var cat=data.getCategories().find(function(c){ return c.id===r.category_id; });
      var tr=document.createElement('tr');
      tr.innerHTML=
        '<td class="py-2 px-3 border-b">'+(r.owner||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(r.title||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+fmt(r.amount)+'</td>'+
        '<td class="py-2 px-3 border-b">'+r.type+'</td>'+
        '<td class="py-2 px-3 border-b">'+r.frequency+'</td>'+
        '<td class="py-2 px-3 border-b">'+(r.next_date||'')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(acc? (acc.bank? acc.bank+' / ':'')+acc.name : '')+'</td>'+
        '<td class="py-2 px-3 border-b">'+(cat? cat.name: '')+'</td>'+
        '<td class="py-2 px-3 border-b">'+
          '<button class="gen-now bg-blue-600 text-white px-2 py-1 rounded mr-2" data-id="'+r.id+'">Gerar agora</button>'+
          '<button class="edit-rec bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="'+r.id+'">Editar</button>'+
          '<button class="del-rec bg-red-500 text-white px-2 py-1 rounded" data-id="'+r.id+'">Excluir</button>'+
        '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.gen-now').forEach(function(b){ on(b,'click',function(){ generateRecurringNow(b.getAttribute('data-id')); renderTransactions(); renderRecurring(); renderAccounts(); }); });
    tbody.querySelectorAll('.edit-rec').forEach(function(b){ on(b,'click',function(){ openRecurringModal(b.getAttribute('data-id')); }); });
    tbody.querySelectorAll('.del-rec').forEach(function(b){ on(b,'click',function(){ data.deleteRecurring(b.getAttribute('data-id')); renderRecurring(); toast('Recorrencia excluida'); }); });
  }

  function renderDashboard(){
    var accs=data.getAccounts(); var txs=data.getTransactions();
    var total=accs.reduce(function(s,a){ return s+Number(a.balance||0); }, 0);
    var now=new Date(); var ym=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,'0');
    var monthTx=txs.filter(function(t){ return (t.date||'').startsWith(ym); });
    var income=monthTx.filter(function(t){ return t.type==='income'; }).reduce(function(s,t){ return s+Number(t.amount||0); },0);
    var expense=monthTx.filter(function(t){ return t.type==='expense'; }).reduce(function(s,t){ return s+Number(t.amount||0); },0);
    var tb=$('total-balance'), mi=$('monthly-income'), me=$('monthly-expenses');
    if(tb) tb.textContent=fmt(total); if(mi) mi.textContent=fmt(income); if(me) me.textContent=fmt(expense);
  }

  function openAccountModal(id){
    var modal=$('account-modal'); if(!modal) return; modal.style.display='block'; var form=$('account-form'); form.reset();
    if(id){ var acc=data.getAccounts().find(function(a){ return a.id===id; }); if(acc){ $('account-id').value=acc.id; $('account-owner-name').value=acc.owner||''; $('account-bank').value=acc.bank||''; $('account-name').value=acc.name||''; $('account-balance').value=acc.balance||0; }}
  }
  function openCategoryModal(id){
    var modal=$('category-modal'); if(!modal) return; modal.style.display='block'; var form=$('category-form'); form.reset();
    if(id){ var c=data.getCategories().find(function(x){ return x.id===id; }); if(c){ $('category-id').value=c.id; $('category-owner-name').value=c.owner||''; $('category-name').value=c.name||''; $('category-type').value=c.type||'expense'; }}
  }
  function openTransactionModal(id){
    var modal=$('transaction-modal'); if(!modal) return; modal.style.display='block'; var form=$('transaction-form'); form.reset();
    if(id){ var t=data.getTransactions().find(function(x){ return x.id===id; }); if(t){ $('transaction-id').value=t.id; $('transaction-owner-name').value=t.owner||''; $('transaction-type').value=t.type||'expense'; $('transaction-date').value=t.date||''; $('transaction-description').value=t.description||''; $('transaction-amount').value=t.amount||0; $('transaction-account').value=t.account_id||''; $('transaction-account-dst').value=t.account_id_dst||''; $('transaction-category').value=t.category_id||''; }}
  }
  function openRecurringModal(id){
    var modal=$('recurring-modal'); if(!modal) return; modal.style.display='block'; var form=$('recurring-form'); form.reset();
    if(id){ var r=data.getRecurring().find(function(x){ return x.id===id; }); if(r){ $('recurring-id').value=r.id; $('recurring-owner-name').value=r.owner||''; $('recurring-title').value=r.title||''; $('recurring-type').value=r.type||'expense'; $('recurring-amount').value=r.amount||0; $('recurring-frequency').value=r.frequency||'monthly'; $('recurring-next').value=r.next_date||''; $('recurring-account').value=r.account_id||''; $('recurring-category').value=r.category_id||''; }}
  }

  function deleteTransactionAndAdjust(id){
    var tx=data.getTransactions().find(function(t){ return t.id===id; }); if(!tx){ data.deleteTransaction(id); return; }
    if(tx.type==='income'){ var a=data.getAccounts().find(function(a){ return a.id===tx.account_id; }); if(a) data.updateAccountBalance(a.id, Number(a.balance||0)-Number(tx.amount||0)); }
    else if(tx.type==='expense'){ var b=data.getAccounts().find(function(a){ return a.id===tx.account_id; }); if(b) data.updateAccountBalance(b.id, Number(b.balance||0)+Number(tx.amount||0)); }
    else if(tx.type==='transfer'){
      var o=data.getAccounts().find(function(a){ return a.id===tx.account_id; }); var d=data.getAccounts().find(function(a){ return a.id===tx.account_id_dst; });
      if(o) data.updateAccountBalance(o.id, Number(o.balance||0)+Number(tx.amount||0));
      if(d) data.updateAccountBalance(d.id, Number(d.balance||0)-Number(tx.amount||0));
    }
    data.deleteTransaction(id);
  }

  function nextDate(freq, d){ var dt=new Date(d); if(freq==='weekly') dt.setDate(dt.getDate()+7); else if(freq==='biweekly') dt.setDate(dt.getDate()+14); else dt.setMonth(dt.getMonth()+1); return dt.toISOString().slice(0,10); }

  function generateRecurringNow(id){
    var r=data.getRecurring().find(function(x){ return x.id===id; }); if(!r) return;
    var tx={ owner:r.owner, type:r.type, date:r.next_date || new Date().toISOString().slice(0,10), description:r.title, amount:Number(r.amount||0), account_id:r.account_id, account_id_dst:null, category_id:r.category_id };
    if(r.type==='income'){ var a=data.getAccounts().find(function(a){ return a.id===r.account_id; }); if(a) data.updateAccountBalance(a.id, Number(a.balance||0)+Number(tx.amount)); }
    else if(r.type==='expense'){ var b=data.getAccounts().find(function(a){ return a.id===r.account_id; }); if(b) data.updateAccountBalance(b.id, Number(b.balance||0)-Number(tx.amount)); }
    data.saveTransaction(tx); r.next_date=nextDate(r.frequency||'monthly', tx.date); data.saveRecurring(r); toast('Transacao gerada');
  }

  function exportTransactionsCSV(){
    var txs=data.getTransactions(); var headers=['id','owner','type','date','description','amount','account_id','account_id_dst','category_id'];
    var rows=[headers.join(',')].concat(txs.map(function(t){ return headers.map(function(h){ return JSON.stringify(t[h]!==void 0? t[h]: ''); }).join(','); }));
    var blob=new Blob([rows.join('
')], { type:'text/csv;charset=utf-8;' }); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download='transacoes.csv'; a.click(); URL.revokeObjectURL(url);
  }

  function wireTabs(){
    var container=document.body;
    container.addEventListener('click', function(e){
      var t=e.target; if(!t.classList.contains('tab-button')) return;
      var btns=document.querySelectorAll('.tab-button'); var contents=document.querySelectorAll('.tab-content');
      btns.forEach(function(x){ x.classList.remove('active'); }); contents.forEach(function(c){ c.classList.remove('active'); });
      t.classList.add('active'); var el=$(t.getAttribute('data-tab')); if(el) el.classList.add('active');
    });
  }

  function wireModals(){
    document.querySelectorAll('.modal').forEach(function(m){
      var close=m.querySelector('.close-button'); if(close) on(close,'click',function(){ m.style.display='none'; });
      on(m,'click',function(e){ if(e.target===m) m.style.display='none'; });
      m.querySelectorAll('.cancel-btn').forEach(function(b){ on(b,'click',function(){ m.style.display='none'; }); });
    });
  }

  function wireButtons(){
    on($('add-account-button'),'click',function(){ openAccountModal(); });
    on($('add-category-button'),'click',function(){ openCategoryModal(); });
    on($('add-transaction-button'),'click',function(){ openTransactionModal(); });
    on($('add-recurring-button'),'click',function(){ openRecurringModal(); });
    on($('export-transactions-button'),'click',exportTransactionsCSV);
    on($('logout-button'),'click',function(){ toast('Sessao encerrada (modo local)'); });
  }

  function wireForms(){
    var accForm=$('account-form'); if(accForm) on(accForm,'submit',function(e){ e.preventDefault();
      var id=$('account-id').value||null; var owner=($('account-owner-name').value||'').trim(); var bank=($('account-bank').value||'').trim(); var name=($('account-name').value||'').trim(); var bal=Number($('account-balance').value||0);
      if(!owner||!name){ toast('Preencha Pessoa e Nome da Conta'); return; }
      data.savePerson(owner); var acc={ id:id, owner:owner, bank:bank, name:name, balance:bal };
      data.saveAccount(acc); toast(id? 'Conta atualizada':'Conta criada'); $('account-modal').style.display='none'; renderPeople(); renderAccounts();
    });

    var catForm=$('category-form'); if(catForm) on(catForm,'submit',function(e){ e.preventDefault();
      var id=$('category-id').value||null; var owner=($('category-owner-name').value||'').trim(); var name=($('category-name').value||'').trim(); var type=$('category-type').value;
      if(!owner||!name){ toast('Preencha Pessoa e Nome'); return; }
      data.savePerson(owner); var cat={ id:id, owner:owner, name:name, type:type };
      data.saveCategory(cat); toast(id? 'Categoria atualizada':'Categoria criada'); $('category-modal').style.display='none'; renderPeople(); renderCategories();
    });

    var txForm=$('transaction-form'); if(txForm) on(txForm,'submit',function(e){ e.preventDefault();
      var id=$('transaction-id').value||null; var owner=($('transaction-owner-name').value||'').trim(); var type=$('transaction-type').value; var date=$('transaction-date').value; var description=($('transaction-description').value||'').trim(); var amount=Number($('transaction-amount').value||0); var account_id=$('transaction-account').value||null; var account_id_dst=$('transaction-account-dst').value||null; var category_id=$('transaction-category').value||null;
      if(!owner||!date||!description||!amount||!account_id){ toast('Preencha Pessoa, Data, Descricao, Valor e Conta'); return; }
      data.savePerson(owner);
      if(!id){
        if(type==='income'){ var a=data.getAccounts().find(function(a){ return a.id===account_id; }); if(a) data.updateAccountBalance(a.id, Number(a.balance||0)+amount); }
        else if(type==='expense'){ var b=data.getAccounts().find(function(a){ return a.id===account_id; }); if(b) data.updateAccountBalance(b.id, Number(b.balance||0)-amount); }
        else if(type==='transfer'){
          if(!account_id_dst || account_id_dst===account_id){ toast('Selecione uma conta destino diferente'); return; }
          var o=data.getAccounts().find(function(a){ return a.id===account_id; }); var d=data.getAccounts().find(function(a){ return a.id===account_id_dst; });
          if(!o||!d){ toast('Contas invalidas'); return; }
          data.updateAccountBalance(o.id, Number(o.balance||0)-amount);
          data.updateAccountBalance(d.id, Number(d.balance||0)+amount);
        }
      }
      var tx={ id:id, owner:owner, type:type, date:date, description:description, amount:amount, account_id:account_id, account_id_dst: type==='transfer'? account_id_dst: null, category_id:category_id };
      data.saveTransaction(tx); toast(id? 'Transacao atualizada':'Transacao criada'); $('transaction-modal').style.display='none'; renderPeople(); renderTransactions(); renderAccounts();
    });

    var recForm=$('recurring-form'); if(recForm) on(recForm,'submit',function(e){ e.preventDefault();
      var id=$('recurring-id').value||null; var owner=($('recurring-owner-name').value||'').trim(); var title=($('recurring-title').value||'').trim(); var type=$('recurring-type').value; var amount=Number($('recurring-amount').value||0); var frequency=$('recurring-frequency').value; var next_date=$('recurring-next').value; var account_id=$('recurring-account').value||null; var category_id=$('recurring-category').value||null;
      if(!owner||!title||!amount||!next_date||!account_id){ toast('Preencha Pessoa, Titulo, Valor, Proxima Data e Conta'); return; }
      data.savePerson(owner); var r={ id:id, owner:owner, title:title, type:type, amount:amount, frequency:frequency, next_date:next_date, account_id:account_id, category_id:category_id };
      data.saveRecurring(r); toast(id? 'Recorrencia atualizada':'Recorrencia criada'); $('recurring-modal').style.display='none'; renderPeople(); renderRecurring();
    });
  }

  function init(){
    try{
      wireTabs(); wireModals(); wireButtons(); wireForms();
      renderPeople(); renderPeopleOptions(); renderAccounts(); renderCategories(); renderTransactions(); renderRecurring(); renderDashboard();
    } catch(e){ console.error('Erro ao iniciar app:', e); toast('Erro ao iniciar app'); }
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
