interface TTSSettings {
	enabled: boolean;
	APIType: string;
	APIHost: string;
	APIKey: string;
	model: string;
	voice: string;
}

interface TTSAdapter {
	createSpeechRequestBody(params: TTSSettings, input: string, format: string): any;
}
