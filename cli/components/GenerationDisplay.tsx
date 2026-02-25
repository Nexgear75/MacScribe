import React from 'react';
import { Box, Text } from 'ink';

interface GenerationDisplayProps {
	content: string;
	title?: string;
}

export function GenerationDisplay({ content, title = "Génération en cours..." }: GenerationDisplayProps) {
	// Limiter l'affichage à 8 lignes pour voir le début + aperçu dynamique
	const allLines = content.split('\n');
	const displayLines = allLines.slice(0, 8);
	const hasMore = allLines.length > 8;
	const totalLines = allLines.length;

	return (
		<Box flexDirection="column" paddingX={1} marginY={1}>
			<Box
				borderStyle="round"
				borderColor="cyan"
				flexDirection="column"
				paddingY={1}
			>
				<Box marginBottom={1} flexDirection="row" justifyContent="space-between">
					<Text bold color="cyan">
						{title}
					</Text>
					<Text dimColor>({totalLines} lignes)</Text>
				</Box>

				<Box flexDirection="column" height={8}>
					{displayLines.map((line, index) => (
						<Box key={index}>
							<Text dimColor={line.trim() === ''}>
								{line || ' '}
							</Text>
						</Box>
					))}
				</Box>

				{hasMore && (
					<Box marginTop={1} flexDirection="row" justifyContent="space-between">
						<Text dimColor>...</Text>
						<Text dimColor>(+ {totalLines - 8} lignes)</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
}
