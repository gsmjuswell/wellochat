import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURATION FIREBASE
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJECT.firebaseapp.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT.appspot.com",
    messagingSenderId: "VOTRE_ID",
    appId: "VOTRE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('alpine:init', () => {
    Alpine.data('welloApp', () => ({
        isLoggedIn: false,
        isAdmin: false,
        phoneInput: '',
        passInput: '',
        dgPhone: '92239333',
        dgCode: 'Juswell',
        groups: [],
        activeChat: null,

        async login() {
            if (this.phoneInput === this.dgPhone && this.passInput === this.dgCode) {
                this.isLoggedIn = true;
                this.isAdmin = true;
                this.loadGroups();
            } else {
                alert("Identifiants incorrects");
            }
        },

        loadGroups() {
            // Écoute en temps réel des groupes où l'utilisateur est membre
            const q = query(collection(db, "groups"), where("members", "array-contains", this.phoneInput));
            onSnapshot(q, (snapshot) => {
                this.groups = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            });
        },

        logout() {
            this.isLoggedIn = false;
            this.isAdmin = false;
            this.phoneInput = '';
            this.passInput = '';
        }
    }));
});