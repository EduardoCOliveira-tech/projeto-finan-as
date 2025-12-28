import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- COLE SUAS CHAVES DO FIREBASE AQUI ---
const firebaseConfig = {
  apiKey: "AIzaSyBvCAwfj0vGy5n_ufHI63r8hrc07RUnI6Q",
  authDomain: "minhasfinancasapp-6f1ea.firebaseapp.com",
  projectId: "minhasfinancasapp-6f1ea",
  storageBucket: "minhasfinancasapp-6f1ea.firebasestorage.app",
  messagingSenderId: "67958817814",
  appId: "1:67958817814:web:f923b46c834565b54fe137"
};
// ----------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Verificar se já está logado
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "app.html"; // Redireciona para o app
    }
});

// UI Logic
const modal = document.getElementById('auth-modal');
const title = document.getElementById('auth-title');
const btn = document.getElementById('auth-action-btn');
const switchText = document.getElementById('auth-switch-text');
const emailInput = document.getElementById('auth-email');
const passInput = document.getElementById('auth-password');

let isLogin = true;

window.openLogin = () => { isLogin = true; updateUI(); modal.style.display = 'flex'; }
window.openRegister = () => { isLogin = false; updateUI(); modal.style.display = 'flex'; }
window.toggleAuthMode = () => { isLogin = !isLogin; updateUI(); }

function updateUI() {
    title.innerText = isLogin ? "Bem-vindo de volta" : "Criar Conta";
    btn.innerText = isLogin ? "Entrar" : "Cadastrar";
    switchText.innerText = isLogin ? "Não tem conta? Crie agora." : "Já tem conta? Fazer Login.";
}

// Botões da Navbar (precisamos vincular manualmente pois é module)
document.querySelector('.btn-login').onclick = window.openLogin;
document.querySelector('.btn-register').onclick = window.openRegister;

btn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passInput.value;

    if (!email || !password) { alert("Preencha tudo!"); return; }

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
        window.location.href = "app.html"; // Sucesso! Vai para o app
    } catch (error) {
        alert("Erro: " + error.message);
    }
});