import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useFileCompletion, FileSuggestion } from '../hooks/useFileCompletion.js'

export type FileInputWithCompletionProps = {
	value: string;
	onChange: (value: string) => void;
	onSubmit?: () => void;
	placeholder?: string;
}

export function FileInputWithCompletion({ value, onChange, onSubmit, placeholder }: FileInputWithCompletionProps) {
	const [cursorPosition, setCursorPosition] = useState(value.length);
	const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
	const [showSuggestions, setShowSuggestions] = useState(true);

	const suggestions = useFileCompletion(value);

	// Synchroniser la position du curseur quand la valeur change de l'extérieur
	useEffect(() => {
		setCursorPosition(value.length);
	}, [value]);

	// Réinitialiser l'index quand les suggestions changent
	useEffect(() => {
		setSelectedSuggestionIndex(0);
	}, [suggestions.length]);

	useInput((input, key) => {
		if (!showSuggestions || suggestions.length === 0) {
			// Mode normal sans suggestions
			if (key.return) {
				onSubmit?.();
			} else if (key.backspace || key.delete) {
				if (cursorPosition > 0) {
					const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
					onChange(newValue);
					setCursorPosition(cursorPosition - 1);
				}
			} else if (key.leftArrow) {
				setCursorPosition(Math.max(0, cursorPosition - 1));
			} else if (key.rightArrow) {
				setCursorPosition(Math.min(value.length, cursorPosition + 1));
			} else if (key.home) {
				setCursorPosition(0);
			} else if (key.end) {
				setCursorPosition(value.length);
			} else if (input) {
				const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
				onChange(newValue);
				setShowSuggestions(true);
				setCursorPosition(cursorPosition + input.length);
			}
			return;
		}

		// Mode avec suggestions
		if (key.upArrow) {
			setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
		} else if (key.downArrow) {
			setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
		} else if (key.tab) {
			const selected = suggestions[selectedSuggestionIndex];
			if (selected) {
				onChange(selected.value);
				setSelectedSuggestionIndex(0);
			}
		} else if (key.return) {
			const selected = suggestions[selectedSuggestionIndex];
			if (selected) {
				onChange(selected.value);
			}
			onSubmit?.();
		} else if (key.escape) {
			setShowSuggestions(false);
		} else if (key.backspace || key.delete) {
			if (cursorPosition > 0) {
				const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
				onChange(newValue);
				setCursorPosition(cursorPosition - 1);
			}
		} else if (key.leftArrow) {
			setCursorPosition(Math.max(0, cursorPosition - 1));
		} else if (key.rightArrow) {
			setCursorPosition(Math.min(value.length, cursorPosition + 1));
		} else if (key.home) {
			setCursorPosition(0);
		} else if (key.end) {
			setCursorPosition(value.length);
		} else if (input) {
			const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
			onChange(newValue);
			setShowSuggestions(true);
			setCursorPosition(cursorPosition + input.length);
		}
	});

	// Afficher le texte avec le curseur
	const renderText = () => {
		const beforeCursor = value.slice(0, cursorPosition);
		const atCursor = value[cursorPosition] || ' ';
		const afterCursor = value.slice(cursorPosition + 1);

		if (value.length === 0) {
			return <Text dimColor>{placeholder}</Text>;
		}

		return (
			<Text>
				{beforeCursor}
				<Text backgroundColor="white" color="black">{atCursor}</Text>
				{afterCursor}
			</Text>
		);
	};

	return (
		<Box flexDirection="column">
			<Box>
				{renderText()}
			</Box>

			{showSuggestions && suggestions.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text dimColor>Suggestions:</Text>
					{suggestions.map((suggestion: FileSuggestion, index: number) => (
						<Box key={suggestion.value}>
							<Text
								color={index === selectedSuggestionIndex ? '#CBA6F7' : 'gray'}
								bold={index === selectedSuggestionIndex}
							>
								{index === selectedSuggestionIndex ? '▶ ' : '  '}
								{suggestion.label}
								{suggestion.isDirectory ? '/' : ''}
							</Text>
						</Box>
					))}
					<Box marginTop={1}>
						<Text dimColor>
							Use ↑↓ to navigate, Tab to complete, Enter to select, Esc to hide
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
}
