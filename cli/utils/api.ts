import axios from 'axios'

const API_URL = 'http://localhost:8000'

type sendToBackendProps = {
	action: 'create_course' | 'create_summary' | null;
	file_path: string;
	output_path: string;
	output_format: string;
}

export async function checkBackendHealth() {
	try {
		const response = await axios.get(`${API_URL}/health`);
		return response.data
	} catch (error) {
		throw error;
	}
}

export async function sendToBackend(props: sendToBackendProps) {
	try {
		const response = await axios.post(`${API_URL}/process`, {
			action: props.action,
			file_path: props.file_path,
			output_path: props.output_path,
			output_format: props.output_format,
		})
		return response
	} catch (error) {
		throw error;
	}
}
