import { AppLogger } from './../utility/logger';

export abstract class BaseLogic {
    constructor(protected logger: AppLogger) { }

    /**
     * Executes an operation with automatic logging of start, completion, and errors.
     * @param userId The ID of the user performing the operation.
     * @param context A short description or identifier for the operation (e.g., function name).
     * @param operation The asynchronous operation to execute.
     * @returns The result of the operation.
     * @throws Re-throws any error encountered during the operation after logging it.
     */
    protected async execute<T>(userId: string, context: string, operation: () => Promise<T>): Promise<T> {
        this.logger.info(userId, context, `Starting operation: ${context}`);
        try {
            const result = await operation();
            this.logger.info(userId, context, `Successfully completed operation: ${context}`);
            return result;
        }
        catch (error: any) {
            this.logger.error(userId, context, `Failed operation: ${context}. Error: ${error.message || error}`);
            throw error;
        }
    }
}
