import { SUPABASE_URL, SUPABASE_ANON } from './config.js';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
auth: {
persistSession: true,
autoRefreshToken: true,
detectSessionInUrl: true
}
});
let currentUserId;
let people = [];
let accounts = [];
let categories = [];
let transactions = [];
let recurringRules = [];
let budgets = [];
let debts = [];
let currentOwnerFilter = '';
let currentReportMonth = new Date().toISOString().slice(0, 7);
let currentTransactionStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
let currentTransactionEndDate = new Date().toISOString().slice(0, 10);
let transactionSearchTerm = '';

function showToast(message, duration = 3000) {
const toast = document.getElementById('toast');
toast.textContent = message;
toast.className = 'toast show';
setTimeout(() => {
toast.className = toast.className.replace('show', '');
}, duration);
}

function formatCurrency(amount) {
return new Intl.NumberFormat('pt-IE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateString) {
if (!dateString) return '';
const date = new Date(dateString);
return date.toLocaleDateString('pt-IE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getMonthYear(dateString) {
if (!dateString) return '';
const date = new Date(dateString);
return date.toLocaleDateString('pt-IE', { year: 'numeric', month: 'long' });
}

function getMonthStart(date) {
return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function setupModal(modalId, formId, titleId, saveFunction, loadFunction = null) {
const modal = document.getElementById(modalId);
const form = document.getElementById(formId);
const title = document.getElementById(titleId);
const closeButton = modal.querySelector('.close-button');

closeButton.onclick = () => modal.style.display = 'none';

window.onclick = (event) => {
if (event.target == modal) {
modal.style.display = 'none';
}
};

form.onsubmit = async (e) => {
e.preventDefault();
await saveFunction(e);
modal.style.display = 'none';
};

return {
open: async (item = null) => {
form.reset();
if (loadFunction) await loadFunction(item);
title.textContent = item ? `Editar ${title.textContent.split(' ')[1]}` : `Adicionar ${title.textContent.split(' ')[1]}`;
modal.style.display = 'block';
},
close: () => modal.style.display = 'none'
};
}

async function fetchPeople() {
const { data, error } = await supa.from('people').select('*').eq('user_id', currentUserId);
if (error) {
console.error('Error fetching people:', error.message);
showToast('Erro ao carregar pessoas.');
return [];
}
people = data;
updateOwnerSelectors();
renderPeopleList();
return data;
}

async function fetchAccounts() {
let query = supa.from('accounts').select('*').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
const { data, error } = await query.order('name');
if (error) {
console.error('Error fetching accounts:', error.message);
showToast('Erro ao carregar contas.');
return [];
}
accounts = data;
renderAccounts();
updateAccountSelectors();
return data;
}

async function fetchCategories() {
let query = supa.from('categories').select('*').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
const { data, error } = await query.order('name');
if (error) {
console.error('Error fetching categories:', error.message);
showToast('Erro ao carregar categorias.');
return [];
}
categories = data;
renderCategories();
updateCategorySelectors();
return data;
}

async function fetchTransactions() {
let query = supa.from('transactions').select('*, accounts(name), categories(name)').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
query = query.gte('date', currentTransactionStartDate).lte('date', currentTransactionEndDate);
if (transactionSearchTerm) {
query = query.ilike('description', `%${transactionSearchTerm}%`);
}
const { data, error } = await query.order('date', { ascending: false });
if (error) {
console.error('Error fetching transactions:', error.message);
showToast('Erro ao carregar transações.');
return [];
}
transactions = data;
renderTransactions();
return data;
}

async function fetchRecurringRules() {
let query = supa.from('recurring_rules').select('*, accounts(name), categories(name)').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
const { data, error } = await query.order('title');
if (error) {
console.error('Error fetching recurring rules:', error.message);
showToast('Erro ao carregar recorrências.');
return [];
}
recurringRules = data;
renderRecurringRules();
renderUpcomingRecurring();
return data;
}

async function fetchBudgets() {
const monthStart = getMonthStart(new Date(currentReportMonth));
let query = supa.from('budgets').select('*, categories(name)').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
query = query.eq('month', monthStart.toISOString().slice(0, 10));
const { data, error } = await query;
if (error) {
console.error('Error fetching budgets:', error.message);
showToast('Erro ao carregar orçamentos.');
return [];
}
budgets = data;
renderBudgets();
return data;
}

async function fetchDebts() {
let query = supa.from('debts').select('*').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
const { data, error } = await query.order('due_date');
if (error) {
console.error('Error fetching debts:', error.message);
showToast('Erro ao carregar dívidas.');
return [];
}
debts = data;
renderDebts();
return data;
}

async function fetchDashboardData() {
const monthStart = getMonthStart(new Date());
const monthEnd = getMonthEnd(new Date());

let totalBalanceQuery = supa.from('accounts').select('balance').eq('user_id', currentUserId);
if (currentOwnerFilter) {
totalBalanceQuery = totalBalanceQuery.eq('owner_name', currentOwnerFilter);
}
const { data: balanceData, error: balanceError } = await totalBalanceQuery;
if (!balanceError) {
const totalBalance = balanceData.reduce((sum, account) => sum + parseFloat(account.balance), 0);
document.getElementById('total-balance').textContent = formatCurrency(totalBalance);
}
}

async function loadAllData() {
await fetchPeople();
await fetchAccounts();
await fetchCategories();
await fetchTransactions();
await fetchRecurringRules();
await fetchBudgets();
await fetchDebts();
await fetchDashboardData();
await renderReports();
}

function renderPeopleList() {
const peopleList = document.getElementById('people-list');
peopleList.innerHTML = '';
if (people.length === 0) {
peopleList.innerHTML = '<li>Nenhuma pessoa cadastrada.</li>';
return;
}
people.forEach(person => {
const li = document.createElement('li');
li.className = 'flex justify-between items-center py-1';
li.innerHTML = `
<span>${person.name}</span>
<button class="delete-person-button text-red-500 hover:text-red-700" data-name="${person.name}">Remover</button>
`;
peopleList.appendChild(li);
});
document.querySelectorAll('.delete-person-button').forEach(button => {
button.onclick = (e) => deletePerson(e.target.dataset.name || e.target.closest('button').dataset.name);
});
}

function renderAccounts() {
const tbody = document.getElementById('accounts-table-body');
tbody.innerHTML = '';
if (accounts.length === 0) {
tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Nenhuma conta cadastrada.</td></tr>';
return;
}
accounts.forEach(account => {
const tr = document.createElement('tr');
tr.className = 'border-b';
tr.innerHTML = `<td class="py-2 px-4">${account.owner_name || 'N/A'}</td><td class="py-2 px-4">${account.name}</td><td class="py-2 px-4">${formatCurrency(account.balance)}</td><td class="py-2 px-4"><button class="edit-account-button text-blue-500 hover:text-blue-700 mr-2" data-id="${account.id}">Editar</button><button class="delete-account-button text-red-500 hover:text-red-700" data-id="${account.id}">Remover</button></td>`;
tbody.appendChild(tr);
});
document.querySelectorAll('.edit-account-button').forEach(button => {
button.onclick = (e) => editAccount(e.target.dataset.id || e.target.closest('button').dataset.id);
});
document.querySelectorAll('.delete-account-button').forEach(button => {
button.onclick = (e) => deleteAccount(e.target.dataset.id || e.target.closest('button').dataset.id);
});
}

function renderTransactions() {
const tbody = document.getElementById('transactions-table-body');
tbody.innerHTML = '';
if (transactions.length === 0) {
tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Nenhuma transação cadastrada.</td></tr>';
return;
}
transactions.forEach(transaction => {
const tr = document.createElement('tr');
tr.className = 'border-b';
tr.innerHTML = `<td class="py-2 px-4">${transaction.owner_name || 'N/A'}</td><td class="py-2 px-4">${formatDate(transaction.date)}</td><td class="py-2 px-4">${transaction.description}</td><td class="py-2 px-4">${formatCurrency(transaction.amount)}</td><td class="py-2 px-4">${transaction.accounts?.name || 'N/A'}</td><td class="py-2 px-4">${transaction.categories?.name || 'N/A'}</td><td class="py-2 px-4"><button class="edit-transaction-button text-blue-500 hover:text-blue-700 mr-2" data-id="${transaction.id}">Editar</button><button class="delete-transaction-button text-red-500 hover:text-red-700" data-id="${transaction.id}">Remover</button></td>`;
tbody.appendChild(tr);
});
document.querySelectorAll('.edit-transaction-button').forEach(button => {
button.onclick = (e) => editTransaction(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
document.querySelectorAll('.delete-transaction-button').forEach(button => {
button.onclick = (e) => deleteTransaction(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
}

function updateOwnerSelectors() {
const selectors = document.querySelectorAll('select[id$="-owner-name"], #owner-filter, #csv-owner-name');
selectors.forEach(selector => {
const currentValue = selector.value;
selector.innerHTML = selector.id === 'owner-filter' ? '<option value="">Todas as Pessoas</option>' : '';
people.forEach(person => {
const option = document.createElement('option');
option.value = person.name;
option.textContent = person.name;
selector.appendChild(option);
});
if (currentValue && people.some(p => p.name === currentValue)) {
selector.value = currentValue;
} else if (people.length > 0 && selector.id !== 'owner-filter') {
selector.value = people[0].name;
}
});
}

function updateAccountSelectors() {
const selectors = document.querySelectorAll('select[id$="-account"], #csv-account');
selectors.forEach(selector => {
const currentValue = selector.value;
selector.innerHTML = '';
accounts.forEach(account => {
const option = document.createElement('option');
option.value = String(account.id);
option.textContent = `${account.name} (${account.owner_name || 'N/A'})`;
selector.appendChild(option);
});
if (currentValue && accounts.some(a => String(a.id) === String(currentValue))) {
selector.value = currentValue;
} else if (accounts.length > 0) {
selector.value = String(accounts[0].id);
}
});
}

function updateCategorySelectors() {
const selectors = document.querySelectorAll('select[id$="-category"], #csv-category');
selectors.forEach(selector => {
const currentValue = selector.value;
selector.innerHTML = '';
categories.forEach(category => {
const option = document.createElement('option');
option.value = category.id;
option.textContent = `${category.name} (${category.type === 'income' ? 'Receita' : 'Despesa'}) (${category.owner_name || 'N/A'})`;
selector.appendChild(option);
});
if (currentValue && categories.some(c => c.id === parseInt(currentValue))) {
selector.value = currentValue;
} else if (categories.length > 0) {
selector.value = categories[0].id;
}
});
}

async function addPerson() {
const name = document.getElementById('new-person-name').value.trim();
if (!name) {
showToast('O nome da pessoa não pode ser vazio.');
return;
}
const { error } = await supa.from('people').insert({ name, user_id: currentUserId });
if (error) {
console.error('Error adding person:', error.message);
showToast('Erro ao adicionar pessoa.');
} else {
document.getElementById('new-person-name').value = '';
showToast('Pessoa adicionada com sucesso!');
await fetchPeople();
await loadAllData();
}
}

async function deletePerson(name) {
if (!confirm(`Tem certeza que deseja remover ${name}?`)) return;
const { error } = await supa.from('people').delete().eq('name', name).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting person:', error.message);
showToast('Erro ao remover pessoa.');
} else {
showToast('Pessoa removida com sucesso!');
await fetchPeople();
await loadAllData();
}
}

const accountModal = setupModal('account-modal', 'account-form', 'account-modal-title', saveAccount, loadAccountForm);

async function loadAccountForm(account = null) {
document.getElementById('account-id').value = account ? account.id : '';
document.getElementById('account-name').value = account ? account.name : '';
document.getElementById('account-balance').value = account ? account.balance : '';
document.getElementById('account-owner-name').value = account ? account.owner_name : (people.length > 0 ? people[0].name : '');
}

async function saveAccount(e) {
const id = document.getElementById('account-id').value;
const owner_name = document.getElementById('account-owner-name').value;
const name = document.getElementById('account-name').value;
const balance = parseFloat(document.getElementById('account-balance').value);

const accountData = { owner_name, name, balance, user_id: currentUserId };

if (id) {
const { error } = await supa.from('accounts').update(accountData).eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error updating account:', error.message);
showToast('Erro ao atualizar conta.');
} else {
showToast('Conta atualizada com sucesso!');
}
} else {
const { error } = await supa.from('accounts').insert(accountData);
if (error) {
console.error('Error adding account:', error.message);
showToast('Erro ao adicionar conta.');
} else {
showToast('Conta adicionada com sucesso!');
}
}
await fetchAccounts();
await fetchDashboardData();
}

function editAccount(id) {
const account = accounts.find(a => String(a.id) === String(id));
if (account) accountModal.open(account);
}

async function deleteAccount(id) {
if (!confirm('Tem certeza que deseja remover esta conta?')) return;
const { error } = await supa.from('accounts').delete().eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting account:', error.message);
showToast('Erro ao remover conta.');
} else {
showToast('Conta removida com sucesso!');
await fetchAccounts();
await fetchTransactions();
await fetchDashboardData();
}
}

async function exportTransactionsToCsv() {
let query = supa.from('transactions').select('date, description, amount, owner_name, accounts(name), categories(name)').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
query = query.gte('date', currentTransactionStartDate).lte('date', currentTransactionEndDate);
if (transactionSearchTerm) {
query = query.ilike('description', `%${transactionSearchTerm}%`);
}
const { data, error } = await query.order('date', { ascending: false });

if (error) {
console.error('Error exporting transactions:', error.message);
showToast('Erro ao exportar transações.');
return;
}

if (data.length === 0) {
showToast('Nenhuma transação para exportar.');
return;
}

const flatData = data.map(t => ({
date: t.date,
description: t.description,
amount: t.amount,
owner_name: t.owner_name,
account_name: t.accounts?.name || 'N/A',
category_name: t.categories?.name || 'N/A'
}));

const headers = Object.keys(flatData[0]);
const csvContent = [
headers.join(','),
...flatData.map(row => headers.map(h => `"${row[h]}"`).join(','))
].join('\n');

const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
link.click();
showToast('Transações exportadas com sucesso!');
}

async function renderReports() {
console.log('Reports rendered');
}

async function init() {
const { data: { user } } = await supa.auth.getUser();
if (!user) {
window.location.href = './login';
return;
}
currentUserId = user.id;
await loadAllData();

document.getElementById('add-person-button').onclick = addPerson;
document.getElementById('add-account-button').onclick = () => accountModal.open();
document.getElementById('export-csv-button').onclick = exportTransactionsToCsv;
document.getElementById('logout-button').onclick = async () => {
await supa.auth.signOut();
window.location.href = './login';
};
}

init();
// ===== Transações =====
const transactionModal = setupModal('transaction-modal', 'transaction-form', 'transaction-modal-title', saveTransaction, loadTransactionForm);

async function loadTransactionForm(tx = null) {
  document.getElementById('transaction-id').value = tx ? tx.id : '';
  document.getElementById('transaction-date').value = tx ? tx.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  document.getElementById('transaction-description').value = tx ? tx.description : '';
  document.getElementById('transaction-amount').value = tx ? tx.amount : '';
  document.getElementById('transaction-owner-name').value = tx ? tx.owner_name : (people[0]?.name || '');
  // Account is UUID string
  const accountSelect = document.getElementById('transaction-account');
  const categorySelect = document.getElementById('transaction-category');
  updateAccountSelectors();
  updateCategorySelectors();
  if (tx) {
    accountSelect.value = String(tx.account_id);
    categorySelect.value = String(tx.category_id);
  }
}

async function saveTransaction(e) {
  const id = document.getElementById('transaction-id').value;
  const date = document.getElementById('transaction-date').value;
  const description = document.getElementById('transaction-description').value.trim();
  const amount = parseFloat(document.getElementById('transaction-amount').value);
  const owner_name = document.getElementById('transaction-owner-name').value;
  const account_id = document.getElementById('transaction-account').value; // UUID string
  const category_id = parseInt(document.getElementById('transaction-category').value);

  if (!date || !description || isNaN(amount) || !account_id || !category_id) {
    showToast('Preencha todos os campos da transação.');
    return;
  }

  const txData = { date, description, amount, owner_name, account_id, category_id, user_id: currentUserId };

  if (id) {
    const { error } = await supa.from('transactions').update(txData).eq('id', id).eq('user_id', currentUserId);
    if (error) {
      console.error('Error updating transaction:', error.message);
      showToast('Erro ao atualizar transação.');
    } else {
      showToast('Transação atualizada!');
    }
  } else {
    const { error } = await supa.from('transactions').insert(txData);
    if (error) {
      console.error('Error adding transaction:', error.message);
      showToast('Erro ao adicionar transação.');
    } else {
      showToast('Transação adicionada!');
    }
  }
  await fetchTransactions();
  await fetchAccounts(); // atualizar saldos se você estiver recalculando no backend
  await fetchDashboardData();
}

function editTransaction(id) {
  const tx = transactions.find(t => Number(t.id) === Number(id));
  if (tx) transactionModal.open(tx);
}

async function deleteTransaction(id) {
  if (!confirm('Tem certeza que deseja remover esta transação?')) return;
  const { error } = await supa.from('transactions').delete().eq('id', id).eq('user_id', currentUserId);
  if (error) {
    console.error('Error deleting transaction:', error.message);
    showToast('Erro ao remover transação.');
  } else {
    showToast('Transação removida.');
    await fetchTransactions();
    await fetchAccounts();
    await fetchDashboardData();
  }
}

// ===== Categorias =====
const categoryModal = setupModal('category-modal', 'category-form', 'category-modal-title', saveCategory, loadCategoryForm);

function renderCategories() {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Nenhuma categoria cadastrada.</td></tr>';
    return;
  }
  categories.forEach(cat => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="py-2 px-4">${cat.owner_name || 'N/A'}</td>
      <td class="py-2 px-4">${cat.name}</td>
      <td class="py-2 px-4">${cat.type === 'income' ? 'Receita' : 'Despesa'}</td>
      <td class="py-2 px-4">
        <button class="edit-category-button text-blue-500 hover:text-blue-700 mr-2" data-id="${cat.id}">Editar</button>
        <button class="delete-category-button text-red-500 hover:text-red-700" data-id="${cat.id}">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.edit-category-button').forEach(b => {
    b.onclick = (e) => editCategory(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
  document.querySelectorAll('.delete-category-button').forEach(b => {
    b.onclick = (e) => deleteCategory(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
  updateCategorySelectors();
}

async function loadCategoryForm(cat = null) {
  document.getElementById('category-id').value = cat ? cat.id : '';
  document.getElementById('category-name').value = cat ? cat.name : '';
  document.getElementById('category-type').value = cat ? cat.type : 'expense';
  document.getElementById('category-owner-name').value = cat ? cat.owner_name : (people[0]?.name || '');
}

async function saveCategory() {
  const id = document.getElementById('category-id').value;
  const name = document.getElementById('category-name').value.trim();
  const type = document.getElementById('category-type').value;
  const owner_name = document.getElementById('category-owner-name').value;

  if (!name) {
    showToast('O nome da categoria não pode ser vazio.');
    return;
  }

  const catData = { name, type, owner_name, user_id: currentUserId };

  if (id) {
    const { error } = await supa.from('categories').update(catData).eq('id', id).eq('user_id', currentUserId);
    if (error) {
      console.error('Error updating category:', error.message);
      showToast('Erro ao atualizar categoria.');
    } else {
      showToast('Categoria atualizada!');
    }
  } else {
    const { error } = await supa.from('categories').insert(catData);
    if (error) {
      console.error('Error adding category:', error.message);
      showToast('Erro ao adicionar categoria.');
    } else {
      showToast('Categoria adicionada!');
    }
  }
  await fetchCategories();
}

function editCategory(id) {
  const cat = categories.find(c => Number(c.id) === Number(id));
  if (cat) categoryModal.open(cat);
}

async function deleteCategory(id) {
  if (!confirm('Tem certeza que deseja remover esta categoria?')) return;
  const { error } = await supa.from('categories').delete().eq('id', id).eq('user_id', currentUserId);
  if (error) {
    console.error('Error deleting category:', error.message);
    showToast('Erro ao remover categoria.');
  } else {
    showToast('Categoria removida.');
    await fetchCategories();
  }
}

// ===== Regras Recorrentes =====
const recurringModal = setupModal('recurring-modal', 'recurring-form', 'recurring-modal-title', saveRecurring, loadRecurringForm);

function renderRecurringRules() {
  const tbody = document.getElementById('recurring-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (recurringRules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Nenhuma recorrência cadastrada.</td></tr>';
    return;
  }
  recurringRules.forEach(rr => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="py-2 px-4">${rr.owner_name || 'N/A'}</td>
      <td class="py-2 px-4">${rr.title}</td>
      <td class="py-2 px-4">${rr.frequency}</td>
      <td class="py-2 px-4">${formatCurrency(rr.amount)}</td>
      <td class="py-2 px-4">${rr.accounts?.name || 'N/A'}</td>
      <td class="py-2 px-4">
        <button class="edit-recurring-button text-blue-500 hover:text-blue-700 mr-2" data-id="${rr.id}">Editar</button>
        <button class="delete-recurring-button text-red-500 hover:text-red-700" data-id="${rr.id}">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.edit-recurring-button').forEach(b => {
    b.onclick = (e) => editRecurring(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
  document.querySelectorAll('.delete-recurring-button').forEach(b => {
    b.onclick = (e) => deleteRecurring(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
}

function renderUpcomingRecurring() {
  const list = document.getElementById('upcoming-recurring-list');
  if (!list) return;
  list.innerHTML = '';
  if (recurringRules.length === 0) {
    list.innerHTML = '<li class="py-2">Sem lançamentos previstos.</li>';
    return;
  }
  // Exemplo simples: mostra título e valor
  recurringRules.forEach(rr => {
    const li = document.createElement('li');
    li.className = 'py-2 flex justify-between';
    li.innerHTML = `<span>${rr.title}</span><span>${formatCurrency(rr.amount)}</span>`;
    list.appendChild(li);
  });
}

async function loadRecurringForm(rr = null) {
  document.getElementById('recurring-id').value = rr ? rr.id : '';
  document.getElementById('recurring-title').value = rr ? rr.title : '';
  document.getElementById('recurring-amount').value = rr ? rr.amount : '';
  document.getElementById('recurring-frequency').value = rr ? rr.frequency : 'biweekly';
  document.getElementById('recurring-start-date').value = rr ? rr.start_date?.slice(0, 10) : new Date().toISOString().slice(0, 10);
  document.getElementById('recurring-owner-name').value = rr ? rr.owner_name : (people[0]?.name || '');
  updateAccountSelectors();
  updateCategorySelectors();
  if (rr) {
    document.getElementById('recurring-account').value = String(rr.account_id);
    document.getElementById('recurring-category').value = String(rr.category_id);
  }
}

async function saveRecurring() {
  const id = document.getElementById('recurring-id').value;
  const title = document.getElementById('recurring-title').value.trim();
  const amount = parseFloat(document.getElementById('recurring-amount').value);
  const frequency = document.getElementById('recurring-frequency').value; // 'weekly' | 'biweekly' | 'monthly'
  const start_date = document.getElementById('recurring-start-date').value;
  const owner_name = document.getElementById('recurring-owner-name').value;
  const account_id = document.getElementById('recurring-account').value; // UUID string
  const category_id = parseInt(document.getElementById('recurring-category').value);

  if (!title || isNaN(amount) || !start_date || !account_id || !category_id) {
    showToast('Preencha todos os campos da recorrência.');
    return;
  }

  const rrData = { title, amount, frequency, start_date, owner_name, account_id, category_id, user_id: currentUserId };

  if (id) {
    const { error } = await supa.from('recurring_rules').update(rrData).eq('id', id).eq('user_id', currentUserId);
    if (error) {
      console.error('Error updating recurring:', error.message);
      showToast('Erro ao atualizar recorrência.');
    } else {
      showToast('Recorrência atualizada!');
    }
  } else {
    const { error } = await supa.from('recurring_rules').insert(rrData);
    if (error) {
      console.error('Error adding recurring:', error.message);
      showToast('Erro ao adicionar recorrência.');
    } else {
      showToast('Recorrência adicionada!');
    }
  }
  await fetchRecurringRules();
}

function editRecurring(id) {
  const rr = recurringRules.find(r => Number(r.id) === Number(id));
  if (rr) recurringModal.open(rr);
}

async function deleteRecurring(id) {
  if (!confirm('Tem certeza que deseja remover esta recorrência?')) return;
  const { error } = await supa.from('recurring_rules').delete().eq('id', id).eq('user_id', currentUserId);
  if (error) {
    console.error('Error deleting recurring:', error.message);
    showToast('Erro ao remover recorrência.');
  } else {
    showToast('Recorrência removida.');
    await fetchRecurringRules();
  }
}

// ===== Orçamentos =====
const budgetModal = setupModal('budget-modal', 'budget-form', 'budget-modal-title', saveBudget, loadBudgetForm);

function renderBudgets() {
  const tbody = document.getElementById('budgets-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (budgets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Nenhum orçamento cadastrado.</td></tr>';
    return;
  }
  budgets.forEach(b => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="py-2 px-4">${b.owner_name || 'N/A'}</td>
      <td class="py-2 px-4">${b.categories?.name || 'N/A'}</td>
      <td class="py-2 px-4">${b.month}</td>
      <td class="py-2 px-4">${formatCurrency(b.amount)}</td>
      <td class="py-2 px-4">
        <button class="edit-budget-button text-blue-500 hover:text-blue-700 mr-2" data-id="${b.id}">Editar</button>
        <button class="delete-budget-button text-red-500 hover:text-red-700" data-id="${b.id}">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.edit-budget-button').forEach(b => {
    b.onclick = (e) => editBudget(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
  document.querySelectorAll('.delete-budget-button').forEach(b => {
    b.onclick = (e) => deleteBudget(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
}

async function loadBudgetForm(b = null) {
  document.getElementById('budget-id').value = b ? b.id : '';
  document.getElementById('budget-owner-name').value = b ? b.owner_name : (people[0]?.name || '');
  updateCategorySelectors();
  document.getElementById('budget-category').value = b ? String(b.category_id) : (categories[0]?.id || '');
  document.getElementById('budget-month').value = b ? b.month : new Date().toISOString().slice(0, 7) + '-01';
  document.getElementById('budget-amount').value = b ? b.amount : '';
}

async function saveBudget() {
  const id = document.getElementById('budget-id').value;
  const owner_name = document.getElementById('budget-owner-name').value;
  const category_id = parseInt(document.getElementById('budget-category').value);
  const month = document.getElementById('budget-month').value;
  const amount = parseFloat(document.getElementById('budget-amount').value);

  if (!owner_name || !category_id || !month || isNaN(amount)) {
    showToast('Preencha todos os campos do orçamento.');
    return;
  }

  const bData = { owner_name, category_id, month, amount, user_id: currentUserId };

  if (id) {
    const { error } = await supa.from('budgets').update(bData).eq('id', id).eq('user_id', currentUserId);
    if (error) {
      console.error('Error updating budget:', error.message);
      showToast('Erro ao atualizar orçamento.');
    } else {
      showToast('Orçamento atualizado!');
    }
  } else {
    const { error } = await supa.from('budgets').insert(bData);
    if (error) {
      console.error('Error adding budget:', error.message);
      showToast('Erro ao adicionar orçamento.');
    } else {
      showToast('Orçamento criado!');
    }
  }
  await fetchBudgets();
}

function editBudget(id) {
  const b = budgets.find(x => Number(x.id) === Number(id));
  if (b) budgetModal.open(b);
}

async function deleteBudget(id) {
  if (!confirm('Tem certeza que deseja remover este orçamento?')) return;
  const { error } = await supa.from('budgets').delete().eq('id', id).eq('user_id', currentUserId);
  if (error) {
    console.error('Error deleting budget:', error.message);
    showToast('Erro ao remover orçamento.');
  } else {
    showToast('Orçamento removido.');
    await fetchBudgets();
  }
}

// ===== Dívidas =====
const debtModal = setupModal('debt-modal', 'debt-form', 'debt-modal-title', saveDebt, loadDebtForm);

function renderDebts() {
  const tbody = document.getElementById('debts-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (debts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Nenhuma dívida cadastrada.</td></tr>';
    return;
  }
  debts.forEach(d => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="py-2 px-4">${d.owner_name || 'N/A'}</td>
      <td class="py-2 px-4">${d.creditor}</td>
      <td class="py-2 px-4">${formatCurrency(d.amount)}</td>
      <td class="py-2 px-4">${formatDate(d.due_date)}</td>
      <td class="py-2 px-4">${d.status || 'pendente'}</td>
      <td class="py-2 px-4">
        <button class="edit-debt-button text-blue-500 hover:text-blue-700 mr-2" data-id="${d.id}">Editar</button>
        <button class="delete-debt-button text-red-500 hover:text-red-700" data-id="${d.id}">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.edit-debt-button').forEach(b => {
    b.onclick = (e) => editDebt(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
  document.querySelectorAll('.delete-debt-button').forEach(b => {
    b.onclick = (e) => deleteDebt(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
  });
}

async function loadDebtForm(d = null) {
  document.getElementById('debt-id').value = d ? d.id : '';
  document.getElementById('debt-owner-name').value = d ? d.owner_name : (people[0]?.name || '');
  document.getElementById('debt-creditor').value = d ? d.creditor : '';
  document.getElementById('debt-amount').value = d ? d.amount : '';
  document.getElementById('debt-due-date').value = d ? d.due_date?.slice(0, 10) : new Date().toISOString().slice(0, 10);
  document.getElementById('debt-status').value = d ? (d.status || 'pendente') : 'pendente';
}

async function saveDebt() {
  const id = document.getElementById('debt-id').value;
  const owner_name = document.getElementById('debt-owner-name').value;
  const creditor = document.getElementById('debt-creditor').value.trim();
  const amount = parseFloat(document.getElementById('debt-amount').value);
  const due_date = document.getElementById('debt-due-date').value;
  const status = document.getElementById('debt-status').value;

  if (!owner_name || !creditor || isNaN(amount) || !due_date) {
    showToast('Preencha todos os campos da dívida.');
    return;
  }

  const dData = { owner_name, creditor, amount, due_date, status, user_id: currentUserId };

  if (id) {
    const { error } = await supa.from('debts').update(dData).eq('id', id).eq('user_id', currentUserId);
    if (error) {
      console.error('Error updating debt:', error.message);
      showToast('Erro ao atualizar dívida.');
    } else {
      showToast('Dívida atualizada!');
    }
  } else {
    const { error } = await supa.from('debts').insert(dData);
    if (error) {
      console.error('Error adding debt:', error.message);
      showToast('Erro ao adicionar dívida.');
    } else {
      showToast('Dívida adicionada!');
    }
  }
  await fetchDebts();
}

function editDebt(id) {
  const d = debts.find(x => Number(x.id) === Number(id));
  if (d) debtModal.open(d);
}

async function deleteDebt(id) {
  if (!confirm('Tem certeza que deseja remover esta dívida?')) return;
  const { error } = await supa.from('debts').delete().eq('id', id).eq('user_id', currentUserId);
  if (error) {
    console.error('Error deleting debt:', error.message);
    showToast('Erro ao remover dívida.');
  } else {
    showToast('Dívida removida.');
    await fetchDebts();
  }
}

// ===== Filtros, buscas e eventos globais =====
function wireGlobalEvents() {
  const ownerFilter = document.getElementById('owner-filter');
  if (ownerFilter) {
    ownerFilter.onchange = async (e) => {
      currentOwnerFilter = e.target.value;
      await loadAllData();
    };
  }

  const startInput = document.getElementById('tx-start-date');
  const endInput = document.getElementById('tx-end-date');
  if (startInput && endInput) {
    startInput.onchange = async (e) => {
      currentTransactionStartDate = e.target.value || currentTransactionStartDate;
      await fetchTransactions();
    };
    endInput.onchange = async (e) => {
      currentTransactionEndDate = e.target.value || currentTransactionEndDate;
      await fetchTransactions();
    };
  }

  const searchInput = document.getElementById('tx-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.oninput = (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        transactionSearchTerm = e.target.value.trim();
        await fetchTransactions();
      }, 300);
    };
  }

  const addTxButton = document.getElementById('add-transaction-button');
  if (addTxButton) {
    addTxButton.onclick = () => transactionModal.open();
  }
  const addCategoryButton = document.getElementById('add-category-button');
  if (addCategoryButton) {
    addCategoryButton.onclick = () => categoryModal.open();
  }
  const addRecurringButton = document.getElementById('add-recurring-button');
  if (addRecurringButton) {
    addRecurringButton.onclick = () => recurringModal.open();
  }
  const addBudgetButton = document.getElementById('add-budget-button');
  if (addBudgetButton) {
    addBudgetButton.onclick = () => budgetModal.open();
  }
  const addDebtButton = document.getElementById('add-debt-button');
  if (addDebtButton) {
    addDebtButton.onclick = () => debtModal.open();
  }

  const reportMonthInput = document.getElementById('report-month');
  if (reportMonthInput) {
    reportMonthInput.onchange = async (e) => {
      const val = e.target.value; // formato YYYY-MM
      if (val) currentReportMonth = `${val}-01`;
      await fetchBudgets();
      await renderReports();
    };
  }
}

// Reexecuta o wire após o primeiro load
const originalInit = init;
init = async function() {
  await originalInit();
  wireGlobalEvents();
};
