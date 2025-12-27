const balanceEl = document.getElementById('balance');
const money_plusEl = document.getElementById('money-plus');
const money_minusEl = document.getElementById('money-minus');
const list = document.getElementById('list');
const form = document.getElementById('form');
const text = document.getElementById('text');
const amount = document.getElementById('amount');
const dateInput = document.getElementById('date');
const typeEl = document.getElementById('type');
const categoryEl = document.getElementById('category');
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

const API_URL = 'http://localhost:3000/api/transactions';

let allTransactions = [];
let myChart = null;
let evolutionChart = null;

// Config Inicial
dateInput.valueAsDate = new Date();
monthFilter.value = new Date().toISOString().slice(0, 7);

// Load Preferences
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
}
if (localStorage.getItem('monthlyBudget')) {
    budgetInput.value = localStorage.getItem('monthlyBudget');
}

// --- CORE FUNCTIONS ---
async function getTransactions() {
    try {
        const res = await fetch(API_URL);
        allTransactions = await res.json();
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        filterTransactions();
        updateEvolutionChart(allTransactions);
    } catch (err) { showToast("Erro de conexão", "error"); }
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
    const dateFormatted = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
    const valFormatted = Math.abs(t.amount).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    
    item.innerHTML = `
        <div class="info">
            <strong>${t.description}</strong>
            <small class="category-tag"><i class="far fa-calendar"></i> ${dateFormatted} • ${t.category}</small>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
            <span style="font-weight:600; font-size:14px;">${sign} ${valFormatted}</span>
            <div class="list-actions">
                <button class="action-btn edit-btn" onclick='loadEdit(${JSON.stringify(t)})'><i class="fas fa-pen"></i></button>
                <button class="action-btn delete-btn" onclick="removeTransaction(${t.id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
    list.appendChild(item);
}

// --- ATUALIZAR VALORES (SALDO E META) ---
function updateValues(transactions) {
    const amounts = transactions.map(t => t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount));

    const total = amounts.reduce((acc, item) => (acc += item), 0);
    const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
    // CORREÇÃO AQUI: Removemos a multiplicação por -1 aqui para simplificar
    const expense = amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0);

    const formatMoney = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    balanceEl.innerText = formatMoney(total);
    money_plusEl.innerText = `+ ${formatMoney(income)}`;
    
    // CORREÇÃO FINAL: Usamos Math.abs() para garantir que o número venha sem sinal, 
    // já que colocamos o sinal de menos manualmente na string ("- R$...")
    money_minusEl.innerText = `- ${formatMoney(Math.abs(expense))}`;

    // Atualiza a barra de Meta (Orçamento) passando o valor positivo
    updateBudgetDisplay(Math.abs(expense));
}

// --- BUDGET LOGIC ---
function updateBudget() {
    localStorage.setItem('monthlyBudget', budgetInput.value);
    filterTransactions();
}

function updateBudgetDisplay(expense) {
    const limit = parseFloat(budgetInput.value);
    if (!limit || limit <= 0) {
        budgetBar.style.width = '0%';
        budgetText.innerText = "Defina uma meta acima.";
        return;
    }
    const pct = (expense / limit) * 100;
    budgetBar.style.width = `${Math.min(pct, 100)}%`;
    budgetPercent.innerText = `${pct.toFixed(1)}%`;
    const rest = limit - expense;
    
    if (pct < 70) { budgetBar.style.backgroundColor = '#2ecc71'; budgetText.innerText = `Resta R$ ${rest.toFixed(2)}`; }
    else if (pct < 100) { budgetBar.style.backgroundColor = '#f1c40f'; budgetText.innerText = `Atenção! Resta R$ ${rest.toFixed(2)}`; }
    else { budgetBar.style.backgroundColor = '#e74c3c'; budgetText.innerText = `Estourou R$ ${Math.abs(rest).toFixed(2)}`; }
}

// --- CHARTS ---
function refreshChartOnly() { filterTransactions(); }

function updateChart(transactions) {
    const ctx = document.getElementById('expenseChart');
    if(!ctx) return;
    const type = document.querySelector('input[name="chart-type"]:checked').value;
    const data = transactions.filter(t => t.type === type);
    const totals = {};
    data.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
    
    const isDark = document.body.classList.contains('dark-mode');
    const colors = type === 'expense' ? ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#95a5a6', '#34495e'] : ['#2ecc71', '#27ae60', '#1abc9c', '#16a085'];
    
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(totals),
            datasets: [{ data: Object.values(totals), backgroundColor: colors, borderColor: isDark ? '#242526' : '#fff', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isDark ? '#ccc' : '#666' } } } }
    });
}

function updateEvolutionChart(transactions) {
    const ctx = document.getElementById('evolutionChart');
    if(!ctx) return;
    const months = {};
    transactions.forEach(t => {
        const k = t.date.slice(0, 7);
        if(!months[k]) months[k] = {inc: 0, exp: 0};
        t.type === 'income' ? months[k].inc += t.amount : months[k].exp += t.amount;
    });
    const keys = Object.keys(months).sort().slice(-6);
    const lbls = keys.map(k => `${k.split('-')[1]}/${k.split('-')[0]}`);
    const incs = keys.map(k => months[k].inc);
    const exps = keys.map(k => months[k].exp);
    
    if(evolutionChart) evolutionChart.destroy();
    const isDark = document.body.classList.contains('dark-mode');
    
    evolutionChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: lbls,
            datasets: [
                { label: 'Receita', data: incs, backgroundColor: '#2ecc71', borderRadius: 4 },
                { label: 'Despesa', data: exps, backgroundColor: '#e74c3c', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: isDark ? '#ccc' : '#666' }, grid: { display: false } },
                y: { ticks: { color: isDark ? '#ccc' : '#666' }, grid: { color: isDark ? '#444' : '#eee' } }
            },
            plugins: { legend: { labels: { color: isDark ? '#ccc' : '#666' } } }
        }
    });
}

function updateTopExpenses(transactions) {
    const el = document.getElementById('top-expenses-list');
    const exps = transactions.filter(t => t.type === 'expense');
    const map = {};
    exps.forEach(t => map[t.category] = (map[t.category] || 0) + t.amount);
    const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,4);
    
    el.innerHTML = sorted.length ? sorted.map(([k,v]) => `
        <li class="top-item"><span class="top-cat">${k}</span><span class="top-val">${v.toLocaleString('pt-BR',{style:'currency', currency:'BRL'})}</span></li>
    `).join('') : '<li class="top-item" style="justify-content:center; color:#999">Sem dados</li>';
}

// --- CRUD ---
async function saveTransaction(e) {
    e.preventDefault();

    // ADICIONEI A VERIFICAÇÃO DE DATA AQUI
    if (text.value.trim() === '' || amount.value.trim() === '' || dateInput.value === '') {
        showToast('Preencha descrição, valor e data!', 'error');
        return;
    }

    // Captura os dados novos
    const isRecurring = document.getElementById('is-recurring').checked;
    const recurrenceType = document.getElementById('recurrence-type').value;
    const installments = document.getElementById('installments').value;

    const transactionData = {
        description: text.value,
        amount: +amount.value,
        type: typeEl.value,
        category: categoryEl.value,
        date: dateInput.value,
        // Envia os dados novos para o back-end
        isRecurring: isRecurring,
        recurrenceType: recurrenceType,
        installments: installments
    };

    const idToEdit = editIdInput.value;

    try {
        if (idToEdit) {
            // Edição (Não vamos permitir editar recorrência em lote por enquanto para simplificar)
            await fetch(`${API_URL}/${idToEdit}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });
            editIdInput.value = '';
            document.querySelector('.btn').innerText = "Adicionar";
            document.querySelector('.btn').style.backgroundColor = ""; 
            showToast("Atualizado!");
        } else {
            // Criação (O servidor vai lidar com o loop se for parcelado)
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });
            
            let msg = "Transação adicionada!";
            if(isRecurring && recurrenceType === 'installments') msg = "Parcelas geradas com sucesso!";
            showToast(msg);
        }

        // Limpa tudo
        text.value = '';
        amount.value = '';
        dateInput.valueAsDate = new Date();
        document.getElementById('is-recurring').checked = false; // Reseta checkbox
        toggleRecurrenceOptions(); // Esconde área
        getTransactions();

    } catch (error) {
        showToast("Erro ao salvar", "error");
    }
}

async function removeTransaction(id) {
    if(confirm("Excluir?")) {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        showToast("Removido", "info"); getTransactions();
    }
}

window.loadEdit = function(t) {
    text.value = t.description; amount.value = t.amount; typeEl.value = t.type; categoryEl.value = t.category; dateInput.value = t.date; editIdInput.value = t.id;
    const btn = document.querySelector('.btn'); btn.innerText = "Salvar"; btn.style.backgroundColor = "#f39c12";
    document.querySelector('.form-section').scrollIntoView({behavior:'smooth'});
}

function showToast(msg, type) {
    const d = document.createElement('div'); d.className = `toast ${type}`;
    d.innerHTML = `<i class="fas fa-${type==='success'?'check':type==='error'?'times':'info'}-circle"></i> ${msg}`;
    toastContainer.appendChild(d);
    setTimeout(() => { d.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => d.remove(), 300); }, 3000);
}

// --- EVENTS ---
form.addEventListener('submit', saveTransaction);
monthFilter.addEventListener('change', filterTransactions);
searchInput.addEventListener('input', filterTransactions);
clearFilterBtn.addEventListener('click', () => { monthFilter.value = ''; searchInput.value = ''; filterTransactions(); });
exportBtn.addEventListener('click', () => {
    let csv = "data:text/csv;charset=utf-8,ID,Descricao,Valor,Tipo,Categoria,Data\n";
    allTransactions.forEach(t => csv += `${t.id},"${t.description}",${t.amount},${t.type},${t.category},${t.date}\n`);
    const a = document.createElement("a"); a.href = encodeURI(csv); a.download = "financas.csv"; a.click();
});
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    filterTransactions(); updateEvolutionChart(allTransactions);
});

// --- LÓGICA DE UI DA RECORRÊNCIA ---
function toggleRecurrenceOptions() {
    const checkbox = document.getElementById('is-recurring');
    const optionsDiv = document.getElementById('recurrence-options');
    
    if (checkbox.checked) {
        optionsDiv.classList.remove('hidden');
    } else {
        optionsDiv.classList.add('hidden');
    }
}

function toggleInstallmentsInput() {
    const type = document.getElementById('recurrence-type').value;
    const group = document.getElementById('installments-group');
    
    if (type === 'installments') {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
    }
}

// --- LÓGICA DO CHATBOT ---
const chatWidget = document.getElementById('chat-widget');
const chatWindow = document.getElementById('chat-window');
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const closeChatBtn = document.getElementById('close-chat');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const chatMessages = document.getElementById('chat-messages');

// Abrir/Fechar Chat
chatToggleBtn.addEventListener('click', () => chatWindow.classList.remove('hidden'));
closeChatBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));

// Enviar Mensagem
async function sendMessage() {
    const question = chatInput.value.trim();
    if (!question) return;

    // 1. Adiciona mensagem do usuário na tela
    addMessageToChat(question, 'user');
    chatInput.value = '';

    // 2. Mostra "Digitando..."
    const loadingId = addMessageToChat('Analisando suas finanças...', 'bot');

    try {
        // 3. Envia para o Back-end
        const res = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();

        // 4. Remove "Digitando..." e mostra resposta real
        document.getElementById(loadingId).remove();
        addMessageToChat(data.answer || "Desculpe, não consegui analisar agora.", 'bot');
        
    } catch (error) {
        document.getElementById(loadingId).remove();
        addMessageToChat("Erro ao conectar com a IA.", 'bot');
    }
}

function addMessageToChat(text, sender) {
    const div = document.createElement('div');
    div.classList.add('message', sender);
    div.innerText = text; // Usa innerText para segurança básica
    
    // Gera ID único se for loading
    const id = 'msg-' + Date.now();
    div.id = id;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Rola para baixo
    return id;
}

sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// START
getTransactions();