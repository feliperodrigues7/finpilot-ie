// FinPilot IE - LocalStorage Edition (safe build, formatted)
(function () {
  'use strict';

  // Utils
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function fmt(n) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
      .format(Number(n || 0));
  }
  function toast(msg) {
    const t = $('toast');
    if (!t) { console.log('[Toast]', msg); return; }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
  function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  // LocalStorage keys
  const DB_KEYS = {
    people: 'fp_people',
    accounts: 'fp_accounts',
    categories: 'fp_categories',
    transactions: 'fp_transactions',
    recurring: 'fp_recurring',
  };

  // Storage wrapper
  const storage = {
    get(key, def = []) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : def;
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      localStorage.setItem(key, JSON.stringify(val));
    },
  };

  // Data API
  const data = {
    // People
    getPeople() { return storage.get(DB_KEYS.people); },
    savePerson(name) {
      name = (name || '').trim();
      if (!name) return null;
      const p = this.getPeople();
      if (!p.includes(name)) {
        p.push(name);
        storage.set(DB_KEYS.people, p);
      }
      return name;
    },
    deletePerson(name) {
      storage.set(DB_KEYS.people, this.getPeople().filter(x => x !== name));
    },

    // Accounts
    getAccounts() { return storage.get(DB_KEYS.accounts); },
    saveAccount(acc) {
      const list = this.getAccounts();
      if (!acc.id) {
        acc.id = uid();
        list.push(acc);
      } else {
        const i = list.findIndex(a => a.id === acc.id);
        if (i > -1) list[i] = acc; else list.push(acc);
      }
      storage.set(DB_KEYS.accounts, list);
      return acc;
    },
    deleteAccount(id) {
      storage.set(DB_KEYS.accounts, this.getAccounts().filter(a => a.id !== id));
    },
    updateAccountBalance(id, balance) {
      const list = this.getAccounts();
      const i = list.findIndex(a => a.id === id);
      if (i > -1) {
        list[i].balance = Number(balance || 0);
        storage.set(DB_KEYS.accounts, list);
        return list[i];
      }
      return null;
    },

    // Categories
    getCategories() { return storage.get(DB_KEYS.categories); },
    saveCategory(cat) {
      const list = this.getCategories();
      if (!cat.id) {
        cat.id = uid();
        list.push(cat);
      } else {
        const i = list.findIndex(c => c.id === cat.id);
        if (i > -1) list[i] = cat; else list.push(cat);
      }
      storage.set(DB_KEYS.categories, list);
      return cat;
    },
    deleteCategory(id) {
      storage.set(DB_KEYS.categories, this.getCategories().filter(c => c.id !== id));
    },

    // Transactions
    getTransactions() { return storage.get(DB_KEYS.transactions); },
    saveTransaction(tx) {
      const list = this.getTransactions();
      if (!tx.id) {
        tx.id = uid();
        list.push(tx);
      } else {
        const i = list.findIndex(t => t.id === tx.id);
        if (i > -1) list[i] = tx; else list.push(tx);
      }
      storage.set(DB_KEYS.transactions, list);
      return tx;
    },
    deleteTransaction(id) {
      storage.set(DB_KEYS.transactions, this.getTransactions().filter(t => t.id !== id));
    },

    // Recurring
    getRecurring() { return storage.get(DB_KEYS.recurring); },
    saveRecurring(r) {
      const list = this.getRecurring();
      if (!r.id) {
        r.id = uid();
        list.push(r);
      } else {
        const i = list.findIndex(x => x.id === r.id);
        if (i > -1) list[i] = r; else list.push(r);
      }
      storage.set(DB_KEYS.recurring, list);
      return r;
    },
    deleteRecurring(id) {
      storage.set(DB_KEYS.recurring, this.getRecurring().filter(r => r.id !== id));
    },
  };

  // Renderers
  function renderPeople() {
    const ul = $('people-list');
    if (!ul) return;
    ul.innerHTML = '';
    data.getPeople().forEach(p => {
      const li = document.createElement('li');
      li.className = 'mb-1 flex items-center justify-between';
      li.innerHTML =
        `<span>${p}</span>
         <button data-name="${p}" class="del-person bg-red-500 text-white px-2 py-1 rounded text-sm">Excluir</button>`;
      ul.appendChild(li);
    });
    ul.querySelectorAll('.del-person').forEach(b => {
      on(b, 'click', () => {
        data.deletePerson(b.getAttribute('data-name'));
        renderPeople();
        renderPeopleOptions();
        toast('Pessoa excluída');
      });
    });
  }

  function renderPeopleOptions() {
    function ensureDatalist(inputId) {
      const input = $(inputId);
      if (!input) return;
      const listId = inputId + '-list';
      let d = document.getElementById(listId);
      if (!d) {
        d = document.createElement('datalist');
        d.id = listId;
        document.body.appendChild(d);
        input.setAttribute('list', listId);
      }
      d.innerHTML = '';
      data.getPeople().forEach(p => {
        const o = document.createElement('option');
        o.value = p;
        d.appendChild(o);
      });
    }
    ['account-owner-name', 'transaction-owner-name', 'category-owner-name', 'recurring-owner-name']
      .forEach(ensureDatalist);
  }

  function renderAccounts() {
    const tb = $('accounts-table-body');
    if (!tb) return;
    tb.innerHTML = '';
    const list = data.getAccounts();
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhuma conta.</td></tr>`;
      return;
    }
    list.forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="py-2 px-3">${a.owner || ''}</td>
         <td class="py-2 px-3">${a.bank || ''}</td>
         <td class="py-2 px-3">${a.name || ''}</td>
         <td class="py-2 px-3">${fmt(a.balance)}</td>
         <td class="py-2 px-3">
           <button class="edit-acc bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${a.id}">Editar</button>
           <button class="del-acc bg-red-500 text-white px-2 py-1 rounded" data-id="${a.id}">Excluir</button>
         </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.edit-acc').forEach(b => on(b, 'click', () => openAccountModal(b.getAttribute('data-id'))));
    tb.querySelectorAll('.del-acc').forEach(b => on(b, 'click', () => {
      data.deleteAccount(b.getAttribute('data-id'));
      renderAccounts();
      renderAccountSelects();
      toast('Conta excluída');
    }));
    renderAccountSelects();
    renderDashboard();
  }

  function renderAccountSelects() {
    const accs = data.getAccounts();
    const s1 = $('transaction-account');
    const s2 = $('transaction-account-dst');
    const sR = $('recurring-account');
    [s1, s2, sR].forEach(s => {
      if (!s) return;
      s.innerHTML = '<option value="">Selecione</option>';
      accs.forEach(a => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = (a.owner ? a.owner + ' - ' : '') + (a.bank ? a.bank + ' / ' : '') + a.name;
        s.appendChild(o);
      });
    });
  }

  function renderCategories() {
    const tb = $('categories-table-body');
    if (!tb) return;
    tb.innerHTML = '';
    const list = data.getCategories();
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhuma categoria.</td></tr>`;
      return;
    }
    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="py-2 px-3">${c.owner || ''}</td>
         <td class="py-2 px-3">${c.name || ''}</td>
         <td class="py-2 px-3">${c.type || ''}</td>
         <td class="py-2 px-3">
           <button class="edit-cat bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${c.id}">Editar</button>
           <button class="del-cat bg-red-500 text-white px-2 py-1 rounded" data-id="${c.id}">Excluir</button>
         </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.edit-cat').forEach(b => on(b, 'click', () => openCategoryModal(b.getAttribute('data-id'))));
    tb.querySelectorAll('.del-cat').forEach(b => on(b, 'click', () => {
      data.deleteCategory(b.getAttribute('data-id'));
      renderCategories();
      toast('Categoria excluída');
    }));
    renderCategorySelects();
  }

  function renderCategorySelects() {
    const cats = data.getCategories();
    const sT = $('transaction-category');
    const sR = $('recurring-category');
    const sB = $('budget-category');
    [sT, sR, sB].forEach(s => {
      if (!s) return;
      s.innerHTML = '<option value="">Selecione</option>';
      cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = (c.owner ? c.owner + ' - ' : '') + c.name + ' (' + c.type + ')';
        s.appendChild(o);
      });
    });
  }

  function renderTransactions() {
    const tb = $('transactions-table-body');
    if (!tb) return;
    tb.innerHTML = '';
    const list = data.getTransactions().slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhuma transação.</td></tr>`;
      return;
    }
    list.forEach(t => {
      const a = data.getAccounts().find(x => x.id === t.account_id);
      const d = data.getAccounts().find(x => x.id === t.account_id_dst);
      const c = data.getCategories().find(x => x.id === t.category_id);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="py-2 px-3">${t.owner || ''}</td>
         <td class="py-2 px-3">${t.type}</td>
         <td class="py-2 px-3">${t.date || ''}</td>
         <td class="py-2 px-3">${t.description || ''}</td>
         <td class="py-2 px-3">${fmt(t.amount)}</td>
         <td class="py-2 px-3">${a ? (a.bank ? a.bank + ' / ' : '') + a.name : ''}</td>
         <td class="py-2 px-3">${d ? (d.bank ? d.bank + ' / ' : '') + d.name : ''}</td>
         <td class="py-2 px-3">${c ? c.name : ''}</td>
         <td class="py-2 px-3">
           <button class="edit-tx bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${t.id}">Editar</button>
           <button class="del-tx bg-red-500 text-white px-2 py-1 rounded" data-id="${t.id}">Excluir</button>
         </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.edit-tx').forEach(b => on(b, 'click', () => openTransactionModal(b.getAttribute('data-id'))));
    tb.querySelectorAll('.del-tx').forEach(b => on(b, 'click', () => {
      deleteTransactionAndAdjust(b.getAttribute('data-id'));
      renderTransactions();
      renderAccounts();
      toast('Transação excluída');
    }));
    renderDashboard();
  }

  function renderRecurring() {
    const tb = $('recurring-table-body');
    if (!tb) return;
    tb.innerHTML = '';
    const list = data.getRecurring();
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhuma recorrência.</td></tr>`;
      return;
    }
    list.forEach(r => {
      const a = data.getAccounts().find(x => x.id === r.account_id);
      const c = data.getCategories().find(x => x.id === r.category_id);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="py-2 px-3">${r.owner || ''}</td>
         <td class="py-2 px-3">${r.title || ''}</td>
         <td class="py-2 px-3">${fmt(r.amount)}</td>
         <td class="py-2 px-3">${r.type}</td>
         <td class="py-2 px-3">${r.frequency}</td>
         <td class="py-2 px-3">${r.next_date || ''}</td>
         <td class="py-2 px-3">${a ? (a.bank ? a.bank + ' / ' : '') + a.name : ''}</td>
         <td class="py-2 px-3">${c ? c.name : ''}</td>
         <td class="py-2 px-3">
           <button class="gen-now bg-blue-600 text-white px-2 py-1 rounded mr-2" data-id="${r.id}">Gerar agora</button>
           <button class="edit-rec bg-yellow-500 text-white px-2 py-1 rounded mr-2" data-id="${r.id}">Editar</button>
           <button class="del-rec bg-red-500 text-white px-2 py-1 rounded" data-id="${r.id}">Excluir</button>
         </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.gen-now').forEach(b => on(b, 'click', () => {
      generateRecurringNow(b.getAttribute('data-id'));
      renderTransactions();
      renderRecurring();
      renderAccounts();
    }));
    tb.querySelectorAll('.edit-rec').forEach(b => on(b, 'click', () => openRecurringModal(b.getAttribute('data-id'))));
    tb.querySelectorAll('.del-rec').forEach(b => on(b, 'click', () => {
      data.deleteRecurring(b.getAttribute('data-id'));
      renderRecurring();
      toast('Recorrência excluída');
    }));
  }

  // Dashboard
  function renderDashboard() {
    const accs = data.getAccounts();
    const txs = data.getTransactions();
    const total = accs.reduce((s, a) => s + Number(a.balance || 0), 0);
    const now = new Date();
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const month = txs.filter(t => (t.date || '').startsWith(ym));
    const inc = month.filter(t => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const exp = month.filter(t => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const tb = $('total-balance');
    const mi = $('monthly-income');
    const me = $('monthly-expenses');
    if (tb) tb.textContent = fmt(total);
    if (mi) mi.textContent = fmt(inc);
    if (me) me.textContent = fmt(exp);
  }

  // Modals open/fill
  function openAccountModal(id) {
    const m = $('account-modal'); if (!m) return;
    m.style.display = 'block';
    const f = $('account-form'); f.reset();
    if (id) {
      const a = data.getAccounts().find(x => x.id === id);
      if (a) {
        $('account-id').value = a.id;
        $('account-owner-name').value = a.owner || '';
        $('account-bank').value = a.bank || '';
        $('account-name').value = a.name || '';
        $('account-balance').value = a.balance || 0;
      }
    }
  }
  function openCategoryModal(id) {
    const m = $('category-modal'); if (!m) return;
    m.style.display = 'block';
    const f = $('category-form'); f.reset();
    if (id) {
      const c = data.getCategories().find(x => x.id === id);
      if (c) {
        $('category-id').value = c.id;
        $('category-owner-name').value = c.owner || '';
        $('category-name').value = c.name || '';
        $('category-type').value = c.type || 'expense';
      }
    }
  }
  function openTransactionModal(id) {
    const m = $('transaction-modal'); if (!m) return;
    m.style.display = 'block';
    const f = $('transaction-form'); f.reset();
    if (id) {
      const t = data.getTransactions().find(x => x.id === id);
      if (t) {
        $('transaction-id').value = t.id;
        $('transaction-owner-name').value = t.owner || '';
        $('transaction-type').value = t.type || 'expense';
        $('transaction-date').value = t.date || '';
        $('transaction-description').value = t.description || '';
        $('transaction-amount').value = t.amount || 0;
        $('transaction-account').value = t.account_id || '';
        $('transaction-account-dst').value = t.account_id_dst || '';
        $('transaction-category').value = t.category_id || '';
      }
    }
  }
  function openRecurringModal(id) {
    const m = $('recurring-modal'); if (!m) return;
    m.style.display = 'block';
    const f = $('recurring-form'); f.reset();
    if (id) {
      const r = data.getRecurring().find(x => x.id === id);
      if (r) {
        $('recurring-id').value = r.id;
        $('recurring-owner-name').value = r.owner || '';
        $('recurring-title').value = r.title || '';
        $('recurring-type').value = r.type || 'expense';
        $('recurring-amount').value = r.amount || 0;
        $('recurring-frequency').value = r.frequency || 'monthly';
        $('recurring-next').value = r.next_date || '';
        $('recurring-account').value = r.account_id || '';
        $('recurring-category').value = r.category_id || '';
      }
    }
  }

  // Tx helpers
  function deleteTransactionAndAdjust(id) {
    const tx = data.getTransactions().find(t => t.id === id);
    if (!tx) { data.deleteTransaction(id); return; }

    if (tx.type === 'income') {
      const a = data.getAccounts().find(x => x.id === tx.account_id);
      if (a) data.updateAccountBalance(a.id, Number(a.balance || 0) - Number(tx.amount || 0));
    } else if (tx.type === 'expense') {
      const b = data.getAccounts().find(x => x.id === tx.account_id);
      if (b) data.updateAccountBalance(b.id, Number(b.balance || 0) + Number(tx.amount || 0));
    } else if (tx.type === 'transfer') {
      const o = data.getAccounts().find(x => x.id === tx.account_id);
      const d = data.getAccounts().find(x => x.id === tx.account_id_dst);
      if (o) data.updateAccountBalance(o.id, Number(o.balance || 0) + Number(tx.amount || 0));
      if (d) data.updateAccountBalance(d.id, Number(d.balance || 0) - Number(tx.amount || 0));
    }
    data.deleteTransaction(id);
  }

  function nextDate(freq, dateStr) {
    const dt = new Date(dateStr);
    if (freq === 'weekly') dt.setDate(dt.getDate() + 7);
    else if (freq === 'biweekly') dt.setDate(dt.getDate() + 14);
    else dt.setMonth(dt.getMonth() + 1);
    return dt.toISOString().slice(0, 10);
  }

  function generateRecurringNow(id) {
    const r = data.getRecurring().find(x => x.id === id);
    if (!r) return;
    const tx = {
      owner: r.owner,
      type: r.type,
      date: r.next_date || new Date().toISOString().slice(0, 10),
      description: r.title,
      amount: Number(r.amount || 0),
      account_id: r.account_id,
      account_id_dst: null,
      category_id: r.category_id,
    };
    if (r.type === 'income') {
      const a = data.getAccounts().find(x => x.id === r.account_id);
      if (a) data.updateAccountBalance(a.id, Number(a.balance || 0) + Number(tx.amount));
    } else if (r.type === 'expense') {
      const b = data.getAccounts().find(x => x.id === r.account_id);
      if (b) data.updateAccountBalance(b.id, Number(b.balance || 0) - Number(tx.amount));
    }
    data.saveTransaction(tx);
    r.next_date = nextDate(r.frequency || 'monthly', tx.date);
    data.saveRecurring(r);
    toast('Transação gerada');
  }

  // Export
  function exportTransactionsCSV() {
    const txs = data.getTransactions();
    const headers = ['id','owner','type','date','description','amount','account_id','account_id_dst','category_id'];
    const rows = [headers.join(',')].concat(
      txs.map(t => headers.map(k => JSON.stringify(t[k] !== undefined ? t[k] : '')).join(','))
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Wiring
  function wireTabs() {
    document.body.addEventListener('click', e => {
      const t = e.target;
      if (!t.classList || !t.classList.contains('tab-button')) return;
      const btns = document.querySelectorAll('.tab-button');
      const tabs = document.querySelectorAll('.tab-content');
      btns.forEach(x => x.classList.remove('active'));
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const el = $(t.getAttribute('data-tab'));
      if (el) el.classList.add('active');
    });
  }

  function wireModals() {
    document.querySelectorAll('.modal').forEach(m => {
      const x = m.querySelector('.close-button');
      if (x) on(x, 'click', () => { m.style.display = 'none'; });
      on(m, 'click', (e) => { if (e.target === m) m.style.display = 'none'; });
      m.querySelectorAll('.cancel-btn').forEach(b => on(b, 'click', () => { m.style.display = 'none'; }));
    });
  }

  function wireButtons() {
    on($('add-account-button'), 'click', () => openAccountModal());
    on($('add-category-button'), 'click', () => openCategoryModal());
    on($('add-transaction-button'), 'click', () => openTransactionModal());
    on($('add-recurring-button'), 'click', () => openRecurringModal());
    on($('export-transactions-button'), 'click', exportTransactionsCSV);
    on($('logout-button'), 'click', () => toast('Sessão encerrada (modo local)'));
  }

  function wireForms() {
    // Account
    const f1 = $('account-form');
    if (f1) on(f1, 'submit', (e) => {
      e.preventDefault();
      const id = $('account-id').value || null;
      const owner = ($('account-owner-name').value || '').trim();
      const bank = ($('account-bank').value || '').trim();
      const name = ($('account-name').value || '').trim();
      const bal = Number($('account-balance').value || 0);
      if (!owner || !name) { toast('Preencha Pessoa e Nome da Conta'); return; }
      data.savePerson(owner);
      const acc = { id, owner, bank, name, balance: bal };
      data.saveAccount(acc);
      toast(id ? 'Conta atualizada' : 'Conta criada');
      $('account-modal').style.display = 'none';
      renderPeople(); renderAccounts();
    });

    // Category
    const f2 = $('category-form');
    if (f2) on(f2, 'submit', (e) => {
      e.preventDefault();
      const id = $('category-id').value || null;
      const owner = ($('category-owner-name').value || '').trim();
      const name = ($('category-name').value || '').trim();
      const type = $('category-type').value;
      if (!owner || !name) { toast('Preencha Pessoa e Nome'); return; }
      data.savePerson(owner);
      const cat = { id, owner, name, type };
      data.saveCategory(cat);
      toast(id ? 'Categoria atualizada' : 'Categoria criada');
      $('category-modal').style.display = 'none';
      renderPeople(); renderCategories();
    });

    // Transaction
    const f3 = $('transaction-form');
    if (f3) on(f3, 'submit', (e) => {
      e.preventDefault();
      const id = $('transaction-id').value || null;
      const owner = ($('transaction-owner-name').value || '').trim();
      const type = $('transaction-type').value;
      const date = $('transaction-date').value;
      const description = ($('transaction-description').value || '').trim();
      const amount = Number($('transaction-amount').value || 0);
      const account_id = $('transaction-account').value || null;
      const account_id_dst = $('transaction-account-dst').value || null;
      const category_id = $('transaction-category').value || null;

      if (!owner || !date || !description || !amount || !account_id) {
        toast('Preencha Pessoa, Data, Descrição, Valor e Conta');
        return;
      }
      data.savePerson(owner);

      if (!id) {
        if (type === 'income') {
          const a = data.getAccounts().find(x => x.id === account_id);
          if (a) data.updateAccountBalance(a.id, Number(a.balance || 0) + amount);
        } else if (type === 'expense') {
          const b = data.getAccounts().find(x => x.id === account_id);
          if (b) data.updateAccountBalance(b.id, Number(b.balance || 0) - amount);
        } else if (type === 'transfer') {
          if (!account_id_dst || account_id_dst === account_id) {
            toast('Selecione uma conta destino diferente'); return;
          }
          const o = data.getAccounts().find(x => x.id === account_id);
          const d = data.getAccounts().find(x => x.id === account_id_dst);
          if (!o || !d) { toast('Contas inválidas'); return; }
          data.updateAccountBalance(o.id, Number(o.balance || 0) - amount);
          data.updateAccountBalance(d.id, Number(d.balance || 0) + amount);
        }
      }

      const tx = {
        id, owner, type, date, description, amount,
        account_id,
        account_id_dst: type === 'transfer' ? account_id_dst : null,
        category_id
      };
      data.saveTransaction(tx);
      toast(id ? 'Transação atualizada' : 'Transação criada');
      $('transaction-modal').style.display = 'none';
      renderPeople(); renderTransactions(); renderAccounts();
    });

    // Recurring
    const f4 = $('recurring-form');
    if (f4) on(f4, 'submit', (e) => {
      e.preventDefault();
      const id = $('recurring-id').value || null;
      const owner = ($('recurring-owner-name').value || '').trim();
      const title = ($('recurring-title').value || '').trim();
      const type = $('recurring-type').value;
      const amount = Number($('recurring-amount').value || 0);
      const frequency = $('recurring-frequency').value;
      const next_date = $('recurring-next').value;
      const account_id = $('recurring-account').value || null;
      const category_id = $('recurring-category').value || null;

      if (!owner || !title || !amount || !next_date || !account_id) {
        toast('Preencha Pessoa, Título, Valor, Próxima Data e Conta');
        return;
      }
      data.savePerson(owner);
      const r = { id, owner, title, type, amount, frequency, next_date, account_id, category_id };
      data.saveRecurring(r);
      toast(id ? 'Recorrência atualizada' : 'Recorrência criada');
      $('recurring-modal').style.display = 'none';
      renderPeople(); renderRecurring();
    });
  }

  // Init
  function init() {
    try {
      wireTabs();
      wireModals();
      wireButtons();
      wireForms();
      renderPeople();
      renderPeopleOptions();
      renderAccounts();
      renderCategories();
      renderTransactions();
      renderRecurring();
      renderDashboard();
      console.log('FinPilot IE up');
    } catch (e) {
      console.error('Erro ao iniciar app:', e);
      toast('Erro ao iniciar app');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
