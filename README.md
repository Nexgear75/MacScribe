# MacScribe - Transcription Audio pour Mac

Une application de transcription audio/vidéo moderne avec interface CLI interactive, utilisant Whisper (OpenAI) pour la transcription et des LLM pour le post-traitement.

[![macOS](https://img.shields.io/badge/mac%20os-000000?style=for-the-badge&logo=macos&logoColor=F0F0F0)](https://www.apple.com/macos)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/fastapi-109989?style=for-the-badge&logo=FASTAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![OpenAI Whisper](https://img.shields.io/badge/Whisper-74aa9c?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/research/whisper)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

## Architecture

Le projet est divisé en deux parties :

- **CLI** (`/cli`) - Interface utilisateur en ligne de commande interactive (React + Ink)
- **Backend** (`/backend`) - API FastAPI (Python) pour le traitement audio et les LLM

## Fonctionnalités

- Transcription audio/vidéo via Whisper (OpenAI)
- Interface CLI interactive et réactive
- Support du téléchargement de vidéos YouTube
- Post-traitement via LLM (Deepseek)
- Génération de cours ou résumés à partir de transcriptions
- Communication en temps réel via WebSocket

## Prérequis

- **Node.js** >= 16
- **Python** 3.8+ (3.14 recommandé)
- **macOS** (pour l'optimisation MLX sur silicon Apple)

## Installation

### Option 1 : Démarrage rapide (recommandé)

Le script `launch.js` automatise l'installation et le démarrage complet :

```bash
git clone <repository-url>
cd macscribe-from-scratch

# Lancer l'application (installation automatique)
node scripts/launch.js
```

Le script s'occupe de tout :
- Vérification de Python 3
- Création du virtualenv
- Installation des dépendances Python
- Vérification du fichier `.env`
- Démarrage du backend
- Compilation du CLI
- Lancement de l'interface interactive

### Option 2 : Installation manuelle

#### 1. Cloner le projet

```bash
git clone <repository-url>
cd macscribe-from-scratch
```

#### 2. Installer le backend (Python)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### 3. Configurer les variables d'environnement

Créez un fichier `.env` dans le dossier `backend/` :

```bash
cd backend
cat > .env << EOL
DEEPSEEK_API_KEY=votre_cle_api_deepseek
EOL
```

#### 4. Installer le CLI (Node.js)

```bash
cd cli
npm install
npm run build
```

## Configuration

Le fichier `cli/config.json` contient la configuration de l'application :

```json
{
  "transcription": {
    "whisper_model": "large-v3-turbo"
  },
  "llm": {
    "provider": "deepseek",
    "model": "deepseek-chat"
  },
  "paths": {
    "temp_folder": ".temp",
    "output_folder": "./output/"
  }
}
```

| Paramètre | Description | Valeurs possibles |
|-----------|-------------|-------------------|
| `whisper_model` | Modèle Whisper utilisé | `tiny`, `base`, `small`, `medium`, `large`, `large-v3-turbo` |
| `provider` | Fournisseur LLM | `deepseek`, `openai`, `anthropic` |
| `model` | Modèle LLM | Dépend du fournisseur |
| `temp_folder` | Dossier temporaire | Chemin relatif ou absolu |
| `output_folder` | Dossier de sortie | Chemin relatif ou absolu |

## Utilisation

### Option 1 : Démarrage rapide (via `launch.js`)

```bash
node scripts/launch.js
```

Le script démarre automatiquement le backend, compile le CLI si nécessaire, et lance l'interface interactive. Pressez `Ctrl+C` pour arrêter proprement tout le processus.

### Option 2 : Démarrage manuel

#### Démarrer le backend

```bash
cd backend
source .venv/bin/activate
python app.py
```

Le serveur démarre sur `http://localhost:8000`

Vérifier que le serveur est opérationnel :
```bash
curl http://localhost:8000/health
```

#### Utiliser le CLI

Dans un autre terminal :

```bash
cd cli
npm run cli
```

L'interface interactive se lance et vous permet de :
1. Sélectionner un fichier audio/vidéo local
2. Ou entrer une URL YouTube
3. Choisir l'action (créer un cours ou un résumé)
4. Suivre la progression en temps réel

### Workflow typique

1. **Démarrer le backend** (gardez le terminal ouvert)
2. **Lancer le CLI** dans un autre terminal
3. **Sélectionner votre source** :
   - Fichier local (audio ou vidéo)
   - URL YouTube (la vidéo sera téléchargée automatiquement)
4. **Choisir le format de sortie** :
   - `create_course` - Génère un cours structuré
   - `create_summary` - Génère un résumé concis
5. **Récupérer le résultat** dans le dossier `output/`

## Scripts disponibles

### CLI

```bash
cd cli
npm run build      # Compiler TypeScript
npm run dev        # Mode développement (watch)
npm run cli        # Compiler et exécuter
npm test           # Lancer les tests (Prettier + XO + AVA)
```

### Backend

```bash
cd backend
source .venv/bin/activate
python app.py              # Démarrer le serveur
python -m pytest           # Lancer les tests (si configurés)
```

## Structure du projet

```
macscribe-from-scratch/
├── backend/                 # API Python FastAPI
│   ├── app.py              # Point d'entrée FastAPI
│   ├── config.py           # Configuration
│   ├── logger.py           # Logging
│   ├── websocket.py        # Gestion WebSocket
│   ├── requirements.txt    # Dépendances Python
│   └── core/               # Logique métier
│       └── process.py      # Traitement des fichiers
├── cli/                    # Interface CLI (Node.js/TypeScript)
│   ├── source/             # Code source TypeScript
│   │   ├── cli.tsx        # Point d'entrée
│   │   └── app.tsx        # Composant principal
│   ├── components/         # Composants React
│   ├── utils/              # Utilitaires
│   ├── config.json        # Configuration
│   └── package.json       # Dépendances Node.js
├── .temp/                 # Fichiers temporaires (créé automatiquement)
├── output/                # Résultats de transcription
├── config.json            # Configuration globale
└── README.md             # Ce fichier
```

## Technologies utilisées

### Backend

[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/fastapi-109989?style=for-the-badge&logo=FASTAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![OpenAI Whisper](https://img.shields.io/badge/Whisper-74aa9c?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/research/whisper)
[![YouTube](https://img.shields.io/badge/yt--dlp-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)

- **FastAPI** - Framework web moderne pour Python
- **Uvicorn** - Serveur ASGI
- **OpenAI Whisper** - Transcription audio
- **LiteLLM** - Interface unifiée pour les LLM
- **PyDub** - Manipulation audio
- **yt-dlp** - Téléchargement YouTube

### CLI

[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prettier](https://img.shields.io/badge/prettier-%23F7B93E.svg?style=for-the-badge&logo=prettier&logoColor=black)](https://prettier.io)
[![npm](https://img.shields.io/badge/npm-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com)

- **Ink** - UI React pour terminal
- **React** - Bibliothèque UI
- **TypeScript** - Typage statique
- **XO** - Linter ESLint
- **Prettier** - Formatage de code
- **AVA** - Framework de test

## API WebSocket

Le backend expose un endpoint WebSocket (`/ws/process`) pour le traitement en temps réel.

### Messages envoyés (client → serveur)

```json
{
  "action": "create_course|create_summary|download_video",
  "file_path": "/chemin/vers/fichier.mp4",
  "output_format": "markdown",
  "output_path": "./output/"
}
```

### Messages reçus (serveur → client)

```json
{
  "type": "status_update",
  "step": "transcribing",
  "progress": 45,
  "message": "Transcription en cours..."
}
```

Types de messages :
- `connected` - Connexion établie
- `status_update` - Mise à jour de progression
- `download_complete` - Téléchargement terminé (pour URLs)
- `complete` - Traitement terminé
- `error` - Erreur survenue

## Dépannage

### Le backend ne démarre pas

Vérifiez que :
- L'environnement virtuel est activé (`source .venv/bin/activate`)
- Toutes les dépendances sont installées (`pip install -r requirements.txt`)
- Le fichier `.env` existe avec la clé API Deepseek

### Erreur de connexion WebSocket

- Vérifiez que le backend est bien démarré (`curl http://localhost:8000/health`)
- Le port 8000 n'est pas utilisé par une autre application
- Vous n'avez pas de firewall bloquant localhost

### La transcription échoue

Vérifiez que :
- Le fichier audio/vidéo n'est pas corrompu
- Vous avez suffisamment d'espace disque
- Le modèle Whisper est bien téléchargé (premier lancement)
- Pour les URLs YouTube : la vidéo est accessible publiquement

### Problèmes de permission

```bash
# Rendre les scripts exécutables (si nécessaire)
chmod +x cli/dist/cli.js
```

## Développement

### Ajouter des dépendances

**Backend :**
```bash
cd backend
source .venv/bin/activate
pip install <package>
pip freeze > requirements.txt
```

**CLI :**
```bash
cd cli
npm install <package>
```

### Linter et formatage

**Backend :**
```bash
# A configurer selon vos préférences (flake8, black, etc.)
```

**CLI :**
```bash
cd cli
npx xo                    # Linter
npx prettier --write .    # Formatage
```

## Licence

MIT

---

Développé avec ❤️ pour macOS
