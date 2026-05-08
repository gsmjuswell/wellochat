import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJET.firebaseapp.com",
    projectId: "VOTRE_PROJET_ID",
    storageBucket: "VOTRE_PROJET.appspot.com",
    messagingSenderId: "VOTRE_ID",
    appId: "VOTRE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('alpine:init', () => {
    Alpine.data('welloApp', () => ({
        isLoggedIn: false,
        isAdmin: false,
        tab: 'chats',
        phoneInput: '',
        passInput: '',
        dgPhone: '92239333',
        dgCode: 'Juswell',
        groups: [],

        login() {
            if (this.phoneInput === this.dgPhone && this.passInput === this.dgCode) {
                this.isLoggedIn = true;
                this.isAdmin = true;
                this.loadData();
            } else if (this.phoneInput.length >= 8) {
                // Logique pour les collaborateurs
                this.isLoggedIn = true;
                this.isAdmin = false;
                this.loadData();
            } else {
                alert("Identifiants invalides");
            }
        },

        loadData() {
            const q = query(collection(db, "groups"), where("members", "array-contains", this.phoneInput));
            onSnapshot(q, (snapshot) => {
                this.groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            });
        },

        logout() {
            this.isLoggedIn = false;
            this.phoneInput = '';
            this.passInput = '';
        }
    }));
});
