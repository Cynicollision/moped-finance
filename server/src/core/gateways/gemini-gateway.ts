import { LanguageModelGateway, TextGenerationParams } from './../interfaces';

export interface GeminiGatewayConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
}

export class GeminiGateway implements LanguageModelGateway {
    constructor(private config: GeminiGatewayConfig) {
        if (!config.apiKey) {
            console.warn('GeminiGateway: API key is missing. API calls will fail.');
        }
    }

    public static fromEnvironment(): GeminiGateway {
        return new GeminiGateway({
            apiKey: process.env.GEMINI_API_KEY || '',
            baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
            model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
        });
    }

    public async generateText(prompt: string, params?: TextGenerationParams): Promise<string> {
        if (!this.config.apiKey) {
            throw new Error('Gemini API key is not configured.');
        }

        const modelToUse = params?.modelOverride || this.config.model;
        const url = `${this.config.baseUrl}/${modelToUse}:generateContent?key=${this.config.apiKey}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ],
            generationConfig: {
                maxOutputTokens: params?.maxTokens || 1000,
                temperature: params?.temperature ?? 0.7
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();

            // Extract the text safely
            const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textOutput) {
                throw new Error('Failed to extract text from Gemini response.');
            }

            return textOutput;
        }
        catch (error) {
            console.error('Error generating content from Gemini:', error);
            throw error;
        }
    }
}
