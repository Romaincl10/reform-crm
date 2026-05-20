# REFORM CRM

CRM interne partagé pour la filiale REFORM (SPK Group). Centralisation prospects, clients, prestations, suivi commercial et facturation.

## Stack

- **Front** : React 19 + Vite + Tailwind 4 + React Router 7
- **API** : Express + Drizzle + **PostgreSQL** (postgres-js) + JWT/bcrypt
- **BDD prod** : Supabase
- **Hébergement** : Railway (single process — l'API sert aussi le build du front)

---

# 🚀 Déploiement Supabase + GitHub + Railway

## Étape 1 — Supabase (BDD PostgreSQL, ~5 min)

1. Va sur **[supabase.com](https://supabase.com)** → **Start your project**
2. Connecte-toi (GitHub recommandé)
3. Clique **New project** :
   - **Organization** : ton organisation par défaut (ou en créer une)
   - **Project name** : `reform-crm`
   - **Database Password** : génère un mot de passe robuste et **conserve-le précieusement** (ex. via 1Password)
   - **Region** : `Europe West (Paris)` ou `Europe (Frankfurt)` — au plus proche
   - **Pricing Plan** : Free (largement suffisant : 500 MB de données, illimité en utilisateurs)
4. Clique **Create new project** → attends ~1 min que la BDD soit prête

### Récupérer la connection string

5. Une fois la BDD prête, va dans **Project Settings** (icône engrenage en bas à gauche) → **Database**
6. Section **Connection string** → onglet **URI**
7. Sous **Connection pooling** (mode **Transaction**), copie l'URL — elle ressemble à :
   ```
   postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres
   ```
8. Remplace `[YOUR-PASSWORD]` par le mot de passe que tu as défini à l'étape 3 → c'est ton `DATABASE_URL` final

> **Note** : utilise bien la version **pooler** (port 6543), pas le direct (port 5432). Le pooler est requis pour Railway.

## Étape 2 — Test local (optionnel mais recommandé, ~3 min)

Pour valider que tout marche avant de pusher en prod :

```powershell
cd C:\Users\RomainCLOUET\Documents\13\REFORM-CRM
cd apps\api
copy .env.example .env
# Édite .env : colle ton DATABASE_URL et mets un JWT_SECRET (n'importe quelle longue chaîne)
cd ..\..

# Applique le schéma sur Supabase
npm run db:migrate:all

# Crée les 5 comptes utilisateurs
npm run db:seed:users

# (Optionnel) Importe les 35 clients depuis l'Excel
cd apps\api
npx tsx src/db/seed-from-excel.ts
cd ..\..

# Lance en local
npm run dev
```

→ Front sur http://localhost:5173, login avec un des comptes ci-dessous.

Tu peux vérifier dans Supabase Dashboard → **Table Editor** que les tables sont créées et peuplées.

## Étape 3 — GitHub (push du code, ~3 min)

```powershell
cd C:\Users\RomainCLOUET\Documents\13\REFORM-CRM

# Initialiser git
git init
git add .
git commit -m "REFORM CRM — initial deploy"

# Créer un repo GitHub privé (gh CLI doit être installé et connecté)
gh repo create reform-crm --private --source=. --push
```

Si tu n'as pas `gh` CLI :
1. Va sur **[github.com/new](https://github.com/new)** → crée un repo privé `reform-crm` (laisse vide, ne coche rien)
2. Suis les instructions GitHub "…or push an existing repository from the command line" :
   ```powershell
   git remote add origin https://github.com/<ton-user>/reform-crm.git
   git branch -M main
   git push -u origin main
   ```

## Étape 4 — Railway (déploiement prod, ~5 min)

1. Va sur **[railway.app](https://railway.app)** → **Login with GitHub**
2. Clique **New Project** → **Deploy from GitHub repo**
3. Autorise Railway à accéder à ton repo `reform-crm` si demandé
4. Sélectionne le repo `reform-crm` → Railway démarre un build automatiquement
5. **Pendant le build**, va dans l'onglet **Variables** du service et ajoute les 3 variables :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | La connection string Supabase de l'étape 1 (avec ton password) |
   | `JWT_SECRET` | Une longue chaîne aléatoire (génère via `openssl rand -base64 48`) |
   | `PORT` | `8080` *(Railway l'injecte aussi automatiquement via `$PORT`, mais on le force ici)* |

6. Va dans **Settings** → **Networking** → **Generate Domain** → Railway expose une URL publique du type `reform-crm-production.up.railway.app`
7. Le build se relance avec les bonnes variables et déploie. Le `npm run start` :
   - Exécute les migrations automatiquement (idempotent — safe à relancer)
   - Lance le serveur Express sur le port Railway
8. Ouvre l'URL → tu dois voir l'écran de login REFORM

### Premier seed des users en prod

Une fois Railway en ligne, depuis ton poste local avec le **même** DATABASE_URL Supabase :

```powershell
cd C:\Users\RomainCLOUET\Documents\13\REFORM-CRM
npm run db:seed:users
```

Ça crée les 5 comptes utilisateurs sur la BDD Supabase. Comme c'est la même BDD que Railway, ils sont immédiatement utilisables sur l'URL publique.

### Domaine custom (optionnel)

Railway **Settings → Custom Domain** → ajoute `crm.joinreform.com`. Tu obtiens un CNAME à pointer vers Railway dans ton DNS REFORM.

---

# Comptes utilisateurs

| Email | Rôle | Mot de passe |
|---|---|---|
| mathieu.lafont@joinreform.com | **admin** REFORM | `UqcKgarMBj4AjE@93` |
| maelle.beltas@joinreform.com | **admin** REFORM | `VXiMLChX7yNqNP%26` |
| germain.butrot@spk-group.com | consultation SPK | `jHKanuEJFQEzHF$39` |
| kevin.geoffroy@spk-group.com | consultation SPK | `bmymWGnVwPfKfd#55` |
| paul.debelair@spk-group.com | consultation SPK | `ttc8sAEUsdsr3j@48` |

> ⚠️ Les mots de passe sont **forts** (17 caractères, mix maj/min/chiffres/symboles). Transmets-les via canal sécurisé (Bitwarden share, signal, etc.) et demande à chacun de le changer au premier login.

---

# Fonctionnalités

- **Tableau de bord** : 5 KPIs (prospects, clients, pipeline brut, **pipeline probabilisé**, à facturer) + derniers devis + prestations à venir
- **CRM Prospects** : kanban 4 étapes + liste, édition complète, bascule auto en client à "Gagné" (copie deal → engagement)
- **Clients** : liste avec SIREN, SPK, SPK PULSE, période, CA / à facturer / en attente / encaissé
- **Prestations** : liste exhaustive avec filtres (client, offre, statut, SPK, SPK PULSE), tris cliquables sur toutes les colonnes
- **Champs métier** : SIREN, type d'offre (Appui conseil / Formation / Bilan carbone / Activation / Certification / Diagnostic), SPK (Oui/Non), SPK PULSE (Oui/Non)
- **Import / Export Excel** sur les 3 onglets avec templates téléchargeables, charte REFORM

## Modèle de données

```
users (5 comptes : 2 admins REFORM + 3 consultation SPK)
organizations (status: prospect | client | inactive)
  ├── SIREN, SPK, SPK PULSE
  ├── contacts (1..N)
  ├── deals → stages: to_qualify / contacted / meeting / proposal / won / lost
  │     ├── offer_type, amount, probability
  │     ├── service_start_at / service_end_at
  │     └── 3 dates facturation prévisionnelles
  ├── activities (call / email / meeting / note / task)
  └── engagements (status: active / completed / cancelled)
        ├── offer_type, SPK, SPK PULSE
        ├── invoice_status (to_invoice / invoiced / partially_paid / paid)
        ├── invoiced_at / invoiced_amount / invoice_ref
        ├── total_amount / paid_amount
        └── started_at / ended_at + 3 dates facturation prévisionnelles
```

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | API + front en parallèle (local) |
| `npm run db:migrate:all` | Applique le schéma PG (idempotent) |
| `npm run db:seed:users` | Crée / met à jour les 5 comptes |
| `npm run build:prod` | Build front + API |
| `npm run start` | Migrations + serveur production (Railway) |
