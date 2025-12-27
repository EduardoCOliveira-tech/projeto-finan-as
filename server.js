const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./financas.db', (err) => {
    if (err) console.error("Erro no DB:", err.message);
    else console.log('Banco de dados conectado.');
});

db.serialize(() => {
    // 1. Transações
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT, amount REAL, type TEXT, category TEXT, date TEXT, paid INTEGER DEFAULT 0
    )`);

    // 2. Categorias
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`, (err) => {
        if (!err) {
            const defaults = ["Alimentação", "Casa", "Transporte", "Lazer", "Saúde", "Contas Fixas", "Salário", "Investimento", "Outros"];
            defaults.forEach(cat => db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [cat]));
        }
    });

    // 3. Objetivos (Goals)
    db.run(`CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        target_amount REAL,
        saved_cash REAL DEFAULT 0,
        saved_bank REAL DEFAULT 0
    )`);
});

// --- ROTAS DE CATEGORIAS ---
app.get('/api/categories', (req, res) => { db.all("SELECT * FROM categories ORDER BY name", [], (err, rows) => { res.json(rows); }); });
app.post('/api/categories', (req, res) => { db.run("INSERT INTO categories (name) VALUES (?)", [req.body.name], function(err) { res.json({ id: this.lastID }); }); });

// --- ROTAS DE TRANSAÇÕES ---
app.get('/api/transactions', (req, res) => { db.all("SELECT * FROM transactions ORDER BY date DESC, id DESC", [], (err, rows) => { res.json(rows); }); });
app.post('/api/transactions', (req, res) => {
    const { description, amount, type, category, date, isRecurring, recurrenceType, installments, paid } = req.body;
    let loops = 1; let isInstallment = false;
    if (isRecurring) {
        if (recurrenceType === 'fixed') loops = 12; 
        else if (recurrenceType === 'installments' && installments > 1) { loops = parseInt(installments); isInstallment = true; }
    }
    db.serialize(() => {
        const stmt = db.prepare("INSERT INTO transactions (description, amount, type, category, date, paid) VALUES (?,?,?,?,?,?)");
        for (let i = 0; i < loops; i++) {
            let baseDate = date ? new Date(date) : new Date(); baseDate.setMonth(baseDate.getMonth() + i); 
            const dateString = baseDate.toISOString().split('T')[0];
            let finalDesc = description; if (isInstallment) finalDesc = `${description} (${i + 1}/${loops})`;
            let statusPaid = (i === 0) ? (paid ? 1 : 0) : 0;
            stmt.run(finalDesc, amount, type, category, dateString, statusPaid);
        }
        stmt.finalize((err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ message: "Sucesso" }); });
    });
});
app.put('/api/transactions/:id', (req, res) => {
    const { description, amount, type, category, date, paid } = req.body; const { id } = req.params;
    db.run(`UPDATE transactions SET description=?, amount=?, type=?, category=?, date=?, paid=? WHERE id=?`, 
    [description, amount, type, category, date, paid?1:0, id], function(err) { res.json({ message: "Atualizado" }); });
});
app.delete('/api/transactions/:id', (req, res) => { db.run("DELETE FROM transactions WHERE id = ?", req.params.id, function (err) { res.json({ message: "Deletado" }); }); });

// --- ROTAS DE OBJETIVOS ---
app.get('/api/goals', (req, res) => { db.all("SELECT * FROM goals", [], (err, rows) => { res.json(rows); }); });
app.post('/api/goals', (req, res) => {
    const { name, target } = req.body;
    db.run("INSERT INTO goals (name, target_amount, saved_cash, saved_bank) VALUES (?, ?, 0, 0)", 
    [name, target], function(err) { res.json({ message: "Criado" }); });
});
app.put('/api/goals/:id/deposit', (req, res) => {
    const { id } = req.params; const { amount, method } = req.body;
    let sql = method === 'cash' ? "UPDATE goals SET saved_cash = saved_cash + ? WHERE id = ?" : "UPDATE goals SET saved_bank = saved_bank + ? WHERE id = ?";
    db.run(sql, [amount, id], function(err) { res.json({ message: "Depósito realizado" }); });
});
app.delete('/api/goals/:id', (req, res) => { db.run("DELETE FROM goals WHERE id = ?", req.params.id, function(err) { res.json({ message: "Deletado" }); }); });

app.listen(PORT, () => { console.log(`Servidor rodando em http://localhost:${PORT}`); });