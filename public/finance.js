import { SUPABASE_URL, SUPABASE_ANON } from './config.js';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
auth: {
persistSession: true, // Manter sessão ativa
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
let currentOwnerFilter = ''; // Global filter for owner_name
let currentReportMonth = new Date().toISOString().slice(0, 7); // YYYY-MM for reports
let currentTransactionStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
let currentTransactionEndDate = new Date().toISOString().slice(0, 10);
let transactionSearchTerm = '';

// --- Utility Functions ---
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

// --- Modals Handling ---
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

// --- Data Fetching & Rendering ---
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
const monthEnd = getMonthEnd(new Date(currentReportMonth));
let query = supa.from('budgets').select('*, categories(name)').eq('user_id', currentUserId);
if (currentOwnerFilter) {
query = query.eq('owner_name', currentOwnerFilter);
}
query = query.eq('month', monthStart.toISOString().slice(0, 10)); // Filter by month start
const { data, error } = await query.order('categories.name');
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

let monthlyIncomeQuery = supa.from('transactions').select('amount').eq('user_id', currentUserId).eq('categories.type', 'income');
let monthlyExpensesQuery = supa.from('transactions').select('amount').eq('user_id', currentUserId).eq('categories.type', 'expense');
if (currentOwnerFilter) {
monthlyIncomeQuery = monthlyIncomeQuery.eq('owner_name', currentOwnerFilter);
monthlyExpensesQuery = monthlyExpensesQuery.eq('owner_name', currentOwnerFilter);
}
monthlyIncomeQuery = monthlyIncomeQuery.gte('date', monthStart.toISOString().slice(0, 10)).lte('date', monthEnd.toISOString().slice(0, 10));
monthlyExpensesQuery = monthlyExpensesQuery.gte('date', monthStart.toISOString().slice(0, 10)).lte('date', monthEnd.toISOString().slice(0, 10));

const { data: incomeData, error: incomeError } = await monthlyIncomeQuery;
if (!incomeError) {
const totalIncome = incomeData.reduce((sum, t) => sum + parseFloat(t.amount), 0);
document.getElementById('monthly-income').textContent = formatCurrency(totalIncome);
}

const { data: expenseData, error: expenseError } = await monthlyExpensesQuery;
if (!expenseError) {
const totalExpenses = expenseData.reduce((sum, t) => sum + parseFloat(t.amount), 0);
document.getElementById('monthly-expenses').textContent = formatCurrency(totalExpenses);
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

// --- Render Functions ---
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

function renderCategories() {
const tbody = document.getElementById('categories-table-body');
tbody.innerHTML = '';
if (categories.length === 0) {
tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Nenhuma categoria cadastrada.</td></tr>';
return;
}
categories.forEach(category => {
const tr = document.createElement('tr');
tr.className = 'border-b';
tr.innerHTML = `<td class="py-2 px-4">${category.owner_name || 'N/A'}</td><td class="py-2 px-4">${category.name}</td><td class="py-2 px-4">${category.type === 'income' ? 'Receita' : 'Despesa'}</td><td class="py-2 px-4"><button class="edit-category-button text-blue-500 hover:text-blue-700 mr-2" data-id="${category.id}">Editar</button><button class="delete-category-button text-red-500 hover:text-red-700" data-id="${category.id}">Remover</button></td>`;
tbody.appendChild(tr);
});
document.querySelectorAll('.edit-category-button').forEach(button => {
button.onclick = (e) => editCategory(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
document.querySelectorAll('.delete-category-button').forEach(button => {
button.onclick = (e) => deleteCategory(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
}

function renderRecurringRules() {
const tbody = document.getElementById('recurring-table-body');
tbody.innerHTML = '';
if (recurringRules.length === 0) {
tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Nenhuma recorrência cadastrada.</td></tr>';
return;
}
recurringRules.forEach(rule => {
const nextRun = calculateNextRunDate(rule);
const tr = document.createElement('tr');
tr.className = 'border-b';
tr.innerHTML = `<td class="py-2 px-4">${rule.owner_name || 'N/A'}</td><td class="py-2 px-4">${rule.title}</td><td class="py-2 px-4">${formatCurrency(rule.amount)}</td><td class="py-2 px-4">${rule.frequency === 'weekly' ? 'Semanal' : rule.frequency === 'biweekly' ? 'Quinzenal' : 'Mensal'}</td><td class="py-2 px-4">${nextRun ? formatDate(nextRun) : 'N/A'}</td><td class="py-2 px-4"><button class="edit-recurring-button text-blue-500 hover:text-blue-700 mr-2" data-id="${rule.id}">Editar</button><button class="delete-recurring-button text-red-500 hover:text-red-700" data-id="${rule.id}">Remover</button></td>`;
tbody.appendChild(tr);
});
document.querySelectorAll('.edit-recurring-button').forEach(button => {
button.onclick = (e) => editRecurringRule(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
document.querySelectorAll('.delete-recurring-button').forEach(button => {
button.onclick = (e) => deleteRecurringRule(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
}

function renderUpcomingRecurring() {
const list = document.getElementById('upcoming-recurring-list');
list.innerHTML = '';
const today = new Date();
const upcoming = recurringRules
.map(rule => ({ rule, nextRun: calculateNextRunDate(rule, today) }))
.filter(item => item.nextRun && new Date(item.nextRun) >= today)
.sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun))
.slice(0, 5); // Show next 5

if (upcoming.length === 0) {
list.innerHTML = '<p class="text-gray-500">Nenhuma recorrência futura.</p>';
return;
}

upcoming.forEach(item => {
const div = document.createElement('div');
div.className = 'flex justify-between items-center bg-gray-50 p-2 rounded';
div.innerHTML = `
<span>${item.rule.title} (${item.rule.owner_name || 'N/A'})</span>
<span class="text-sm text-gray-600">${formatCurrency(item.rule.amount)} em ${formatDate(item.nextRun)}</span>
`;
list.appendChild(div);
});
}

function renderBudgets() {
const budgetsList = document.getElementById('budgets-list');
budgetsList.innerHTML = '';
if (budgets.length === 0) {
budgetsList.innerHTML = '<p class="text-gray-500">Nenhum orçamento definido para este mês.</p>';
return;
}

const currentMonthTransactions = transactions.filter(t => {
const tDate = new Date(t.date);
const budgetMonthDate = new Date(currentReportMonth);
return tDate.getFullYear() === budgetMonthDate.getFullYear() && tDate.getMonth() === budgetMonthDate.getMonth();
});

budgets.forEach(budget => {
const spent = currentMonthTransactions
.filter(t => t.category_id === budget.category_id && t.owner_name === budget.owner_name && t.categories.type === 'expense')
.reduce((sum, t) => sum + parseFloat(t.amount), 0);
const percentage = (spent / parseFloat(budget.amount)) * 100;
const progressBarColor = percentage > 100 ? 'bg-red-500' : 'bg-blue-500';

const div = document.createElement('div');
div.className = 'bg-white p-4 rounded-lg shadow';
div.innerHTML = `
<div class="flex justify-between items-center mb-2">
<h3 class="font-semibold">${budget.categories.name} (${budget.owner_name || 'N/A'})</h3>
<div>
<button class="edit-budget-button text-blue-500 hover:text-blue-700 text-sm mr-2" data-id="${budget.id}">Editar</button>
<button class="delete-budget-button text-red-500 hover:text-red-700 text-sm" data-id="${budget.id}">Remover</button>
</div>
</div>
<p class="text-sm text-gray-600 mb-2">${formatCurrency(spent)} / ${formatCurrency(budget.amount)}</p>
<div class="w-full bg-gray-200 rounded-full h-2.5">
<div class="${progressBarColor} h-2.5 rounded-full" style="width: ${Math.min(percentage, 100)}%"></div>
</div>
`;
budgetsList.appendChild(div);
});

document.querySelectorAll('.edit-budget-button').forEach(button => {
button.onclick = (e) => editBudget(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
document.querySelectorAll('.delete-budget-button').forEach(button => {
button.onclick = (e) => deleteBudget(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
}

function renderDebts() {
const tbody = document.getElementById('debts-table-body');
tbody.innerHTML = '';
if (debts.length === 0) {
tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Nenhuma dívida cadastrada.</td></tr>';
return;
}
debts.forEach(debt => {
const tr = document.createElement('tr');
tr.className = 'border-b';
tr.innerHTML = `<td class="py-2 px-4">${debt.owner_name || 'N/A'}</td><td class="py-2 px-4">${debt.name}</td><td class="py-2 px-4">${formatCurrency(debt.original_amount)}</td><td class="py-2 px-4">${formatCurrency(debt.current_amount)}</td><td class="py-2 px-4">${(debt.interest_rate * 100).toFixed(2)}% (${debt.interest_type === 'simple' ? 'Simples' : 'Composto'})</td><td class="py-2 px-4">${formatCurrency(calculateEstimatedMonthlyInterest(debt))}</td><td class="py-2 px-4">${debt.due_date ? formatDate(debt.due_date) : 'N/A'}</td><td class="py-2 px-4">${debt.is_closed ? 'Fechada' : 'Aberta'}</td><td class="py-2 px-4"><button class="edit-debt-button text-blue-500 hover:text-blue-700 mr-2" data-id="${debt.id}">Editar</button><button class="delete-debt-button text-red-500 hover:text-red-700" data-id="${debt.id}">Remover</button></td>`;
tbody.appendChild(tr);
});
document.querySelectorAll('.edit-debt-button').forEach(button => {
button.onclick = (e) => editDebt(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
document.querySelectorAll('.delete-debt-button').forEach(button => {
button.onclick = (e) => deleteDebt(parseInt(e.target.dataset.id || e.target.closest('button').dataset.id));
});
}

// --- Selector Updates ---
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
selector.value = people[0].name; // Default to first person for forms
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
option.value = String(account.id); // UUID string
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

function updateMonthFilters() {
const monthFilters = document.querySelectorAll('#budget-month-filter, #report-month-filter');
monthFilters.forEach(filter => {
filter.innerHTML = '';
const today = new Date();
for (let i = 0; i < 12; i++) { // Last 12 months
const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
const value = date.toISOString().slice(0, 7);
const text = getMonthYear(date);
const option = document.createElement('option');
option.value = value;
option.textContent = text;
filter.appendChild(option);
}
filter.value = currentReportMonth;
});
}

// --- CRUD Operations (People) ---
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
await loadAllData(); // Reload all data to update filters/selectors
}
}

async function deletePerson(name) {
if (!confirm(`Tem certeza que deseja remover ${name}? Todas as contas, transações, etc. associadas a esta pessoa serão afetadas.`)) return;
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

// --- CRUD Operations (Accounts) ---
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
if (!confirm('Tem certeza que deseja remover esta conta? Todas as transações associadas serão afetadas.')) return;
const { error } = await supa.from('accounts').delete().eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting account:', error.message);
showToast('Erro ao remover conta.');
} else {
showToast('Conta removida com sucesso!');
await fetchAccounts();
await fetchTransactions(); // Transactions might be affected
await fetchDashboardData();
}
}

// --- CRUD Operations (Transactions) ---
const transactionModal = setupModal('transaction-modal', 'transaction-form', 'transaction-modal-title', saveTransaction, loadTransactionForm);

async function loadTransactionForm(transaction = null) {
document.getElementById('transaction-id').value = transaction ? transaction.id : '';
document.getElementById('transaction-date').value = transaction ? transaction.date : new Date().toISOString().slice(0, 10);
document.getElementById('transaction-description').value = transaction ? transaction.description : '';
document.getElementById('transaction-amount').value = transaction ? transaction.amount : '';
document.getElementById('transaction-owner-name').value = transaction ? transaction.owner_name : (people.length > 0 ? people[0].name : '');
document.getElementById('transaction-account').value = transaction ? String(transaction.account_id) : (accounts.length > 0 ? String(accounts[0].id) : '');
document.getElementById('transaction-category').value = transaction ? transaction.category_id : (categories.length > 0 ? categories[0].id : '');
}

async function saveTransaction(e) {
const id = document.getElementById('transaction-id').value;
const owner_name = document.getElementById('transaction-owner-name').value;
const date = document.getElementById('transaction-date').value;
const description = document.getElementById('transaction-description').value;
const amount = parseFloat(document.getElementById('transaction-amount').value);
const account_id = document.getElementById('transaction-account').value; // UUID string
const category_id = parseInt(document.getElementById('transaction-category').value);

const transactionData = { owner_name, date, description, amount, account_id, category_id, user_id: currentUserId };

if (id) {
const oldTransaction = transactions.find(t => t.id === parseInt(id));
const { error } = await supa.from('transactions').update(transactionData).eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error updating transaction:', error.message);
showToast('Erro ao atualizar transação.');
} else {
// Update account balance
if (oldTransaction) {
const oldAccount = accounts.find(a => String(a.id) === String(oldTransaction.account_id));
if (oldAccount) {
await supa.from('accounts').update({ balance: parseFloat(oldAccount.balance) - parseFloat(oldTransaction.amount) }).eq('id', oldAccount.id);
}
}
const newAccount = accounts.find(a => String(a.id) === String(account_id));
if (newAccount) {
await supa.from('accounts').update({ balance: parseFloat(newAccount.balance) + amount }).eq('id', newAccount.id);
}
showToast('Transação atualizada com sucesso!');
}
} else {
const { error } = await supa.from('transactions').insert(transactionData);
if (error) {
console.error('Error adding transaction:', error.message);
showToast('Erro ao adicionar transação.');
} else {
// Update account balance
const account = accounts.find(a => String(a.id) === String(account_id));
if (account) {
await supa.from('accounts').update({ balance: parseFloat(account.balance) + amount }).eq('id', account_id);
}
showToast('Transação adicionada com sucesso!');
}
}
await fetchTransactions();
await fetchAccounts(); // To update balances
await fetchDashboardData();
await renderReports();
}

function editTransaction(id) {
const transaction = transactions.find(t => t.id === id);
if (transaction) transactionModal.open(transaction);
}

async function deleteTransaction(id) {
if (!confirm('Tem certeza que deseja remover esta transação?')) return;
const transaction = transactions.find(t => t.id === id);
if (!transaction) return;

const { error } = await supa.from('transactions').delete().eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting transaction:', error.message);
showToast('Erro ao remover transação.');
} else {
// Update account balance
const account = accounts.find(a => String(a.id) === String(transaction.account_id));
if (account) {
await supa.from('accounts').update({ balance: parseFloat(account.balance) - parseFloat(transaction.amount) }).eq('id', account.id);
}
showToast('Transação removida com sucesso!');
await fetchTransactions();
await fetchAccounts(); // To update balances
await fetchDashboardData();
await renderReports();
}
}

// --- CRUD Operations (Categories) ---
const categoryModal = setupModal('category-modal', 'category-form', 'category-modal-title', saveCategory, loadCategoryForm);

async function loadCategoryForm(category = null) {
document.getElementById('category-id').value = category ? category.id : '';
document.getElementById('category-name').value = category ? category.name : '';
document.getElementById('category-type').value = category ? category.type : 'expense';
document.getElementById('category-owner-name').value = category ? category.owner_name : (people.length > 0 ? people[0].name : '');
}

async function saveCategory(e) {
const id = document.getElementById('category-id').value;
const owner_name = document.getElementById('category-owner-name').value;
const name = document.getElementById('category-name').value;
const type = document.getElementById('category-type').value;

const categoryData = { owner_name, name, type, user_id: currentUserId };

if (id) {
const { error } = await supa.from('categories').update(categoryData).eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error updating category:', error.message);
showToast('Erro ao atualizar categoria.');
} else {
showToast('Categoria atualizada com sucesso!');
}
} else {
const { error } = await supa.from('categories').insert(categoryData);
if (error) {
console.error('Error adding category:', error.message);
showToast('Erro ao adicionar categoria.');
} else {
showToast('Categoria adicionada com sucesso!');
}
}
await fetchCategories();
await fetchTransactions(); // Categories might be affected
await fetchRecurringRules(); // Recurring rules might be affected
await fetchBudgets(); // Budgets might be affected
}

function editCategory(id) {
const category = categories.find(c => c.id === id);
if (category) categoryModal.open(category);
}

async function deleteCategory(id) {
if (!confirm('Tem certeza que deseja remover esta categoria?')) return;
const { error } = await supa.from('categories').delete().eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting category:', error.message);
showToast('Erro ao remover categoria.');
} else {
showToast('Categoria removida com sucesso!');
await fetchCategories();
await fetchTransactions();
await fetchRecurringRules();
await fetchBudgets();
}
}

// --- CRUD Operations (Recurring Rules) ---
const recurringModal = setupModal('recurring-modal', 'recurring-form', 'recurring-modal-title', saveRecurringRule, loadRecurringRuleForm);

function renderRecurringScheduleOptions(frequency, schedule = {}) {
const container = document.getElementById('recurring-schedule-options');
container.innerHTML = '';

if (frequency === 'weekly') {
const label = document.createElement('label');
label.className = 'block text-gray-700 text-sm font-bold mb-2';
label.textContent = 'Dia da Semana:';
const select = document.createElement('select');
select.id = 'recurring-weekday';
select.className = 'shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
weekdays.forEach((day, index) => {
const option = document.createElement('option');
option.value = index;
option.textContent = day;
select.appendChild(option);
});
select.value = schedule.weekday !== undefined ? schedule.weekday : new Date().getDay();
container.appendChild(label);
container.appendChild(select);
} else if (frequency === 'monthly') {
const label = document.createElement('label');
label.className = 'block text-gray-700 text-sm font-bold mb-2';
label.textContent = 'Dia do Mês:';
const input = document.createElement('input');
input.type = 'number';
input.id = 'recurring-day-of-month';
input.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
input.min = '1';
input.max = '31';
input.value = schedule.day_of_month !== undefined ? schedule.day_of_month : new Date().getDate();
container.appendChild(label);
container.appendChild(input);
}
// Biweekly "every 14 days" uses start_date, no extra schedule options needed here.
}

async function loadRecurringRuleForm(rule = null) {
document.getElementById('recurring-id').value = rule ? rule.id : '';
document.getElementById('recurring-owner-name').value = rule ? rule.owner_name : (people.length > 0 ? people[0].name : '');
document.getElementById('recurring-title').value = rule ? rule.title : '';
document.getElementById('recurring-amount').value = rule ? rule.amount : '';
document.getElementById('recurring-type').value = rule ? rule.type : 'expense';
document.getElementById('recurring-account').value = rule ? String(rule.account_id) : (accounts.length > 0 ? String(accounts[0].id) : '');
document.getElementById('recurring-category').value = rule ? rule.category_id : (categories.length > 0 ? categories[0].id : '');
document.getElementById('recurring-frequency').value = rule ? rule.frequency : 'monthly';
document.getElementById('recurring-start-date').value = rule ? rule.start_date : new Date().toISOString().slice(0, 10);
document.getElementById('recurring-end-date').value = rule && rule.end_date ? rule.end_date : '';
document.getElementById('recurring-hourly-rate').value = rule && rule.options && rule.options.hourly_rate ? rule.options.hourly_rate : '';
document.getElementById('recurring-hours-per-week').value = rule && rule.options && rule.options.hours_per_week ? rule.options.hours_per_week : '';

renderRecurringScheduleOptions(document.getElementById('recurring-frequency').value, rule ? rule.schedule : {});

document.getElementById('recurring-frequency').onchange = (e) => {
renderRecurringScheduleOptions(e.target.value);
};
}

async function saveRecurringRule(e) {
const id = document.getElementById('recurring-id').value;
const owner_name = document.getElementById('recurring-owner-name').value;
const title = document.getElementById('recurring-title').value;
const amount = parseFloat(document.getElementById('recurring-amount').value);
const type = document.getElementById('recurring-type').value;
const account_id = document.getElementById('recurring-account').value; // UUID string
const category_id = parseInt(document.getElementById('recurring-category').value);
const frequency = document.getElementById('recurring-frequency').value;
const start_date = document.getElementById('recurring-start-date').value;
const end_date = document.getElementById('recurring-end-date').value || null;
const hourly_rate = parseFloat(document.getElementById('recurring-hourly-rate').value) || null;
const hours_per_week = parseFloat(document.getElementById('recurring-hours-per-week').value) || null;

let schedule = {};
if (frequency === 'weekly') {
schedule.weekday = parseInt(document.getElementById('recurring-weekday').value);
} else if (frequency === 'monthly') {
schedule.day_of_month = parseInt(document.getElementById('recurring-day-of-month').value);
}
// Biweekly schedule is implicitly handled by start_date

let options = {};
if (hourly_rate && hours_per_week && frequency === 'weekly') {
options = { hourly_rate, hours_per_week };
}

const ruleData = {
owner_name, title, amount, type, account_id, category_id, frequency,
schedule, start_date, end_date, options, user_id: currentUserId
};

if (id) {
const { error } = await supa.from('recurring_rules').update(ruleData).eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error updating recurring rule:', error.message);
showToast('Erro ao atualizar recorrência.');
} else {
showToast('Recorrência atualizada com sucesso!');
}
} else {
const { error } = await supa.from('recurring_rules').insert(ruleData);
if (error) {
console.error('Error adding recurring rule:', error.message);
showToast('Erro ao adicionar recorrência.');
} else {
showToast('Recorrência adicionada com sucesso!');
}
}
await fetchRecurringRules();
}

function editRecurringRule(id) {
const rule = recurringRules.find(r => r.id === id);
if (rule) recurringModal.open(rule);
}

async function deleteRecurringRule(id) {
if (!confirm('Tem certeza que deseja remover esta recorrência?')) return;
const { error } = await supa.from('recurring_rules').delete().eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting recurring rule:', error.message);
showToast('Erro ao remover recorrência.');
} else {
showToast('Recorrência removida com sucesso!');
await fetchRecurringRules();
}
}

// --- Recurring Rule Logic ---
function calculateNextRunDate(rule, fromDate = new Date()) {
const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()); // Normalize to start of day
const startDate = new Date(rule.start_date);
if (rule.end_date && new Date(rule.end_date) < today) return null;

let nextRun = null;

if (rule.frequency === 'weekly') {
const targetWeekday = rule.schedule.weekday; // 0 for Sunday, 6 for Saturday
let current = new Date(startDate);
while (current < today || current.getDay() !== targetWeekday) {
current.setDate(current.getDate() + 1);
}
nextRun = current;
} else if (rule.frequency === 'biweekly') {
// Calculate days since start_date
const diffTime = Math.abs(today.getTime() - startDate.getTime());
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
let daysToAdd = 0;
if (diffDays % 14 !== 0) {
daysToAdd = 14 - (diffDays % 14);
}
nextRun = new Date(today);
nextRun.setDate(nextRun.getDate() + daysToAdd);

// Ensure it's not before start_date if today is before start_date
if (nextRun < startDate && today < startDate) {
nextRun = new Date(startDate);
}

// If nextRun is still before today, add 14 days until it's in the future
while (nextRun < today) {
nextRun.setDate(nextRun.getDate() + 14);
}
} else if (rule.frequency === 'monthly') {
const targetDayOfMonth = rule.schedule.day_of_month;
let current = new Date(today.getFullYear(), today.getMonth(), targetDayOfMonth);
if (current < today) {
current.setMonth(current.getMonth() + 1);
}
// Handle month end (e.g., Feb 30 -> Feb 28)
if (current.getDate() !== targetDayOfMonth) {
current = new Date(current.getFullYear(), current.getMonth() + 1, 0); // Last day of previous month
}
nextRun = current;
}

if (nextRun && rule.end_date && nextRun > new Date(rule.end_date)) return null;
return nextRun;
}

async function runRecurringRules() {
if (!confirm('Deseja lançar as recorrências previstas para o mês atual?')) return;

const today = new Date();
const monthStart = getMonthStart(today);
const monthEnd = getMonthEnd(today);
let launchedCount = 0;

for (const rule of recurringRules) {
let nextRun = calculateNextRunDate(rule, rule.last_run_date ? new Date(rule.last_run_date) : new Date(rule.start_date));

while (nextRun && nextRun >= monthStart && nextRun <= monthEnd && (!rule.last_run_date || nextRun > new Date(rule.last_run_date))) {
const amountToUse = (rule.options && rule.options.hourly_rate && rule.options.hours_per_week && rule.frequency === 'weekly')
? rule.options.hourly_rate * rule.options.hours_per_week
: rule.amount;

const transactionData = {
owner_name: rule.owner_name,
date: nextRun.toISOString().slice(0, 10),
description: `Recorrência: ${rule.title}`,
amount: amountToUse,
account_id: rule.account_id,
category_id: rule.category_id,
is_recurring: true,
user_id: currentUserId
};

const { error: transactionError } = await supa.from('transactions').insert(transactionData);
if (transactionError) {
console.error('Error inserting recurring transaction:', transactionError.message);
showToast(`Erro ao lançar recorrência ${rule.title}.`);
break; // Stop processing this rule if an error occurs
} else {
// Update account balance
const account = accounts.find(a => String(a.id) === String(rule.account_id));
if (account) {
await supa.from('accounts').update({ balance: parseFloat(account.balance) + amountToUse }).eq('id', account.id);
}
launchedCount++;
}

// Update last_run_date for the rule
await supa.from('recurring_rules').update({ last_run_date: nextRun.toISOString().slice(0, 10) }).eq('id', rule.id);

// Calculate next run for the *same* rule, starting from the just-launched date
nextRun = calculateNextRunDate(rule, nextRun);
}
}

if (launchedCount > 0) {
showToast(`${launchedCount} recorrência(s) lançada(s) com sucesso!`);
await loadAllData();
} else {
showToast('Nenhuma recorrência para lançar neste mês.');
}
}

// --- CRUD Operations (Budgets) ---
const budgetModal = setupModal('budget-modal', 'budget-form', 'budget-modal-title', saveBudget, loadBudgetForm);

async function loadBudgetForm(budget = null) {
document.getElementById('budget-id').value = budget ? budget.id : '';
document.getElementById('budget-owner-name').value = budget ? budget.owner_name : (people.length > 0 ? people[0].name : '');
document.getElementById('budget-month').value = budget ? budget.month.slice(0, 7) : currentReportMonth;
document.getElementById('budget-category').value = budget ? budget.category_id : (categories.length > 0 ? categories[0].id : '');
document.getElementById('budget-amount').value = budget ? budget.amount : '';
}

async function saveBudget(e) {
const id = document.getElementById('budget-id').value;
const owner_name = document.getElementById('budget-owner-name').value;
const month = document.getElementById('budget-month').value + '-01'; // Convert YYYY-MM to YYYY-MM-01
const category_id = parseInt(document.getElementById('budget-category').value);
const amount = parseFloat(document.getElementById('budget-amount').value);

const budgetData = { owner_name, month, category_id, amount, user_id: currentUserId };

if (id) {
const { error } = await supa.from('budgets').update(budgetData).eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error updating budget:', error.message);
showToast('Erro ao atualizar orçamento.');
} else {
showToast('Orçamento atualizado com sucesso!');
}
} else {
const { error } = await supa.from('budgets').insert(budgetData);
if (error) {
console.error('Error adding budget:', error.message);
showToast('Erro ao adicionar orçamento.');
} else {
showToast('Orçamento adicionado com sucesso!');
}
}
await fetchBudgets();
await renderReports();
}

function editBudget(id) {
const budget = budgets.find(b => b.id === id);
if (budget) budgetModal.open(budget);
}

async function deleteBudget(id) {
if (!confirm('Tem certeza que deseja remover este orçamento?')) return;
const { error } = await supa.from('budgets').delete().eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting budget:', error.message);
showToast('Erro ao remover orçamento.');
} else {
showToast('Orçamento removido com sucesso!');
await fetchBudgets();
await renderReports();
}
}

// --- CRUD Operations (Debts) ---
const debtModal = setupModal('debt-modal', 'debt-form', 'debt-modal-title', saveDebt, loadDebtForm);

function calculateEstimatedMonthlyInterest(debt) {
if (debt.is_closed || !debt.interest_rate || debt.interest_rate === 0) return 0;
const annualRate = parseFloat(debt.interest_rate);
const currentAmount = parseFloat(debt.current_amount);

if (debt.interest_type === 'simple') {
return currentAmount * (annualRate / 12);
} else if (debt.interest_type === 'compound') {
// Monthly compound rate
const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
return currentAmount * monthlyRate;
}
return 0;
}

async function loadDebtForm(debt = null) {
document.getElementById('debt-id').value = debt ? debt.id : '';
document.getElementById('debt-owner-name').value = debt ? debt.owner_name : (people.length > 0 ? people[0].name : '');
document.getElementById('debt-name').value = debt ? debt.name : '';
document.getElementById('debt-original-amount').value = debt ? debt.original_amount : '';
document.getElementById('debt-current-amount').value = debt ? debt.current_amount : '';
document.getElementById('debt-interest-rate').value = debt ? (debt.interest_rate * 100).toFixed(2) : ''; // Display as percentage
document.getElementById('debt-interest-type').value = debt ? debt.interest_type : 'simple';
document.getElementById('debt-due-date').value = debt ? debt.due_date : '';
document.getElementById('debt-is-closed').checked = debt ? debt.is_closed : false;
}

async function saveDebt(e) {
const id = document.getElementById('debt-id').value;
const owner_name = document.getElementById('debt-owner-name').value;
const name = document.getElementById('debt-name').value;
const original_amount = parseFloat(document.getElementById('debt-original-amount').value);
const current_amount = parseFloat(document.getElementById('debt-current-amount').value);
const interest_rate = parseFloat(document.getElementById('debt-interest-rate').value) / 100 || 0; // Convert percentage to decimal
const interest_type = document.getElementById('debt-interest-type').value;
const due_date = document.getElementById('debt-due-date').value || null;
const is_closed = document.getElementById('debt-is-closed').checked;

const debtData = {
owner_name, name, original_amount, current_amount, interest_rate,
interest_type, due_date, is_closed, user_id: currentUserId
};

if (id) {
const { error } = await supa.from('debts').update(debtData).eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error updating debt:', error.message);
showToast('Erro ao atualizar dívida.');
} else {
showToast('Dívida atualizada com sucesso!');
}
} else {
const { error } = await supa.from('debts').insert(debtData);
if (error) {
console.error('Error adding debt:', error.message);
showToast('Erro ao adicionar dívida.');
} else {
showToast('Dívida adicionada com sucesso!');
}
}
await fetchDebts();
}

function editDebt(id) {
const debt = debts.find(d => d.id === id);
if (debt) debtModal.open(debt);
}

async function deleteDebt(id) {
if (!confirm('Tem certeza que deseja remover esta dívida?')) return;
const { error } = await supa.from('debts').delete().eq('id', id).eq('user_id', currentUserId);
if (error) {
console.error('Error deleting debt:', error.message);
showToast('Erro ao remover dívida.');
} else {
showToast('Dívida removida com sucesso!');
await fetchDebts();
}
}

// --- CSV Import/Export ---
const importCsvModal = setupModal('import-csv-modal', 'import-csv-form', 'import-csv-modal-title', importTransactionsFromCsv, loadImportCsvForm);

async function loadImportCsvForm() {
// Populate owner, account, category selectors
updateOwnerSelectors();
updateAccountSelectors();
updateCategorySelectors();
// Clear dynamic column mapping
document.getElementById('csv-column-mapping').innerHTML = '';
document.getElementById('csv-file').value = '';
}

async function importTransactionsFromCsv(e) {
const fileInput = document.getElementById('csv-file');
const ownerName = document.getElementById('csv-owner-name').value;
const accountId = document.getElementById('csv-account').value; // UUID string
const categoryId = parseInt(document.getElementById('csv-category').value);
const file = fileInput.files[0];

if (!file) {
showToast('Por favor, selecione um arquivo CSV.');
return;
}

const reader = new FileReader();
reader.onload = async (event) => {
const csvContent = event.target.result;
const lines = csvContent.split('\n').filter(line => line.trim() !== '');

if (lines.length === 0) {
showToast('Arquivo CSV vazio.');
return;
}

const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
const mapping = {};
document.querySelectorAll('#csv-column-mapping select').forEach(select => {
mapping[select.dataset.field] = select.value;
});

const transactionsToInsert = [];
for (let i = 1; i < lines.length; i++) {
const values = lines[i].split(',').map(v => v.trim());
if (values.length !== headers.length) continue; // Skip malformed lines

const transaction = {
owner_name: ownerName,
account_id: accountId,
category_id: categoryId,
user_id: currentUserId
};

for (const field in mapping) {
const colIndex = headers.indexOf(mapping[field]);
if (colIndex !== -1) {
let value = values[colIndex];
if (field === 'amount') {
value = parseFloat(value.replace(',', '.')); // Handle comma as decimal separator
} else if (field === 'date') {
// Basic date parsing, assumes YYYY-MM-DD or DD/MM/YYYY
if (value.includes('/')) {
const parts = value.split('/');
value = `${parts[2]}-${parts[1]}-${parts[0]}`;
}
}
transaction[field] = value;
}
}

if (transaction.date && transaction.description && transaction.amount !== undefined) {
transactionsToInsert.push(transaction);
}
}

if (transactionsToInsert.length === 0) {
showToast('Nenhuma transação válida encontrada no CSV.');
return;
}

const { error } = await supa.from('transactions').insert(transactionsToInsert);
if (error) {
console.error('Error importing transactions:', error.message);
showToast('Erro ao importar transações.');
} else {
showToast(`${transactionsToInsert.length} transações importadas com sucesso!`);
await fetchTransactions();
await fetchAccounts(); // Update balances
await fetchDashboardData();
await renderReports();
importCsvModal.close();
}
};
reader.readAsText(file);
}

function generateCsvHeaders(data) {
if (data.length === 0) return '';
const headers = Object.keys(data[0]).filter(key => !['user_id', 'id', 'created_at'].includes(key));
return headers.join(',');
}

function generateCsvRow(item, headers) {
return headers.map(header => {
let value = item[header];
if (typeof value === 'object' && value !== null) {
// Handle nested objects like accounts.name
if (header.includes('.')) {
const [parent, child] = header.split('.');
value = item[parent] ? item[parent][child] : '';
} else {
value = JSON.stringify(value); // Fallback for other objects
}
}
return `"${String(value).replace(/"/g, '""')}"`; // Escape quotes and wrap in quotes
}).join(',');
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

if
