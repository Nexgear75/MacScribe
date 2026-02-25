import React from 'react';
import { Box, Text } from 'ink';
import type { Task, TaskStatus } from '../utils/websocket.js';

interface TaskProgressProps {
	tasks: Task[];
}

function getStatusIndicator(status: TaskStatus): string {
	switch (status) {
		case 'pending':
			return '○';
		case 'running':
			return '◐';
		case 'completed':
			return '●';
		case 'error':
			return '✖';
		default:
			return '○';
	}
}

function getStatusColor(status: TaskStatus): string {
	switch (status) {
		case 'pending':
			return 'grey';
		case 'running':
			return 'yellow';
		case 'completed':
			return 'green';
		case 'error':
			return 'red';
		default:
			return 'white';
	}
}

function formatSpeed(bytesPerSec: number): string {
	if (bytesPerSec >= 1_000_000) {
		return `${(bytesPerSec / 1_000_000).toFixed(1)} MB/s`;
	}
	if (bytesPerSec >= 1_000) {
		return `${(bytesPerSec / 1_000).toFixed(0)} KB/s`;
	}
	return `${bytesPerSec.toFixed(0)} B/s`;
}

export function TaskProgress({ tasks }: TaskProgressProps) {
	return (
		<Box flexDirection="column" paddingX={1} borderStyle='round' borderColor='gray'>
			<Box marginBottom={1}>
				<Text bold>Traitement en cours...</Text>
			</Box>

			{tasks.map((task) => (
				<Box key={task.id} flexDirection="row" marginBottom={1}>
					<Box width={3}>
						<Text color={getStatusColor(task.status)}>
							{getStatusIndicator(task.status)}
						</Text>
					</Box>

					<Box width={35}>
						<Text
							dimColor={task.status === 'pending'}
							color={task.status === 'running' ? 'white' : undefined}
							bold={task.status === 'running'}
						>
							{task.name}
						</Text>
					</Box>

					{task.status === 'running' && task.download_percent != null && (
						<Box>
							<Text color="cyan">
								{` ${Math.round(task.download_percent)}%`}
							</Text>
							{task.download_speed != null && task.download_speed > 0 && (
								<Text dimColor>
									{` - ${formatSpeed(task.download_speed)}`}
								</Text>
							)}
						</Box>
					)}
				</Box>
			))}

			<Box marginTop={1}>
				<Text dimColor>
					○ = À faire  ◐ = En cours  ● = Terminé
				</Text>
			</Box>
		</Box>
	);
}
