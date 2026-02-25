import { useState, useEffect } from "react";
import fs from "fs";
import path from "path";

export type FileSuggestion = {
	label: string;
	value: string;
	isDirectory: boolean;
}

export function useFileCompletion(input: string): FileSuggestion[] {
	const [suggestions, setSuggestions] = useState<FileSuggestion[]>([]);

	useEffect(() => {
		if (!input || input.length < 1) {
			setSuggestions([]);
			return;
		}

		try {
			// Déterminer le répertoire de base et le préfixe
			let searchDir: string;
			let prefix: string;

			if (input.includes('/')) {
				// L'utilisateur a déjà tapé un chemin avec des slashs
				const lastSlashIndex = input.lastIndexOf('/');
				searchDir = input.substring(0, lastSlashIndex) || '/';
				prefix = input.substring(lastSlashIndex + 1);
			} else if (input.startsWith('~')) {
				// Chemin relatif au home
				searchDir = process.env['HOME'] || '.';
				prefix = input.substring(1);
			} else {
				// Chemin relatif au répertoire courant
				searchDir = '.';
				prefix = input;
			}

			// Résoudre le chemin absolu
			const resolvedDir = path.resolve(searchDir);

			// Vérifier si le répertoire existe
			if (!fs.existsSync(resolvedDir)) {
				setSuggestions([]);
				return;
			}

			const stats = fs.statSync(resolvedDir);
			if (!stats.isDirectory()) {
				setSuggestions([]);
				return;
			}

			// Lire les fichiers du répertoire
			const files = fs.readdirSync(resolvedDir);

			// Filtrer et formater les suggestions
			const matches = files
				.filter(file => file.startsWith(prefix) && !file.startsWith('.'))
				.map(file => {
					const fullPath = path.join(resolvedDir, file);
					const isDirectory = fs.statSync(fullPath).isDirectory();
					const displayPath = input.includes('/') 
						? path.join(searchDir, file) + (isDirectory ? '/' : '')
						: file + (isDirectory ? '/' : '');
					
					return {
						label: displayPath,
						value: displayPath,
						isDirectory
					};
				})
				.slice(0, 10); // Limiter à 10 suggestions

			setSuggestions(matches);
		} catch (error) {
			setSuggestions([]);
		}
	}, [input]);

	return suggestions;
}
