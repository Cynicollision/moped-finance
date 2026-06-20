export interface TextGenerationParams {
    modelOverride?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface LanguageModelGateway {
    generateText(prompt: string, params?: TextGenerationParams): Promise<string>;
}