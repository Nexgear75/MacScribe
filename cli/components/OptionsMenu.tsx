import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {
	loadConfig,
	saveConfig,
	WHISPER_MODELS,
	LLM_PROVIDERS,
	LLM_MODELS,
	type Config,
} from '../utils/config.js';

type MenuState =
	| 'main'
	| 'transcription'
	| 'whisper_model'
	| 'llm'
	| 'provider'
	| 'model'
	| 'paths'
	| 'temp_folder'
	| 'output_folder';

type OptionsMenuProps = {
	onBack: () => void;
};

export function OptionsMenu({ onBack }: OptionsMenuProps) {
	const [config, setConfig] = useState<Config>(loadConfig());
	const [currentMenu, setCurrentMenu] = useState<MenuState>('main');
	const [tempInput, setTempInput] = useState(config.paths.temp_folder);
	const [outputInput, setOutputInput] = useState(config.paths.output_folder);

	const handleSave = (newConfig: Config) => {
		saveConfig(newConfig);
		setConfig(newConfig);
	};

	// Menu principal
	const mainItems = [
		{ label: 'Transcription', value: 'transcription' },
		{ label: 'LLM', value: 'llm' },
		{ label: 'Chemins', value: 'paths' },
		{ label: 'Retour au menu principal', value: 'back' },
	];

	// Menu Transcription
	const transcriptionItems = [
		{ label: 'Modèle Whisper', value: 'whisper_model' },
		{ label: 'Retour', value: 'back' },
	];

	// Menu LLM
	const llmItems = [
		{ label: 'Provider', value: 'provider' },
		{ label: 'Modèle', value: 'model' },
		{ label: 'Retour', value: 'back' },
	];

	// Menu Chemins
	const pathsItems = [
		{ label: 'Dossier temporaire', value: 'temp_folder' },
		{ label: 'Dossier de sortie', value: 'output_folder' },
		{ label: 'Retour', value: 'back' },
	];

	// Modèles Whisper
	const whisperModelItems = WHISPER_MODELS.map((model) => ({
		label: model === config.transcription.whisper_model ? `✓ ${model}` : model,
		value: model,
	}));

	// Providers
	const providerItems = LLM_PROVIDERS.map((provider) => ({
		label: provider === config.llm.provider ? `✓ ${provider}` : provider,
		value: provider,
	}));

	// Modèles selon le provider
	const currentModels = LLM_MODELS[config.llm.provider] || [];
	const modelItems = currentModels.map((model) => ({
		label: model === config.llm.model ? `✓ ${model}` : model,
		value: model,
	}));

	// Gestion du sous-menu Whisper Model avec input
	if (currentMenu === 'whisper_model') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					Configuration - Modèle Whisper
				</Text>
				<Text dimColor>Modèle actuel: {config.transcription.whisper_model}</Text>
				<Box marginTop={1}>
					<SelectInput
						items={whisperModelItems}
						onSelect={(item) => {
							if (item.value === 'back') {
								setCurrentMenu('transcription');
							} else {
								const newConfig = {
									...config,
									transcription: {
										...config.transcription,
										whisper_model: item.value,
									},
								};
								handleSave(newConfig);
								setCurrentMenu('transcription');
							}
						}}
					/>
				</Box>
			</Box>
		);
	}

	// Gestion du sous-menu Provider
	if (currentMenu === 'provider') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					LLM - Provider
				</Text>
				<Text dimColor>Provider actuel: {config.llm.provider}</Text>
				<Box marginTop={1}>
					<SelectInput
						items={[
							...providerItems,
							{ label: '↩  Retour', value: 'back' },
						]}
						onSelect={(item) => {
							if (item.value === 'back') {
								setCurrentMenu('llm');
							} else {
								const newProvider = item.value;
								// Sélectionner le premier modèle du nouveau provider
								const newModel = LLM_MODELS[newProvider]?.[0] || '';
								const newConfig = {
									...config,
									llm: {
										provider: newProvider,
										model: newModel,
									},
								};
								handleSave(newConfig);
								setCurrentMenu('llm');
							}
						}}
					/>
				</Box>
			</Box>
		);
	}

	// Gestion du sous-menu Model
	if (currentMenu === 'model') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					LLM - Modèle ({config.llm.provider})
				</Text>
				<Text dimColor>Modèle actuel: {config.llm.model}</Text>
				<Box marginTop={1}>
					<SelectInput
						items={[
							...modelItems,
							{ label: '↩  Retour', value: 'back' },
						]}
						onSelect={(item) => {
							if (item.value === 'back') {
								setCurrentMenu('llm');
							} else {
								const newConfig = {
									...config,
									llm: {
										...config.llm,
										model: item.value,
									},
								};
								handleSave(newConfig);
								setCurrentMenu('llm');
							}
						}}
					/>
				</Box>
			</Box>
		);
	}

	// Gestion du sous-menu Temp Folder avec input texte
	if (currentMenu === 'temp_folder') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					Chemins - Dossier temporaire
				</Text>
				<Text dimColor>Valeur actuelle: {config.paths.temp_folder}</Text>
				<Box marginTop={1}>
					<Text>Nouveau chemin: </Text>
					<TextInput
						value={tempInput}
						onChange={setTempInput}
						onSubmit={(value) => {
							const newConfig = {
								...config,
								paths: {
									...config.paths,
									temp_folder: value || config.paths.temp_folder,
								},
							};
							handleSave(newConfig);
							setCurrentMenu('paths');
						}}
					/>
				</Box>
				<Text dimColor>Appuyez sur Entrée pour sauvegarder</Text>
			</Box>
		);
	}

	// Gestion du sous-menu Output Folder avec input texte
	if (currentMenu === 'output_folder') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					Chemins - Dossier de sortie
				</Text>
				<Text dimColor>Valeur actuelle: {config.paths.output_folder}</Text>
				<Box marginTop={1}>
					<Text>Nouveau chemin: </Text>
					<TextInput
						value={outputInput}
						onChange={setOutputInput}
						onSubmit={(value) => {
							const newConfig = {
								...config,
								paths: {
									...config.paths,
									output_folder: value || config.paths.output_folder,
								},
							};
							handleSave(newConfig);
							setCurrentMenu('paths');
						}}
					/>
				</Box>
				<Text dimColor>Appuyez sur Entrée pour sauvegarder</Text>
			</Box>
		);
	}

	// Menu Transcription
	if (currentMenu === 'transcription') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					Configuration de la Transcription
				</Text>
				<Box marginTop={1}>
					<SelectInput
						items={transcriptionItems}
						onSelect={(item) => {
							if (item.value === 'back') {
								setCurrentMenu('main');
							} else {
								setCurrentMenu(item.value as MenuState);
							}
						}}
					/>
				</Box>
			</Box>
		);
	}

	// Menu LLM
	if (currentMenu === 'llm') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					Configuration du LLM
				</Text>
				<Text>
					Provider: {config.llm.provider} | Modèle: {config.llm.model}
				</Text>
				<Box marginTop={1}>
					<SelectInput
						items={llmItems}
						onSelect={(item) => {
							if (item.value === 'back') {
								setCurrentMenu('main');
							} else {
								setCurrentMenu(item.value as MenuState);
							}
						}}
					/>
				</Box>
			</Box>
		);
	}

	// Menu Chemins
	if (currentMenu === 'paths') {
		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold color="#CBA6F7">
					Configuration des Chemins
				</Text>
				<Text dimColor>
					Temp: {config.paths.temp_folder}
				</Text>
				<Text dimColor>
					Output: {config.paths.output_folder}
				</Text>
				<Box marginTop={1}>
					<SelectInput
						items={pathsItems}
						onSelect={(item) => {
							if (item.value === 'back') {
								setCurrentMenu('main');
							} else {
								setCurrentMenu(item.value as MenuState);
							}
						}}
					/>
				</Box>
			</Box>
		);
	}

	// Menu principal (default)
	return (
		<Box flexDirection="column" marginBottom={1} paddingX={1}>
			<Text bold color="#CBA6F7">
				Options de Configuration
			</Text>
			<Text dimColor>
				Configurez les paramètres de transcription et de génération
			</Text>
			<Box marginTop={1}>
				<SelectInput
					items={mainItems}
					onSelect={(item) => {
						if (item.value === 'back') {
							onBack();
						} else {
							setCurrentMenu(item.value as MenuState);
						}
					}}
				/>
			</Box>
		</Box>
	);
}
