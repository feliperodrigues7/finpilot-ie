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
tr.innerHTML = `<td class="py-2
