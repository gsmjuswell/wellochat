// ============================================================
//  app.js — Wello Chat · Logique Firebase (SDK v10 modulaire)
// ============================================================
//
//  ÉTAPE 1 : Remplis les valeurs ci-dessous avec tes infos
//            Firebase Console > Paramètres du projet > Tes applications
//
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CONFIG FIREBASE ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC_Yhua_kHtW1iHVdPsdC0-p8dROmQx1hE",
  authDomain: "wello-chat.firebaseapp.com",
  projectId: "wello-chat",
  storageBucket: "wello-chat.firebasestorage.app",
  messagingSenderId: "823717850732",
  appId: "1:823717850732:web:fff5401d7dbcdeb90cf249"
};
// ──────────────────────────────────────────────────────────────────────────────

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

// ─── UTILITAIRES ──────────────────────────────────────────────────────────────

/** Génère un token aléatoire de 64 caractères (remplace Str::random(64)) */
function generateToken(length = 64) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Formate un timestamp Firestore en heure lisible (ex: 14:32) */
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── DÉFINITION DE L'APP ALPINE.JS ────────────────────────────────────────────

function welloApp() {
    return {
        // ── État de l'interface ──
        isLoggedIn:     false,
        isAdmin:        false,
        tab:            'chats',
        showSearch:     false,
        searchQuery:    '',
        menuOpen:       false,
        loginLoading:   false,
        loginError:     '',

        // ── Entrées formulaire connexion ──
        phoneInput: '',
        passInput:  '',

        // ── Constantes DG (identiques à ton code original) ──
        dgPhone: '92239333',
        dgCode:  'Juswell',

        // ── Chat actif & messages ──
        activeChat:  null,
        messages:    [],
        newMessage:  '',
        unsubMessages: null, // pour stopper le listener Firestore

        // ── Modales ──
        showGroupModal:    false,
        showInviteModal:   false,
        showManageMembers: false,

        // ── Formulaire invitation ──
        inviteRole:    'client',
        invitePhone:   '',
        inviteProject: '',
        generatedLink: '',

        // ── Formulaire groupe ──
        newGroupName:    '',
        selectedMembers: [],

        // ── Données chargées ──
        userProfile: { name: '', role: '' },
        usersList:   [],
        groupsList:  [],

        // ── Getters ──
        get filteredUsers() {
            if (!this.searchQuery) return this.usersList;
            return this.usersList.filter(u =>
                u.name.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        },

        get filteredGroups() {
            if (this.isAdmin) return this.groupsList;
            return this.groupsList.filter(group =>
                Array.isArray(group.members) && group.members.includes(this.phoneInput)
            );
        },

        // ── Initialisation ──
        init() {
            // Écoute des changements de activeChat pour charger les messages
            this.$watch('activeChat', (chat) => {
                // Arrêter le précédent listener si existant
                if (this.unsubMessages) {
                    this.unsubMessages();
                    this.unsubMessages = null;
                }
                this.messages = [];
                if (chat) {
                    this.listenMessages(chat);
                }
            });
        },

        // ─────────────────────────────────────────────────────────
        //  LOGIN — Remplace LoginController::check()
        //  Cherche l'utilisateur dans la collection Firestore "users"
        //  via le champ phone_number (identique à la migration SQL)
        // ─────────────────────────────────────────────────────────
        async login() {
            if (!this.phoneInput.trim()) return;
            this.loginError   = '';
            this.loginLoading = true;

            try {
                if (this.phoneInput === this.dgPhone) {
                    // ── Connexion DG ──────────────────────────────
                    if (this.passInput !== this.dgCode) {
                        this.loginError   = 'Code DG incorrect.';
                        this.loginLoading = false;
                        return;
                    }
                    this.isAdmin    = true;
                    this.isLoggedIn = true;
                    this.userProfile = { name: 'Directeur Général', role: 'Administrateur' };

                    // Le DG charge tous les utilisateurs inscrits
                    await this.loadAllUsers();
                    await this.loadGroups();

                } else {
                    // ── Connexion utilisateur standard ───────────
                    // Équivalent : User::where('phone_number', $phone)->first()
                    const q    = query(collection(db, "users"), where("phone_number", "==", this.phoneInput));
                    const snap = await getDocs(q);

                    if (snap.empty) {
                        this.loginError   = 'Numéro non reconnu.';
                        this.loginLoading = false;
                        return;
                    }

                    const userData    = snap.docs[0].data();
                    this.isAdmin      = false;
                    this.isLoggedIn   = true;
                    this.userProfile  = { name: userData.name, role: userData.role };

                    // L'utilisateur standard voit uniquement le DG dans ses chats
                    this.usersList = [{
                        id:           'dg',
                        name:         'Directeur Général (GSM)',
                        phone:        this.dgPhone,
                        last_message: 'Support disponible'
                    }];
                    await this.loadGroups();
                }

            } catch (err) {
                console.error('[Wello] Erreur login:', err);
                this.loginError = 'Erreur de connexion. Réessayez.';
            } finally {
                this.loginLoading = false;
            }
        },

        // ─────────────────────────────────────────────────────────
        //  LOAD ALL USERS — Utilisé par le DG
        //  Équivalent : User::where('phone_number', '!=', '92239333')->get()
        // ─────────────────────────────────────────────────────────
        async loadAllUsers() {
            try {
                const q    = query(collection(db, "users"), where("phone_number", "!=", this.dgPhone));
                const snap = await getDocs(q);
                this.usersList = snap.docs.map(d => ({
                    id:    d.id,
                    phone: d.data().phone_number,
                    ...d.data()
                }));
            } catch (err) {
                console.error('[Wello] Erreur chargement users:', err);
            }
        },

        // ─────────────────────────────────────────────────────────
        //  LOAD GROUPS — Remplace GroupController::index()
        //  Équivalent : Group::all()
        // ─────────────────────────────────────────────────────────
        async loadGroups() {
            try {
                const snap = await getDocs(collection(db, "groups"));
                this.groupsList = snap.docs.map(d => ({
                    id:      d.id,
                    members: [],
                    ...d.data()
                }));
            } catch (err) {
                console.error('[Wello] Erreur chargement groupes:', err);
            }
        },

        // ─────────────────────────────────────────────────────────
        //  CREATE GROUP — Remplace GroupController::store()
        //  Équivalent : Group::create(['name' => ..., 'members' => ...])
        // ─────────────────────────────────────────────────────────
        async createGroup() {
            if (!this.newGroupName.trim()) return alert('Nom requis');
            try {
                const docRef = await addDoc(collection(db, "groups"), {
                    name:       this.newGroupName.trim(),
                    members:    this.selectedMembers,
                    created_by: this.dgPhone,
                    created_at: serverTimestamp()
                });

                this.groupsList.push({
                    id:      docRef.id,
                    name:    this.newGroupName.trim(),
                    members: [...this.selectedMembers]
                });

                this.newGroupName    = '';
                this.selectedMembers = [];
                this.showGroupModal  = false;

            } catch (err) {
                console.error('[Wello] Erreur création groupe:', err);
                alert('Erreur lors de la création du groupe.');
            }
        },

        // ─────────────────────────────────────────────────────────
        //  UPDATE GROUP MEMBERS — Remplace GroupController::updateMembers()
        //  Équivalent : $group->update(['members' => $request->members])
        // ─────────────────────────────────────────────────────────
        async updateGroupMembers() {
            if (!this.activeChat || !this.activeChat.id) return;
            try {
                await updateDoc(doc(db, "groups", this.activeChat.id), {
                    members: this.activeChat.members
                });
                this.showManageMembers = false;

                // Rafraîchir la liste locale (équivalent loadGroups après update)
                await this.loadGroups();
                alert('Membres mis à jour avec succès');

            } catch (err) {
                console.error('[Wello] Erreur mise à jour membres:', err);
                alert('Erreur lors de la mise à jour.');
            }
        },

        // ─────────────────────────────────────────────────────────
        //  GENERATE LINK — Remplace InvitationController::store()
        //  Écrit dans la collection "invitations" de Firestore
        //  puis construit l'URL d'inscription (GitHub Pages)
        // ─────────────────────────────────────────────────────────
        async generateLink() {
            if (!this.invitePhone) return alert('Veuillez entrer un numéro');
            try {
                const token = generateToken(64);

                // Équivalent : Invitation::create([...])
                await setDoc(doc(db, "invitations", token), {
                    phone_number:   this.invitePhone,
                    role:           this.inviteRole,
                    projet_contrat: this.inviteProject,
                    token:          token,
                    used:           false,
                    created_at:     serverTimestamp()
                });

                // Construit l'URL (fonctionne sur GitHub Pages et en local)
                this.generatedLink = window.location.origin + window.location.pathname + '?invite=' + token;

            } catch (err) {
                console.error('[Wello] Erreur génération lien:', err);
                alert('Erreur lors de la génération du lien.');
            }
        },

        // ─────────────────────────────────────────────────────────
        //  SEND MESSAGE — Nouveau : écriture Firestore temps réel
        //  Collection : messages/{conversationId}/msgs
        // ─────────────────────────────────────────────────────────
        async sendMessage() {
            const text = this.newMessage.trim();
            if (!text || !this.activeChat) return;

            try {
                const convId = this.getConversationId();
                await addDoc(collection(db, "messages", convId, "msgs"), {
                    text:      text,
                    senderId:  this.phoneInput,
                    senderName: this.userProfile.name,
                    timestamp: serverTimestamp()
                });
                this.newMessage = '';
            } catch (err) {
                console.error('[Wello] Erreur envoi message:', err);
            }
        },

        // ─────────────────────────────────────────────────────────
        //  LISTEN MESSAGES — Écoute temps réel (remplace polling)
        // ─────────────────────────────────────────────────────────
        listenMessages(chat) {
            const convId = this.getConversationId();
            const q = query(
                collection(db, "messages", convId, "msgs"),
                orderBy("timestamp", "asc")
            );

            this.unsubMessages = onSnapshot(q, (snap) => {
                this.messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Scroll auto vers le bas
                this.$nextTick(() => {
                    const el = document.getElementById('messages-container');
                    if (el) el.scrollTop = el.scrollHeight;
                });
            });
        },

        // ─────────────────────────────────────────────────────────
        //  CONVERSATION ID — Identifiant unique entre 2 personnes
        //  ou pour un groupe. Tri alphabétique pour cohérence.
        // ─────────────────────────────────────────────────────────
        getConversationId() {
            if (!this.activeChat) return null;
            // Groupe → utilise l'id du groupe
            if (this.activeChat.members !== undefined) {
                return 'group_' + this.activeChat.id;
            }
            // Chat 1-to-1 → tri alphabétique des deux numéros
            const participants = [this.phoneInput, this.activeChat.phone || this.activeChat.id].sort();
            return participants.join('_');
        },

        // ─────────────────────────────────────────────────────────
        //  COPY LINK — Copie le lien généré dans le presse-papier
        // ─────────────────────────────────────────────────────────
        async copyLink() {
            try {
                await navigator.clipboard.writeText(this.generatedLink);
                alert('Lien copié !');
            } catch {
                // Fallback pour navigateurs anciens
                const el = document.querySelector('[readonly]');
                if (el) { el.select(); document.execCommand('copy'); }
            }
        },

        // ─────────────────────────────────────────────────────────
        //  LOGOUT
        // ─────────────────────────────────────────────────────────
        logout() {
            if (this.unsubMessages) this.unsubMessages();
            this.isLoggedIn  = false;
            this.isAdmin     = false;
            this.phoneInput  = '';
            this.passInput   = '';
            this.usersList   = [];
            this.groupsList  = [];
            this.activeChat  = null;
            this.messages    = [];
            this.userProfile = { name: '', role: '' };
        },

        // ─────────────────────────────────────────────────────────
        //  FORMAT TIME — Exposé au template HTML
        // ─────────────────────────────────────────────────────────
        formatTime(timestamp) {
            return formatTime(timestamp);
        },

        // ─────────────────────────────────────────────────────────
        //  HANDLE INVITE TOKEN — Détecte si l'URL contient un token
        //  d'invitation (remplace la route Laravel /inscription/{token})
        // ─────────────────────────────────────────────────────────
        async checkInviteToken() {
            const params = new URLSearchParams(window.location.search);
            const token  = params.get('invite');
            if (!token) return;

            try {
                const invDoc = await getDoc(doc(db, "invitations", token));
                if (!invDoc.exists() || invDoc.data().used) {
                    alert('Ce lien d\'invitation est invalide ou déjà utilisé.');
                    return;
                }
                const inv = invDoc.data();
                // Pré-remplissage du formulaire de connexion avec le numéro invité
                this.phoneInput = inv.phone_number;
                alert(`Bienvenue ! Vous avez été invité pour le projet : ${inv.projet_contrat}.\nConnectez-vous avec votre numéro.`);
            } catch (err) {
                console.error('[Wello] Erreur token invitation:', err);
            }
        }
    };
}

// Exposer la fonction globalement pour Alpine.js
window.welloApp = welloApp;

// Vérifier le token d'invitation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Délai court pour laisser Alpine.js initialiser
    setTimeout(() => {
        const appEl = document.querySelector('[x-data]');
        if (appEl && appEl._x_dataStack) {
            // Alternative : appel via URL params directement
            const params = new URLSearchParams(window.location.search);
            if (params.get('invite')) {
                // La fonction sera disponible via Alpine après init
                window.__pendingInviteToken = params.get('invite');
            }
        }
    }, 100);
});
