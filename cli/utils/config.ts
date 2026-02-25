import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Remonter à la racine du projet (cli/utils/ -> cli/ -> racine)
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const CONFIG_PATH = resolve(PROJECT_ROOT, 'config.json');

export interface Config {
	transcription: {
		whisper_model: string;
	};
	llm: {
		provider: string;
		model: string;
	};
	paths: {
		temp_folder: string;
		output_folder: string;
	};
}

const DEFAULT_CONFIG: Config = {
	transcription: {
		whisper_model: 'large-v3-turbo',
	},
	llm: {
		provider: 'Kimi',
		model: 'k2.5',
	},
	paths: {
		temp_folder: './.temp/',
		output_folder: './output/',
	},
};

export function loadConfig(): Config {
	if (!existsSync(CONFIG_PATH)) {
		// Créer le fichier avec les valeurs par défaut
		writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
		return DEFAULT_CONFIG;
	}

	try {
		const content = readFileSync(CONFIG_PATH, 'utf-8');
		return JSON.parse(content) as Config;
	} catch (error) {
		console.error('Error loading config:', error);
		return DEFAULT_CONFIG;
	}
}

export function saveConfig(config: Config): void {
	try {
		writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
	} catch (error) {
		console.error('Error saving config:', error);
	}
}

// Valeurs disponibles pour les différents paramètres
export const WHISPER_MODELS = [
	'tiny',
	'base',
	'small',
	'medium',
	'large-v1',
	'large-v2',
	'large-v3',
	'large-v3-turbo',
];

export const LLM_PROVIDERS = ['Kimi', 'OpenAI', 'Anthropic', 'Gemini', 'Ollama'];

export const LLM_MODELS: Record<string, string[]> = {
	Kimi: ['k1.5', 'k2.5', 'moonshot-v1-32k', 'moonshot-v1-128k'],
	OpenAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
	Anthropic: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
	Gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
	Ollama: ['llama3.2', 'mistral', 'codellama', 'phi4'],
};
