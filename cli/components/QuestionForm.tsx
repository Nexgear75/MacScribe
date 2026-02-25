import React, { useState, useRef } from "react";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { Box, Text, useInput } from "ink";
import { FileInputWithCompletion } from "./FileInput.js";
import { OptionsMenu } from "./OptionsMenu.js";
import { TaskProgress } from "./TaskProgress.js";
import { GenerationDisplay } from "./GenerationDisplay.js";
import { createWebSocketClient, type Task, type WebSocketClient } from "../utils/websocket.js";
import fs from "fs";
import path from "path";

type FormData = {
	action: 'create_course' | 'create_summary' | 'download_video' | null;
	filePath: string;
	outputFormat: 'md' | 'typst' | 'txt' | null;
	outputPath: string;
	isUrl: boolean;
}

export default function QuestionForm() {
	const [step, setStep] = useState<number>(0);
	const [showOptions, setShowOptions] = useState<boolean>(false);

	const [formData, setFormData] = useState<FormData>({
		action: null,
		filePath: '',
		outputFormat: null,
		outputPath: '',
		isUrl: false,
	});

	const [fileError, setFileError] = useState<string | null>(null);

	// États WebSocket
	const [tasks, setTasks] = useState<Task[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [outputFile, setOutputFile] = useState<string | null>(null);
	const [isComplete, setIsComplete] = useState<boolean>(false);
	const [generationContent, setGenerationContent] = useState<string>("");
	const [showGeneration, setShowGeneration] = useState<boolean>(false);

	// États pour le flux download
	const [downloadedVideoPath, setDownloadedVideoPath] = useState<string | null>(null);
	const [downloadedVideoTitle, setDownloadedVideoTitle] = useState<string | null>(null);
	const [showPostDownloadMenu, setShowPostDownloadMenu] = useState<boolean>(false);
	const wsClientRef = useRef<WebSocketClient | null>(null);

	const validateFilePath = (filePath: string): boolean => {
		if (!filePath) {
			setFileError("File path is required");
			return false;
		}

		const resolvedPath = path.resolve(filePath);

		if (!fs.existsSync(resolvedPath)) {
			setFileError(`File does not exist: ${filePath}`);
			return false;
		}

		const stats = fs.statSync(resolvedPath);
		if (!stats.isFile()) {
			setFileError(`Path is not a file: ${filePath}`);
			return false;
		}

		setFileError(null);
		return true;
	};

	const validateUrl = (url: string): boolean => {
		if (!url) {
			setFileError("URL is required");
			return false;
		}
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			setFileError("URL must start with http:// or https://");
			return false;
		}
		setFileError(null);
		return true;
	};

	const handleSubmit = async () => {
		setStep(4); // Aller à l'étape de traitement

		const wsClient = createWebSocketClient();
		wsClientRef.current = wsClient;

		wsClient.on('tasksInitialized', (initialTasks: Task[]) => {
			setTasks(initialTasks);
		});

		wsClient.on('progress', (taskId: number, progress: number, downloadPercent?: number, downloadSpeed?: number | null) => {
			setTasks(prev => prev.map(task =>
				task.id === taskId ? { ...task, progress, download_percent: downloadPercent, download_speed: downloadSpeed } : task
			));
		});

		wsClient.on('status', (taskId: number, status: string) => {
			setTasks(prev => prev.map(task =>
				task.id === taskId ? { ...task, status: status as Task['status'] } : task
			));
		});

		wsClient.on('generation_start', (data: { prompt: string }) => {
			setShowGeneration(true);
			setGenerationContent(data.prompt + "\n\n");
		});

		wsClient.on('generation_token', (data: { token: string; content: string }) => {
			setGenerationContent(data.content);
		});

		wsClient.on('generation_content', (data: { content: string }) => {
			setGenerationContent(data.content);
		});

		wsClient.on('download_complete', (data: { video_path: string; title: string }) => {
			setDownloadedVideoPath(data.video_path);
			setDownloadedVideoTitle(data.title);
			setShowPostDownloadMenu(true);
		});

		wsClient.on('error', (errorMessage: string) => {
			setError(errorMessage);
		});

		let isFinished = false;

		wsClient.on('complete', (outputPath: string) => {
			setOutputFile(outputPath);
			setIsComplete(true);
			isFinished = true;
		});

		wsClient.on('disconnected', () => {
			if (!isFinished && !error) {
				setError('Connexion perdue avec le serveur');
			}
		});

		try {
			await wsClient.connect();
			wsClient.send({
				action: formData.action,
				file_path: formData.filePath,
				output_format: formData.outputFormat || "",
				output_path: formData.outputPath || ""
			});
		} catch (err) {
			setError(`Erreur de connexion: ${err}`);
		}
	};

	const handlePostDownloadChoice = (choice: string) => {
		setShowPostDownloadMenu(false);

		if (choice === 'done') {
			// Send done to server, will trigger complete with video path
			if (wsClientRef.current) {
				wsClientRef.current.send({
					continue_action: "done"
				});
			}
		} else {
			// Need format + output path → go to format selection step
			setFormData(prev => ({
				...prev,
				action: choice as 'create_course' | 'create_summary',
			}));
			setStep(5); // post-download format selection
		}
	};

	const handlePostDownloadSubmit = () => {
		// Send continue_action with format and output path
		if (wsClientRef.current) {
			wsClientRef.current.send({
				continue_action: formData.action,
				output_format: formData.outputFormat,
				output_path: formData.outputPath,
			});
		}
		setShowPostDownloadMenu(false);
		setTasks([]);
		setStep(4); // Back to processing view
	};

	// Étape 0: Menu principal
	const renderMainMenu = () => {
		const items = [
			{ label: 'Create course', value: 'create_course' },
			{ label: 'Create summary', value: 'create_summary' },
			{ label: 'Download video', value: 'download_video' },
			{ label: 'Options', value: 'options' },
			{ label: 'Quit', value: 'quit' },
		];

		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text>What do you want to do ?</Text>
				<SelectInput
					items={items}
					onSelect={(item) => {
						if (item.value === 'quit') {
							process.exit(0);
						} else if (item.value === 'options') {
							setShowOptions(true);
						} else if (item.value === 'download_video') {
							setFormData({ ...formData, action: 'download_video', isUrl: true });
							setStep(1);
						} else {
							setFormData({ ...formData, action: item.value as 'create_course' | 'create_summary', isUrl: false });
							setStep(1);
						}
					}}
				/>
			</Box>
		);
	};

	// Étape 1: Chemin du fichier OU URL
	const renderFilePathInput = () => {
		if (formData.isUrl) {
			return (
				<Box flexDirection="column" marginBottom={1} paddingX={1}>
					<Box>
						<Text bold>Enter the video URL:</Text>
					</Box>

					<Box borderStyle="round" borderColor={fileError ? "red" : "grey"} paddingX={1}>
						<Text>&gt; </Text>
						<TextInput
							value={formData.filePath}
							onChange={(value) => {
								setFormData({ ...formData, filePath: value });
								setFileError(null);
							}}
							onSubmit={() => {
								if (validateUrl(formData.filePath)) {
									handleSubmit();
								}
							}}
							placeholder="https://www.youtube.com/watch?v=..."
						/>
					</Box>

					{fileError && (
						<Box marginTop={1}>
							<Text color="red">✖ {fileError}</Text>
						</Box>
					)}
				</Box>
			);
		}

		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Box>
					<Text bold>Enter the file path:</Text>
				</Box>

				<Box borderStyle="round" borderColor={fileError ? "red" : "grey"} paddingX={1}>
					<Text>&gt; </Text>
					<FileInputWithCompletion
						value={formData.filePath}
						onChange={(value) => {
							setFormData({ ...formData, filePath: value });
							setFileError(null);
						}}
						onSubmit={() => {
							if (validateFilePath(formData.filePath)) {
								setStep(2);
							}
						}}
						placeholder="/path/to/file.mp3"
					/>
				</Box>

				{fileError && (
					<Box marginTop={1}>
						<Text color="red">✖ {fileError}</Text>
					</Box>
				)}
			</Box>
		);
	};

	const renderFormatSelection = () => {
		const items = [
			{ label: 'Markdown (.md)', value: 'md' },
			{ label: 'Typst (.typst)', value: 'typst' },
			{ label: 'Text (.txt)', value: 'txt' },
		];

		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold>Choose output format:</Text>
				<SelectInput
					items={items}
					onSelect={(item) => {
						setFormData({ ...formData, outputFormat: item.value as 'md' | 'typst' | 'txt' });
						setStep(3);
					}}
				/>
			</Box>
		);
	};

	// Étape 3: Chemin de destination avec autocomplétion
	const renderOutputPathInput = () => (
		<Box flexDirection="column" marginBottom={1} paddingX={1}>
			<Text bold>Enter the output path:</Text>

			<Box borderStyle="round" borderColor="grey" paddingX={1}>
				<Text>&gt; </Text>
				<FileInputWithCompletion
					value={formData.outputPath}
					onChange={(value) => {
						setFormData({ ...formData, outputPath: value });
					}}
					onSubmit={handleSubmit}
					placeholder="/path/to/output"
				/>
			</Box>
		</Box>
	);

	// Étape 4: Affichage des tâches en cours
	const renderProcessing = () => {
		if (error) {
			return (
				<Box flexDirection="column" paddingX={1}>
					<Text color="red" bold>Erreur lors du traitement</Text>
					<Text color="red">{error}</Text>
					<Box marginTop={1}>
						<Text dimColor>Appuyez sur une touche pour retourner au menu</Text>
					</Box>
				</Box>
			);
		}

		// Menu post-téléchargement
		if (showPostDownloadMenu) {
			const items = [
				{ label: 'Create course from this video', value: 'create_course' },
				{ label: 'Create summary from this video', value: 'create_summary' },
				{ label: 'Done (keep video only)', value: 'done' },
			];

			return (
				<Box flexDirection="column" paddingX={1}>
					<TaskProgress tasks={tasks} />
					<Box marginTop={1} flexDirection="column">
						<Text color="green" bold>Video downloaded: {downloadedVideoTitle}</Text>
						<Text dimColor>{downloadedVideoPath}</Text>
					</Box>
					<Box marginTop={1} flexDirection="column">
						<Text bold>What do you want to do with this video?</Text>
						<SelectInput
							items={items}
							onSelect={(item) => handlePostDownloadChoice(item.value)}
						/>
					</Box>
				</Box>
			);
		}

		// Si terminé avec succès
		if (isComplete && outputFile) {
			return (
				<Box flexDirection="column" paddingX={1}>
					<Text color="green" bold>Traitement terminé avec succès !</Text>
					<Box marginTop={1}>
						<Text>Fichier généré :</Text>
						<Text color="cyan">{outputFile}</Text>
					</Box>
					{generationContent && (
						<Box marginTop={1}>
							<GenerationDisplay
								content={generationContent}
								title="Contenu généré (aperçu)"
							/>
						</Box>
					)}
					<Box marginTop={1}>
						<Text bold color="yellow">Appuyez sur une touche pour retourner au menu</Text>
					</Box>
				</Box>
			);
		}

		// Pendant le traitement
		return (
			<Box flexDirection="column">
				<TaskProgress tasks={tasks} />
				{showGeneration && generationContent && (
					<GenerationDisplay content={generationContent} />
				)}
			</Box>
		);
	};

	// Étape 5: Format selection post-download
	const renderPostDownloadFormatSelection = () => {
		const items = [
			{ label: 'Markdown (.md)', value: 'md' },
			{ label: 'Typst (.typst)', value: 'typst' },
			{ label: 'Text (.txt)', value: 'txt' },
		];

		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Text bold>Choose output format:</Text>
				<SelectInput
					items={items}
					onSelect={(item) => {
						setFormData(prev => ({ ...prev, outputFormat: item.value as 'md' | 'typst' | 'txt' }));
						setStep(6);
					}}
				/>
			</Box>
		);
	};

	// Étape 6: Output path post-download
	const renderPostDownloadOutputPath = () => (
		<Box flexDirection="column" marginBottom={1} paddingX={1}>
			<Text bold>Enter the output path:</Text>

			<Box borderStyle="round" borderColor="grey" paddingX={1}>
				<Text>&gt; </Text>
				<FileInputWithCompletion
					value={formData.outputPath}
					onChange={(value) => {
						setFormData({ ...formData, outputPath: value });
					}}
					onSubmit={handlePostDownloadSubmit}
					placeholder="/path/to/output"
				/>
			</Box>
		</Box>
	);

	// Fonction pour réinitialiser et revenir au menu
	const resetAndGoToMenu = () => {
		setStep(0);
		setFormData({
			action: null,
			filePath: '',
			outputFormat: null,
			outputPath: '',
			isUrl: false,
		});
		setTasks([]);
		setError(null);
		setOutputFile(null);
		setIsComplete(false);
		setGenerationContent("");
		setShowGeneration(false);
		setFileError(null);
		setDownloadedVideoPath(null);
		setDownloadedVideoTitle(null);
		setShowPostDownloadMenu(false);
		wsClientRef.current = null;
	};

	// Gestion de la touche à la fin du traitement - retour au menu
	useInput(() => {
		if (step === 4 && (isComplete || error) && !showPostDownloadMenu) {
			resetAndGoToMenu();
		}
	});

	// Rendu selon l'étape
	if (showOptions) {
		return <OptionsMenu onBack={() => setShowOptions(false)} />;
	}

	switch (step) {
		case 0:
			return renderMainMenu();
		case 1:
			return renderFilePathInput();
		case 2:
			return renderFormatSelection();
		case 3:
			return renderOutputPathInput();
		case 4:
			return renderProcessing();
		case 5:
			return renderPostDownloadFormatSelection();
		case 6:
			return renderPostDownloadOutputPath();
		default:
			return <Text>Loading...</Text>;
	}
}
