import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { checkBackendHealth } from '../utils/api.js'
import { Header } from '../components/Header.js'
import QuestionForm from '../components/QuestionForm.js'

export default function App() {
	// Get first message of the backend to check if it's online
	const [backendStatus, setBackendStatus] = useState<'Checking' | 'Online' | 'Offline'>('Checking')

	useEffect(() => {
		console.clear()
		const check = async () => {
			try {
				const response = await checkBackendHealth()
				setBackendStatus(response.message)
			} catch (error) {
				setBackendStatus('Offline')
			}
		}
		check()
	}, [])

	return (
		<Box paddingX={2} flexDirection='column'>
			{/* Header */}
			<Header />

			{/* Displaying backend status */}
			<Box marginBottom={1} paddingX={1}>
				<Text>
					Backend: <Text color='#A6E3A1'>{backendStatus || '...'}</Text>
				</Text>
			</Box>

			{/* Question Part */}
			<QuestionForm />
		</Box>
	);
}
