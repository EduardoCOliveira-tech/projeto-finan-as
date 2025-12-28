// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, where, 
    deleteDoc, doc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE (Cole suas chaves aqui) ---
const firebaseConfig = {
  apiKey: "AIzaSyBvCAwfj0vGy5n_ufHI63r8hrc07RUnI6Q",
  authDomain: "minhasfinancasapp-6f1ea.firebaseapp.com",
  projectId: "minhasfinancasapp-6f1ea",
  storageBucket: "minhasfinancasapp-6f1ea.firebasestorage.app",
  messagingSenderId: "67958817814",
  appId: "1:67958817814:web:f923b46c834565b54fe137"
};

// --- INICIALIZAÇÃO ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null; // Usuário logado
let allTransactions = [];
let myChart = null;
let evolutionChart = null;

// --- ELEMENTOS DOM ---
const balanceEl = document.getElementById('balance');
const money_plusEl = document.getElementById('money-plus');
const money_minusEl = document.getElementById('money-minus');
const list = document.getElementById('list');
const form = document.getElementById('form');
const text = document.getElementById('text');
const amount = document.getElementById('amount');
const dateInput = document.getElementById('date');
const typeInput = document.getElementById('type');
const categoryInput = document.getElementById('category');
const recurrenceInput = document.getElementById('recurrence-type');
const monthFilter = document.getElementById('month-filter');
const searchInput = document.getElementById('search-input');
const clearFilterBtn = document.getElementById('clear-filter');
const exportBtn = document.getElementById('export-btn');
const editIdInput = document.getElementById('edit-id');
const themeToggleBtn = document.getElementById('theme-toggle');
const toastContainer = document.getElementById('toast-container');
const budgetInput = document.getElementById('budget-input');
const budgetBar = document.getElementById('budget-bar');
const budgetText = document.getElementById('budget-text');
const budgetPercent = document.getElementById('budget-percent');
const isPaidInput = document.getElementById('is-paid'); 

// Modais
const catModal = document.getElementById('category-modal');
const newCatInput = document.getElementById('new-category-name');

// --- VERIFICAÇÃO DE LOGIN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("Logado: " + user.email);
        initApp(); // Inicia o app apenas se logado
    } else {
        window.location.href = "index.html"; // Manda para a capa se não logar
    }
});

// Botão Sair (Logout) - Adicione isso no HTML se ainda não tiver
const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth));
}

// Config Inicial
dateInput.valueAsDate = new Date();
monthFilter.value = new Date().toISOString().slice(0, 7);

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
}
if (localStorage.getItem('monthlyBudget')) budgetInput.value = localStorage.getItem('monthlyBudget');

// --- FUNÇÃO INICIAL ---
function initApp() {
    loadCategories();
    loadGoals();
    getTransactions();
}

// --- MENUS CUSTOMIZADOS ---
window.toggleSelect = function(idWrapper) {
    document.querySelectorAll('.custom-select-wrapper').forEach(el => {
        if(el.id !== idWrapper) el.querySelector('.options-list').classList.remove('open');
    });
    document.getElementById(idWrapper).querySelector('.options-list').classList.toggle('open');
}

window.selectOption = function(type, value, text) {
    if (type === 'type') { 
        typeInput.value = value; 
        document.getElementById('selected-type-text').innerText = text; 
    } 
    else if (type === 'category') { 
        categoryInput.value = value; 
        document.getElementById('selected-category-text').innerText = text; 
    }
    else if (type === 'recurrence') { 
        recurrenceInput.value = value; 
        document.getElementById('selected-recurrence-text').innerText = text; 
        toggleInstallmentsInput(); 
    }
    else if (type === 'deposit-method') { 
        document.getElementById('deposit-method').value = value; 
        document.getElementById('selected-method-text').innerText = text; 
    }
    document.querySelectorAll('.options-list').forEach(el => el.classList.remove('open'));
}

document.addEventListener('click', (e) => { 
    if (!e.target.closest('.custom-select-wrapper')) 
        document.querySelectorAll('.options-list').forEach(el => el.classList.remove('open')); 
});

// --- CATEGORIAS (FIREBASE) ---
async function loadCategories() {
    try {
        const q = query(collection(db, "categories"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const listContainer = document.getElementById('custom-cat-options');
        listContainer.innerHTML = ''; 

        // Categorias Padrão
        const defaults = ["Alimentação", "Casa", "Transporte", "Lazer", "Saúde", "Contas Fixas", "Salário", "Investimento", "Outros"];
        
        // Adiciona Padrões
        defaults.forEach(name => createCategoryItem(name, listContainer));

        // Adiciona Personalizadas do Banco
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if(!defaults.includes(data.name)) createCategoryItem(data.name, listContainer);
        });

        // Seleciona padrão se vazio
        if (!categoryInput.value) window.selectOption('category', 'Alimentação', 'Alimentação');

    } catch (error) { console.error("Erro categorias:", error); }
}

function createCategoryItem(name, container) {
    const item = document.createElement('div');
    item.className = 'option-item';
    item.innerText = name;
    item.onclick = () => window.selectOption('category', name, name);
    container.appendChild(item);
}

window.openCategoryModal = function() { 
    catModal.classList.remove('hidden'); 
    newCatInput.value = ''; 
    setTimeout(() => newCatInput.focus(), 100); 
}
window.closeCategoryModal = function() { catModal.classList.add('hidden'); }

window.saveNewCategory = async function() {
    const newCat = newCatInput.value.trim();
    if (!newCat) { showToast("Digite um nome!", "error"); return; }
    try {
        await addDoc(collection(db, "categories"), {
            name: newCat,
            uid: currentUser.uid
        });
        showToast("Categoria criada!", "success"); 
        await loadCategories(); 
        window.selectOption('category', newCat, newCat); 
        window.closeCategoryModal();
    } catch (e) { showToast("Erro: " + e.message, "error"); }
}

// --- TRANSAÇÕES (FIREBASE) ---
async function getTransactions() {
    try {
        const q = query(collection(db, "transactions"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        allTransactions = [];
        querySnapshot.forEach((doc) => {
            allTransactions.push({ id: doc.id, ...doc.data() });
        });

        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        filterTransactions();
        updateEvolutionChart(allTransactions); 
    } catch { showToast("Erro ao buscar dados", "error"); }
}

function filterTransactions() {
    const month = monthFilter.value;
    const term = searchInput.value.toLowerCase();
    
    let filtered = allTransactions;
    if (month) filtered = filtered.filter(t => t.date.startsWith(month));
    if (term) filtered = filtered.filter(t => t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term));
    renderScreen(filtered);
}

function renderScreen(transactions) {
    list.innerHTML = '';
    transactions.forEach(addTransactionDOM);
    updateValues(transactions);
    updateChart(transactions); 
    updateTopExpenses(transactions);
}

function addTransactionDOM(t) {
    const sign = t.type === 'expense' ? '-' : '+';
    const item = document.createElement('li');
    item.classList.add(t.type === 'expense' ? 'minus' : 'plus');
    if (!t.paid) item.classList.add('pending');

    const dateFormatted = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
    const valFormatted = Math.abs(t.amount).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    
    // Verifica data futura
    const today = new Date(); today.setHours(0,0,0,0);
    const dateObj = new Date(t.date + 'T00:00:00');
    const isFuture = dateObj > today;

    // ID do Firebase é string, precisa de aspas simples no HTML
    let statusBtn = t.paid 
        ? `<button class="action-btn" onclick="togglePaymentStatus('${t.id}')" title="Desmarcar"><i class="fas fa-check-circle" style="color:var(--success-color);"></i></button>`
        : `<button class="action-btn pay-btn" onclick="togglePaymentStatus('${t.id}')" title="Pagar"><i class="far fa-circle"></i></button>`;

    let advanceBtn = (t.type === 'expense' && isFuture) 
        ? `<button class="action-btn advance-btn" onclick="anticipateTransaction('${t.id}')" title="Adiantar"><i class="fas fa-calendar-check"></i></button>` 
        : '';

    // Convertemos o objeto inteiro para string segura para o onclick
    const tString = JSON.stringify(t).replace(/"/g, '&quot;');

    item.innerHTML = `
        <div class="info">
            <strong>${t.description}</strong>
            <small class="category-tag"><i class="far fa-calendar"></i> ${dateFormatted} • ${t.category} ${!t.paid ? '<span style="color:var(--warning-color); font-weight:bold; margin-left:5px;">(Pendente)</span>' : ''}</small>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
            ${statusBtn}
            <span style="font-weight:600; font-size:14px;">${sign} ${valFormatted}</span>
            <div class="list-actions">
                ${advanceBtn}
                <button class="action-btn edit-btn" onclick='loadEdit(${tString})'><i class="fas fa-pen"></i></button>
                <button class="action-btn delete-btn" onclick="removeTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    list.appendChild(item);
}

// --- AÇÕES (SAVE/DELETE/UPDATE) ---
window.saveTransaction = async function(e) {
    e.preventDefault();
    if (!text.value || !amount.value || !dateInput.value) { showToast('Preencha os dados!', 'error'); return; }

    const isRecurring = document.getElementById('is-recurring').checked;
    const recType = recurrenceInput.value;
    const installments = parseInt(document.getElementById('installments').value);

    const baseData = {
        description: text.value,
        amount: +amount.value,
        type: typeInput.value,
        category: categoryInput.value,
        date: dateInput.value,
        paid: isPaidInput.checked ? 1 : 0,
        uid: currentUser.uid // IMPORTANTE: SALVA O ID DO USUÁRIO
    };

    const id = editIdInput.value;

    try {
        if(id) {
            // EDITAR (Update)
            await updateDoc(doc(db, "transactions", id), baseData);
            showToast("Atualizado!");
            editIdInput.value = ''; document.querySelector('.btn').innerText = "Salvar Transação";
        } else {
            // CRIAR (Create)
            
            // Lógica de Repetição (Client-side Loop)
            let loops = 1;
            if(isRecurring) {
                if(recType === 'fixed') loops = 12;
                else if(recType === 'installments' && installments > 1) loops = installments;
            }

            for (let i = 0; i < loops; i++) {
                let currentData = { ...baseData };
                
                // Calcula Data
                let d = new Date(currentData.date);
                d.setMonth(d.getMonth() + i);
                currentData.date = d.toISOString().split('T')[0];

                // Ajusta Nome se Parcelado
                if (recType === 'installments' && loops > 1) {
                    currentData.description = `${currentData.description} (${i+1}/${loops})`;
                }

                // Regra: Apenas a 1ª parcela herda o "Pago", o resto nasce pendente
                if (i > 0) currentData.paid = 0;

                await addDoc(collection(db, "transactions"), currentData);
            }
            showToast("Adicionado!", "success");
        }

        // Reset
        text.value = ''; amount.value = ''; dateInput.valueAsDate = new Date(); 
        isPaidInput.checked = false; document.getElementById('is-recurring').checked = false; 
        toggleRecurrenceOptions();
        window.selectOption('type', 'expense', 'Despesa (-)');
        
        getTransactions();

    } catch (e) { showToast("Erro: " + e.message, "error"); }
}

window.removeTransaction = async function(id) { 
    if(confirm("Excluir?")) { 
        await deleteDoc(doc(db, "transactions", id)); 
        showToast("Removido", "info"); 
        getTransactions(); 
    } 
}

window.togglePaymentStatus = async function(id) {
    const t = allTransactions.find(x => x.id === id);
    if (!t) return;
    const newStatus = t.paid ? 0 : 1;
    await updateDoc(doc(db, "transactions", id), { paid: newStatus });
    showToast(newStatus ? "Pago!" : "Pendente.", newStatus ? "success" : "info"); 
    getTransactions();
}

window.anticipateTransaction = async function(id) {
    if(!confirm("Adiantar para hoje?")) return;
    const t = allTransactions.find(x => x.id === id);
    const todayStr = new Date().toISOString().split('T')[0];
    let newDesc = t.description.includes('(Pago Ant.)') ? t.description : t.description + " (Pago Ant.)";
    
    await updateDoc(doc(db, "transactions", id), { description: newDesc, date: todayStr, paid: 1 });
    showToast("Adiantado!", "success"); 
    getTransactions();
}

window.loadEdit = function(t) {
    text.value = t.description; 
    amount.value = t.amount; 
    dateInput.value = t.date; 
    editIdInput.value = t.id; 
    isPaidInput.checked = (t.paid === 1);
    
    window.selectOption('type', t.type, t.type === 'expense' ? 'Despesa (-)' : 'Receita (+)');
    window.selectOption('category', t.category, t.category); 
    window.selectOption('recurrence', 'fixed', 'Fixo (Mensal)');
    
    const btn = document.querySelector('.btn'); 
    btn.innerText = "Salvar Alteração"; 
    document.querySelector('.form-section').scrollIntoView({behavior:'smooth'});
}

// --- OBJETIVOS (GOALS) ---
async function loadGoals() { 
    try { 
        const q = query(collection(db, "goals"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const goals = [];
        querySnapshot.forEach((doc) => goals.push({ id: doc.id, ...doc.data() }));
        renderGoals(goals); 
    } catch { console.error("Erro Goals"); } 
}

function renderGoals(goals) {
    const container = document.getElementById('goals-list'); if(!container) return; 
    container.innerHTML = '';
    if (goals.length === 0) { container.innerHTML = '<p style="color:var(--text-secondary); grid-column:1/-1; text-align:center;">Nenhum objetivo ainda.</p>'; return; }
    
    goals.forEach(g => {
        const totalSaved = (g.saved_cash || 0) + (g.saved_bank || 0);
        const percent = Math.min((totalSaved / g.target_amount) * 100, 100);
        const fmt = (v) => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        
        const card = document.createElement('div'); card.className = 'goal-card';
        card.innerHTML = `
            <div class="goal-header"><span class="goal-title">${g.name}</span><span class="goal-target">Meta: ${fmt(g.target_amount)}</span></div>
            <div class="goal-stats"><span>Guardado: <span class="stat-money">${fmt(totalSaved)}</span></span><span>${percent.toFixed(1)}%</span></div>
            <div class="goal-progress-bg"><div class="goal-progress-fill" style="width: ${percent}%"></div></div>
            <div class="goal-breakdown">
                <div class="break-item" title="Banco"><i class="fas fa-university"></i> ${fmt(g.saved_bank || 0)}</div>
                <div class="break-item" title="Físico"><i class="fas fa-money-bill-wave"></i> ${fmt(g.saved_cash || 0)}</div>
            </div>
            <div class="goal-actions">
                <button class="btn-deposit" onclick="openDepositModal('${g.id}', '${g.name}')"><i class="fas fa-piggy-bank"></i> Guardar</button>
                <button class="btn-delete-goal" onclick="deleteGoal('${g.id}')"><i class="fas fa-trash"></i></button>
            </div>`;
        container.appendChild(card);
    });
}

window.openNewGoalModal = function() { document.getElementById('new-goal-modal').classList.remove('hidden'); }
window.closeGoalModals = function() { document.getElementById('new-goal-modal').classList.add('hidden'); document.getElementById('deposit-goal-modal').classList.add('hidden'); }

window.saveNewGoal = async function() {
    const name = document.getElementById('goal-name').value; 
    const target = document.getElementById('goal-target').value;
    if (!name || !target) { showToast("Preencha tudo!", "error"); return; }
    try { 
        await addDoc(collection(db, "goals"), { 
            name, target_amount: +target, saved_cash: 0, saved_bank: 0, uid: currentUser.uid 
        }); 
        showToast("Objetivo criado!", "success"); window.closeGoalModals(); loadGoals(); 
    } catch { showToast("Erro criar", "error"); }
}

window.openDepositModal = function(id, name) { 
    document.getElementById('deposit-goal-id').value = id; 
    document.getElementById('deposit-goal-title').innerText = `Guardar para: ${name}`; 
    document.getElementById('deposit-amount').value = ''; 
    document.getElementById('deposit-goal-modal').classList.remove('hidden'); 
}

window.confirmDeposit = async function() {
    const id = document.getElementById('deposit-goal-id').value; 
    const amount = +document.getElementById('deposit-amount').value; 
    const method = document.getElementById('deposit-method').value;
    
    if (!amount || amount <= 0) { showToast("Valor inválido", "error"); return; }
    
    try { 
        const ref = doc(db, "goals", id);
        // Usa incremento atômico do Firebase
        if (method === 'cash') await updateDoc(ref, { saved_cash: increment(amount) });
        else await updateDoc(ref, { saved_bank: increment(amount) });
        
        showToast("Guardado!", "success"); window.closeGoalModals(); loadGoals(); 
    } catch { showToast("Erro depositar", "error"); }
}

window.deleteGoal = async function(id) { 
    if(confirm("Excluir?")) { await deleteDoc(doc(db, "goals", id)); loadGoals(); } 
}

// --- FUNÇÕES UI / GRÁFICOS (Mantidas iguais, só usam 'allTransactions' que já carregamos) ---
function updateValues(transactions) {
    const paidTransactions = transactions.filter(t => t.paid === 1);
    const amounts = paidTransactions.map(t => t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount));
    const total = amounts.reduce((acc, item) => (acc += item), 0);
    const income = paidTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0);
    const fmt = (v) => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    balanceEl.innerText = fmt(total);
    money_plusEl.innerText = `+ ${fmt(income)}`;
    money_minusEl.innerText = `- ${fmt(Math.abs(expense))}`;
    window.updateBudgetDisplay(Math.abs(expense));
}

window.updateBudget = function() { localStorage.setItem('monthlyBudget', budgetInput.value); filterTransactions(); }
window.updateBudgetDisplay = function(expense) {
    const limit = parseFloat(budgetInput.value);
    if (!limit || limit <= 0) { budgetBar.style.width = '0%'; budgetText.innerText = "Defina uma meta."; return; }
    const pct = (expense / limit) * 100;
    budgetBar.style.width = `${Math.min(pct, 100)}%`; budgetPercent.innerText = `${pct.toFixed(1)}%`;
    const rest = limit - expense;
    if (pct < 70) { budgetBar.style.backgroundColor = '#00b894'; budgetText.innerText = `Resta R$ ${rest.toFixed(2)}`; }
    else if (pct < 100) { budgetBar.style.backgroundColor = '#fdcb6e'; budgetText.innerText = `Resta R$ ${rest.toFixed(2)}`; }
    else { budgetBar.style.backgroundColor = '#ff7675'; budgetText.innerText = `Estourou R$ ${Math.abs(rest).toFixed(2)}`; }
}

window.refreshChartOnly = function() { filterTransactions(); }

function updateChart(transactions) {
    const ctx = document.getElementById('expenseChart'); if(!ctx) return;
    const type = document.querySelector('input[name="chart-type"]:checked').value;
    const data = transactions.filter(t => t.type === type && t.paid === 1); 
    const totals = {}; data.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
    const isDark = document.body.classList.contains('dark-mode');
    const colors = type === 'expense' ? ['#ff7675', '#74b9ff', '#fdcb6e', '#a29bfe', '#dfe6e9', '#636e72'] : ['#00b894', '#55efc4', '#00cec9', '#81ecec'];
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx.getContext('2d'), { type: 'doughnut', data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: colors, borderColor: isDark ? '#2d3436' : '#fff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isDark ? '#dfe6e9' : '#636e72' } } } } });
}

function updateEvolutionChart(transactions) {
    const ctx = document.getElementById('evolutionChart'); if(!ctx) return;
    const months = {}; const currentMonthStr = new Date().toISOString().slice(0, 7);
    transactions.forEach(t => {
        const k = t.date.slice(0, 7); 
        if(!months[k]) months[k] = {inc: 0, exp: 0};
        t.type === 'income' ? months[k].inc += t.amount : months[k].exp += t.amount;
    });
    const keys = Object.keys(months).sort().filter(k => k >= currentMonthStr); 
    const lbls = keys.map(k => `${k.split('-')[1]}/${k.split('-')[0]}`);
    const incs = keys.map(k => months[k].inc); 
    const exps = keys.map(k => months[k].exp);
    if(evolutionChart) evolutionChart.destroy();
    const isDark = document.body.classList.contains('dark-mode');
    evolutionChart = new Chart(ctx.getContext('2d'), { type: 'bar', data: { labels: lbls, datasets: [ { label: 'Receita Prevista', data: incs, backgroundColor: '#00b894', borderRadius: 4 }, { label: 'Despesa Prevista', data: exps, backgroundColor: '#ff7675', borderRadius: 4 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: isDark ? '#dfe6e9' : '#636e72' }, grid: { display: false } }, y: { ticks: { color: isDark ? '#dfe6e9' : '#636e72' }, grid: { color: isDark ? '#444' : '#eee' } } }, plugins: { legend: { labels: { color: isDark ? '#dfe6e9' : '#636e72' } } } } });
}

function updateTopExpenses(transactions) {
    const el = document.getElementById('top-expenses-list');
    const exps = transactions.filter(t => t.type === 'expense' && t.paid === 1);
    const map = {}; exps.forEach(t => map[t.category] = (map[t.category] || 0) + t.amount);
    const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,4);
    el.innerHTML = sorted.length ? sorted.map(([k,v]) => `<li class="top-item"><span class="top-cat">${k}</span><span class="top-val">${v.toLocaleString('pt-BR',{style:'currency', currency:'BRL'})}</span></li>`).join('') : '<li class="top-item" style="justify-content:center; color:#999">Sem dados</li>';
}

function showToast(msg, type) { const d = document.createElement('div'); d.className = `toast ${type}`; d.innerHTML = `<i class="fas fa-${type==='success'?'check':type==='error'?'times':'info'}-circle"></i> ${msg}`; toastContainer.appendChild(d); setTimeout(() => { d.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => d.remove(), 300); }, 3000); }
window.toggleRecurrenceOptions = function() { const chk = document.getElementById('is-recurring'); const div = document.getElementById('recurrence-options'); chk.checked ? div.classList.remove('hidden') : div.classList.add('hidden'); }
window.toggleInstallmentsInput = function() { const type = document.getElementById('recurrence-type').value; const div = document.getElementById('installments-group'); type === 'installments' ? div.classList.remove('hidden') : div.classList.add('hidden'); }

// EVENTS
form.addEventListener('submit', window.saveTransaction); // Note o window.
monthFilter.addEventListener('change', filterTransactions);
searchInput.addEventListener('input', filterTransactions);
clearFilterBtn.addEventListener('click', () => { monthFilter.value = ''; searchInput.value = ''; filterTransactions(); });
exportBtn.addEventListener('click', () => {
    let csv = "data:text/csv;charset=utf-8,ID,Descricao,Valor,Tipo,Categoria,Data,Pago\n";
    allTransactions.forEach(t => csv += `${t.id},"${t.description}",${t.amount},${t.type},${t.category},${t.date},${t.paid?1:0}\n`);
    const a = document.createElement("a"); a.href = encodeURI(csv); a.download = "financas.csv"; a.click();
});
themeToggleBtn.addEventListener('click', () => { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('theme', isDark ? 'dark' : 'light'); themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; refreshChartOnly(); updateEvolutionChart(allTransactions); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { window.closeCategoryModal(); window.closeGoalModals(); }});