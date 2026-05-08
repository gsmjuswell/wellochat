import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJET.firebaseapp.com",
    projectId: "VOTRE_PROJET_ID",
    storageBucket: "VOTRE_PROJET.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
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
        showGroupModal: false,
        inviteRole: 'client',
        invitePhone: '',
        
        async login() {
            if (this.phoneInput === this.dgPhone && this.passInput === this.dgCode) {
                this.isLoggedIn = true;
                this.isAdmin = true;
                this.loadGroups();
            } else {
                // Ici on pourrait chercher dans la collection 'users' de Firestore pour les collaborateurs
                alert("Accès refusé");
            }
        },

        loadGroups() {
            const q = query(collection(db, "groups"), where("members", "array-contains", this.phoneInput));
            onSnapshot(q, (snapshot) => {
                this.groups = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    time: doc.data().updatedAt?.toDate().toLocaleTimeString([], {hour: '2h', minute: '2h'}) || 'Récent'
                }));
            });
        },

        async createGroup(name, membersArray) {
            await addDoc(collection(db, "groups"), {
                name: name,
                members: [this.dgPhone, ...membersArray],
                lastMessage: "Groupe créé",
                updatedAt: serverTimestamp()
            });
            this.showGroupModal = false;
        },

        generateLink() {
            const link = `https://votre-domaine.com/?ref=${this.invitePhone}&role=${this.inviteRole}`;
            alert("Lien généré pour " + this.invitePhone);
            return link;
        },

        logout() {
            this.isLoggedIn = false;
            this.phoneInput = '';
            this.passInput = '';
        }
    }));
});
