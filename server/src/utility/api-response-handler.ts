import { Response } from 'express';
import { OperationResult } from '@shared/types/common/operation-response';
import { OperationResultFactory } from './operation-result-factory';

export class ApiResponseHandler {
  public static succeed<T>(res: Response, response?: OperationResult<T>): void {
    res.status(200).json(response);
  }

  // TODO: accept OperationResult<T> instead?
  public static error(res: Response, error: unknown): void {
    if (error instanceof Error && error.name === 'AuthenticationError') {
      const result = OperationResultFactory.error('UNAUTHORIZED', error.message);
      res.status(401).json(result);
    }
    else {
      const result = OperationResultFactory.error('INTERNAL_ERROR', 'An unexpected error occurred');
      res.status(500).json(result);
    }
  }
}