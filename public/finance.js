// FinPilot IE - Finance Management (LocalStorage)

// ========== UTILITY FUNCTIONS ==========
function genId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show';
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-PT');
}

// ========== LOCALSTORAGE HELPERS ==========
function getLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function setLS(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ========== MODAL MANAGEMENT ==========
function openModal(modalId, editData) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Reset if form exists
  const form = modal.querySelector('form');
  if (form) form.reset();

  if (modalId === 'account-modal') {
    document.getElementById('account-id').value = editData?.id || '';
    document.getElementById('account-owner-name').value = editData?.owner_name || '';
    document.getElementById('account-name').value = editData?.name || '';
    document.getElementById('account-bank').value = editData?.bank || '';
    document.getElementById('account-balance').value = editData?.balance != null ? String(editData.balance) : '';
    document.getElementById('account-modal-title').textContent = editData ? 'Editar Conta' : 'Nova Conta';
  }

  if (modalId === 'category-modal' && editData) {
    document.getElementById('category-id').value = editData.id || '';
    document.getElementById('category-owner-name').value = editData.owner_name || '';
    document.getElementById('category-name').value = editData.name || '';
    document.getElementById('category-type').value = editData.type || 'expense';
    document.getElementById('category-modal-title').textContent = 'Editar Categoria';
  } else if (modalId === 'category-modal') {
    document.getElementById('category-modal-title').textContent = 'Adicionar Categoria';
  }

  if (modalId === 'transaction-modal' && editData) {
    document.getElementById('transaction-id').value = editData.id || '';
    document.getElementById('transaction-owner-name').value = editData.owner_name || '';
    document.getElementById('transaction-date').value = editData.date || '';
    document.getElementById('transaction-description').value = editData.description || '';
    document.getElementById('transaction-amount').value = editData.amount != null ? String(editData.amount) : '';
    document.getElementById('transaction-account').value = editData.account_id || '';
    document.getElementById('transaction-category').value = editData.category_id || '';
    document.getElementById('transaction-modal-title').textContent = 'Editar Transação';
  } else if (modalId === 'transaction-modal') {
    document.getElementById('transaction-modal-title').textContent = 'Adicionar Transação';
  }

  modal.classList.add('show');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('show');
}

function initModalWiring() {
  // Close buttons and cancel buttons
  document.querySelectorAll('[data-modal]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.getAttribute('data-modal');
      closeModal(target);
    });
  });

  // Click outside to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });

  // ESC to close topmost open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const opened = Array.from(document.querySelectorAll('.modal.show'));
      if (opened.length) {
        const last = opened[opened.length - 1];
        last.classList.remove('show');
      }
    }
  });
}

// ========== PEOPLE MANAGEMENT ==========
function loadPeople() { return getLS('people'); }
function savePerson(name) {
  const people = loadPeople();
  const newPerson = { id: genId(), name: name.trim() };
  people.push(newPerson);
  setLS('people', people);
  return newPerson;
}
function deletePerson(id) {
  const people = loadPeople().filter(p => p.id !== id);
  setLS('people', people);
}
function renderPeopleList() {
  const people = loadPeople();
  const list = document.getElementById('people-list');
  if (!list) return;
  if (!people.length) {
    list.innerHTML = '<li class="text-gray-500">Nenhuma pessoa cadastrada.</li>';
    return;
  }
  list.innerHTML = people.map(p => `
    <li class="flex justify-between items-center py-1">
      <span>${p.name}</span>
      <button class="text-red-500 hover:text-red-700 text-sm" onclick="handleDeletePerson('${p.id}')">Remover</button>
    </li>
  `).join('');
}
function populatePeopleDropdowns() {
  const people = loadPeople();
  const selects = [
    'account-owner-name','transaction-owner-name','category-owner-name',
    'recurring-owner-name','budget-owner-name','debt-owner-name',
    'csv-owner-name','owner-filter'
  ];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    const isFilter = id === 'owner-filter';
    el.innerHTML = isFilter ? '<option value="">Todas as Pessoas</option>' : '';
    people.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      el.appendChild(opt);
    });
    if (current) el.value = current;
  });
}
window.handleDeletePerson = function(id) {
  if (!confirm('Tem certeza que deseja remover esta pessoa?')) return;
  deletePerson(id);
  renderPeopleList();
  populatePeopleDropdowns();
  showToast('Pessoa removida com sucesso!');
};

// ========== ACCOUNTS MANAGEMENT ==========
function loadAccounts() { return getLS('accounts'); }
function saveAccount(account) {
  const accounts = loadAccounts();
  const idx = accounts.findIndex(a => a.id === account.id);
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...account };
  else { account.id = account.id || genId(); accounts.push(account); }
  setLS('accounts', accounts);
  return account;
}
function deleteAccount(id) {
  const accounts = loadAccounts().filter(a => a.id !== id);
  setLS('accounts', accounts);
}
function renderAccounts() {
  const accounts = loadAccounts();
  const container = document.getElementById('accounts-list');
  if (!container) return;
  const filter = document.getElementById('owner-filter')?.value || '';
  const filtered = filter ? accounts.filter(a => a.owner_name === filter) : accounts;
  if (!filtered.length) {
    container.innerHTML = '<p class="text-gray-500">Nenhuma conta cadastrada.</p>';
    return;
  }
  container.innerHTML = filtered.map(acc => `
    <div class="account-item">
      <div class="account-item-info">
        <h4>${acc.name}</h4>
        <p>${acc.bank ? acc.bank + ' • ' : ''}Saldo: ${formatCurrency(acc.balance)}${acc.owner_name ? ' • ' + acc.owner_name : ''}</p>
      </div>
      <div class="account-item-actions">
        <button class="btn btn-secondary btn-sm" onclick="handleEditAccount('${acc.id}')">Editar</button>
        <button class="btn btn-secondary btn-sm" onclick="handleDeleteAccount('${acc.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}
function populateAccountDropdowns() {
  const accounts = loadAccounts();
  ['transaction-account','recurring-account','csv-account'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Selecione uma conta</option>';
    accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = acc.name + (acc.owner_name ? ' (' + acc.owner_name + ')' : '');
      el.appendChild(opt);
    });
    if (current) el.value = current;
  });
}
window.handleEditAccount = function(id) {
  const acc = loadAccounts().find(a => a.id === id);
  if (!acc) return;
  openModal('account-modal', acc);
};
window.handleDeleteAccount = function(id) {
  if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
  deleteAccount(id);
  renderAccounts();
  populateAccountDropdowns();
  showToast('Conta excluída com sucesso!');
};

// ========== CATEGORIES MANAGEMENT ==========
function loadCategories() { return getLS('categories'); }
function saveCategory(category) {
  const categories = loadCategories();
  const idx = categories.findIndex(c => c.id === category.id);
  if (idx >= 0) categories[idx] = { ...categories[idx], ...category };
  else { category.id = category.id || genId(); categories.push(category); }
  setLS('categories', categories);
  return category;
}
function deleteCategory(id) {
  const categories = loadCategories().filter(c => c.id !== id);
  setLS('categories', categories);
}
function renderCategories() {
  const categories = loadCategories();
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;
  const filter = document.getElementById('owner-filter')?.value || '';
  const filtered = filter ? categories.filter(c => c.owner_name === filter) : categories;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhuma categoria cadastrada.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(cat => `
    <tr>
      <td class="py-2 px-4 border-b">${cat.owner_name || '—'}</td>
      <td class="py-2 px-4 border-b">${cat.name}</td>
      <td class="py-2 px-4 border-b">${cat.type === 'income' ? 'Receita' : 'Despesa'}</td>
      <td class="py-2 px-4 border-b">
        <button class="text-blue-500 hover:text-blue-700 mr-2" onclick="handleEditCategory('${cat.id}')">Editar</button>
        <button class="text-red-500 hover:text-red-700" onclick="handleDeleteCategory('${cat.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');
}
function populateCategoryDropdowns() {
  const categories = loadCategories();
  ['transaction-category','recurring-category','budget-category','csv-category'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Selecione uma categoria</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name + ' (' + (cat.type === 'income' ? 'Receita' : 'Despesa') + ')';
      el.appendChild(opt);
    });
    if (current) el.value = current;
  });
}
window.handleEditCategory = function(id) {
  const cat = loadCategories().find(c => c.id === id);
  if (!cat) return;
  openModal('category-modal', cat);
};
window.handleDeleteCategory = function(id) {
  if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
  deleteCategory(id);
  renderCategories();
  populateCategoryDropdowns();
  showToast('Categoria excluída com sucesso!');
};

// ========== TRANSACTIONS MANAGEMENT ==========
function loadTransactions() { return getLS('transactions'); }
function saveTransaction(transaction) {
  const transactions = loadTransactions();
  const idx = transactions.findIndex(t => t.id === transaction.id);
  if (idx >= 0) transactions[idx] = { ...transactions[idx], ...transaction };
  else { transaction.id = transaction.id || genId(); transactions.push(transaction); }
  setLS('transactions', transactions);
  return transaction;
}
function deleteTransaction(id) {
  const transactions = loadTransactions().filter(t => t.id !== id);
  setLS('transactions', transactions);
}
function renderTransactions() {
  const transactions = loadTransactions();
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;
  const filter = document.getElementById('owner-filter')?.value || '';
  const filtered = filter ? transactions.filter(t => t.owner_name === filter) : transactions;
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">Nenhuma transação cadastrada.</td></tr>';
    return;
  }
  const accounts = loadAccounts();
  const categories = loadCategories();
  tbody.innerHTML = filtered.map(tx => {
    const account = accounts.find(a => a.id === tx.account_id);
    const category = categories.find(c => c.id === tx.category_id);
    const amountClass = tx.amount >= 0 ? 'text-green-600' : 'text-red-600';
    return `
      <tr>
        <td class="py-2 px-4 border-b">${tx.owner_name || '—'}</td>
        <td class="py-2 px-4 border-b">${formatDate(tx.date)}</td>
        <td class="py-2 px-4 border-b">${tx.description}</td>
        <td class="py-2 px-4 border-b ${amountClass}">${formatCurrency(tx.amount)}</td>
        <td class="py-2 px-4 border-b">${account ? account.name : '—'}</td>
        <td class="py-2 px-4 border-b">${category ? category.name : '—'}</td>
        <td class="py-2 px-4 border-b">
          <button class="text-blue-500 hover:text-blue-700 mr-2" onclick="handleEditTransaction('${tx.id}')">Editar</button>
          <button class="text-red-500 hover:text-red-700" onclick="handleDeleteTransaction('${tx.id}')">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
}
window.handleEditTransaction = function(id) {
  const tx = loadTransactions().find(t => t.id === id);
  if (!tx) return;
  openModal('transaction-modal', tx);
};
window.handleDeleteTransaction = function(id) {
  if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
  deleteTransaction(id);
  renderTransactions();
  updateDashboard();
  showToast('Transação excluída com sucesso!');
};

// ========== DASHBOARD ==========
function updateDashboard() {
  const transactions = loadTransactions();
  const accounts = loadAccounts();
  const totalBalance = accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
  const tb = document.getElementById('total-balance');
  if (tb) tb.textContent = formatCurrency(totalBalance);

  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  const monthly = transactions.filter(tx => {
    const d = new Date(tx.date);
    return !isNaN(d) && d.getMonth() === m && d.getFullYear() === y;
    });
  const income = monthly.filter(t => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expenses = Math.abs(monthly.filter(t => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0));

  const mi = document.getElementById('monthly-income');
  const me = document.getElementById('monthly-expenses');
  if (mi) mi.textContent = formatCurrency(income);
  if (me) me.textContent = formatCurrency(expenses);
}

// ========== TAB MANAGEMENT ==========
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      button.classList.add('active');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) targetContent.classList.add('active');

      switch (targetTab) {
        case 'dashboard': updateDashboard(); break;
        case 'accounts': renderAccounts(); break;
        case 'transactions': renderTransactions(); break;
        case 'categories': renderCategories(); break;
        case 'settings': renderPeopleList(); break;
      }
    });
  });
}

// ========== FORM HANDLERS ==========
function initForms() {
  // Account
  const accountForm = document.getElementById('account-form');
  if (accountForm) {
    accountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const account = {
        id: document.getElementById('account-id').value || genId(),
        owner_name: document.getElementById('account-owner-name').value,
        name: document.getElementById('account-name').value.trim(),
        bank: document.getElementById('account-bank').value.trim(),
        balance: Number(document.getElementById('account-balance').value) || 0
      };
      if (!account.name) { showToast('Por favor, informe o nome da conta.'); return; }
      saveAccount(account);
      renderAccounts();
      populateAccountDropdowns();
      closeModal('account-modal');
      showToast('Conta salva com sucesso!');
    });
  }

  // Transaction
  const transactionForm = document.getElementById('transaction-form');
  if (transactionForm) {
    transactionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const transaction = {
        id: document.getElementById('transaction-id').value || genId(),
        owner_name: document.getElementById('transaction-owner-name').value,
        date: document.getElementById('transaction-date').value,
        description: document.getElementById('transaction-description').value.trim(),
        amount: Number(document.getElementById('transaction-amount').value) || 0,
        account_id: document.getElementById('transaction-account').value,
        category_id: document.getElementById('transaction-category').value
      };
      if (!transaction.description || !transaction.account_id || !transaction.category_id) {
        showToast('Por favor, preencha todos os campos obrigatórios.');
        return;
      }
      saveTransaction(transaction);
      renderTransactions();
      updateDashboard();
      closeModal('transaction-modal');
      showToast('Transação salva com sucesso!');
    });
  }

  // Category
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const category = {
        id: document.getElementById('category-id').value || genId(),
        owner_name: document.getElementById('category-owner-name').value,
        name: document.getElementById('category-name').value.trim(),
        type: document.getElementById('category-type').value
      };
      if (!category.name) { showToast('Por favor, informe o nome da categoria.'); return; }
      saveCategory(category);
      renderCategories();
      populateCategoryDropdowns();
      closeModal('category-modal');
      showToast('Categoria salva com sucesso!');
    });
  }

  // Add Person
  const addPersonBtn = document.getElementById('add-person-button');
  if (addPersonBtn) {
    addPersonBtn.addEventListener('click', () => {
      const input = document.getElementById('new-person-name');
      const name = input.value.trim();
      if (!name) { showToast('Por favor, informe o nome da pessoa.'); return; }
      savePerson(name);
      renderPeopleList();
      populatePeopleDropdowns();
      input.value = '';
      showToast('Pessoa adicionada com sucesso!');
    });
  }
}

// ========== BUTTON HANDLERS ==========
function initButtons() {
  const addAccountBtn = document.getElementById('add-account-button');
  if (addAccountBtn) addAccountBtn.addEventListener('click', () => openModal('account-modal'));

  const addTransactionBtn = document.getElementById('add-transaction-button');
  if (addTransactionBtn) addTransactionBtn.addEventListener('click', () => openModal('transaction-modal'));

  const addCategoryBtn = document.getElementById('add-category-button');
  if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => openModal('category-modal'));

  const addRecurringBtn = document.getElementById('add-recurring-button');
  if (addRecurringBtn) addRecurringBtn.addEventListener('click', () => openModal('recurring-modal'));

  const addDebtBtn = document.getElementById('add-debt-button');
  if (addDebtBtn) addDebtBtn.addEventListener('click', () => openModal('debt-modal'));

  const addBudgetBtn = document.getElementById('add-budget-button');
  if (addBudgetBtn) addBudgetBtn.addEventListener('click', () => openModal('budget-modal'));

  const importCsvBtn = document.getElementById('import-transactions-button');
  if (importCsvBtn) importCsvBtn.addEventListener('click', () => openModal('import-csv-modal'));

  const exportCsvBtn = document.getElementById('export-transactions-button');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const rows = [['Pessoa','Data','Descrição','Valor','Conta','Categoria']];
      const txs = loadTransactions();
      const accounts = loadAccounts();
      const categories = loadCategories();
      txs.forEach(tx => {
        const acc = accounts.find(a => a.id === tx.account_id);
        const cat = categories.find(c => c.id === tx.category_id);
        rows.push([
          tx.owner_name || '',
          tx.date || '',
          tx.description || '',
          String(tx.amount || 0),
          acc ? acc.name : '',
          cat ? cat.name : ''
        ]);
      });
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transacoes.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('CSV exportado.');
    });
  }

  const ownerFilter = document.getElementById('owner-filter');
  if (ownerFilter) {
    ownerFilter.addEventListener('change', () => {
      renderAccounts();
      renderTransactions();
      renderCategories();
    });
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initModalWiring();
  initForms();
  initButtons();

  // Ensure dropdowns are populated
  populatePeopleDropdowns();
  populateAccountDropdowns();
  populateCategoryDropdowns();

  // Initial renders
  updateDashboard();
  renderAccounts();
  renderTransactions();
  renderCategories();

  // Optional: seed people for quick start (comment if not needed)
  const people = loadPeople();
  if (!people.length) {
    savePerson('Joao');
    savePerson('Maria');
    populatePeopleDropdowns();
    renderPeopleList();
  }
});
