require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

// Configuração da IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// --- BANCO DE DADOS ---
const db = new sqlite3.Database('./financas.db', (err) => {
    if (err) console.error(err.message);
    console.log('Conectado ao banco de dados SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    amount REAL,
    type TEXT,
    category TEXT,
    date TEXT
)`);

// --- ROTAS ---

// 1. Buscar transações
app.get('/api/transactions', (req, res) => {
    db.all("SELECT * FROM transactions ORDER BY date DESC, id DESC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// 2. ROTA DA INTELIGÊNCIA ARTIFICIAL (ESTAVA FALTANDO ISSO!)
app.post('/api/chat', (req, res) => {
    const { question } = req.body;

    // Busca dados para contexto
    db.all("SELECT * FROM transactions", [], async (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro no banco" });

        const income = rows.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = rows.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const balance = income - expense;
        const recent = rows.slice(0, 5).map(t => `${t.date}: ${t.description} (R$ ${t.amount})`).join(", ");

        const prompt = `
            Atue como um consultor financeiro.
            Dados do usuário:
            - Saldo: R$ ${balance.toFixed(2)}
            - Receitas: R$ ${income.toFixed(2)}
            - Despesas: R$ ${expense.toFixed(2)}
            - Últimas movimentações: ${recent}
            
            Pergunta do usuário: "${question}"
            
            Responda de forma curta, amigável e use emojis. Se a pergunta for sobre comprar algo, verifique se o saldo permite.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            res.json({ answer: text });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Erro na IA" });
        }
    });
});

// 3. Criar transação (Com recorrência/parcelas)
app.post('/api/transactions', (req, res) => {
    const { description, amount, type, category, date, isRecurring, recurrenceType, installments } = req.body;
    
    let loops = 1;
    let isInstallment = false;

    if (isRecurring) {
        if (recurrenceType === 'fixed') loops = 12; 
        else if (recurrenceType === 'installments' && installments > 1) {
            loops = parseInt(installments);
            isInstallment = true;
        }
    }

    db.serialize(() => {
        const stmt = db.prepare("INSERT INTO transactions (description, amount, type, category, date) VALUES (?,?,?,?,?)");

        for (let i = 0; i < loops; i++) {
            let baseDate = date ? new Date(date) : new Date();
            baseDate.setMonth(baseDate.getMonth() + i); 
            const dateString = baseDate.toISOString().split('T')[0];

            let finalDescription = description;
            if (isInstallment) finalDescription = `${description} (${i + 1}/${loops})`;

            stmt.run(finalDescription, amount, type, category, dateString);
        }
        
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Sucesso" });
        });
    });
});

// 4. Editar
app.put('/api/transactions/:id', (req, res) => {
    const { description, amount, type, category, date } = req.body;
    const { id } = req.params;
    const sql = `UPDATE transactions SET description = ?, amount = ?, type = ?, category = ?, date = ? WHERE id = ?`;
    db.run(sql, [description, amount, type, category, date, id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Atualizado" });
    });
});

// 5. Deletar
app.delete('/api/transactions/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM transactions WHERE id = ?", id, function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Deletado" });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});