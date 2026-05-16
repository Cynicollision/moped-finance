import { LanguageModelGateway, TextGenerationParams } from '@core/interfaces';

export interface GeminiGatewayConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
}

const GEMINI_CONFIG_ERROR = 'Gemini configuration not found in environment variables.';

export class GeminiGateway implements LanguageModelGateway {
    constructor(private config: GeminiGatewayConfig) {
        if (!config.apiKey || !config.baseUrl || !config.model) {
            throw new Error(GEMINI_CONFIG_ERROR);
        }
    }

    public static fromEnvironment(): GeminiGateway {
        const apiKey = process.env.GEMINI_API_KEY;
        const baseUrl = process.env.GEMINI_BASE_URL;
        const model = process.env.GEMINI_MODEL;

        if (!apiKey || !baseUrl || !model) {
            throw new Error(GEMINI_CONFIG_ERROR);
        }

        return new GeminiGateway({
            apiKey,
            baseUrl,
            model
        });
    }

    public async generateText(prompt: string, params?: TextGenerationParams): Promise<string> {
        if (!this.config.apiKey || !this.config.baseUrl || !this.config.model) {
            throw new Error(GEMINI_CONFIG_ERROR);
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
