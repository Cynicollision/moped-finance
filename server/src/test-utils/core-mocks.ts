import { LanguageModelGateway } from './../core/interfaces';

export class CoreMockUtil {
    public static createMockLlmGateway(): jest.Mocked<LanguageModelGateway> {
        return {
            generateText: jest.fn()
        } as any;
    }
}
