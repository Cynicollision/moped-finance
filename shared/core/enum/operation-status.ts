export enum OperationStatus {
    NotStarted = 'NotStarted',
    Success = 'Success',
    SuccessCreated = 'SuccessCreated',
    SuccessAccepted = 'SuccessAccepted',
    SuccessUpdated = 'SuccessUpdated',
    SuccessDeleted = 'SuccessDeleted',
    UnhandledError = 'UnhandledError',
    UserError = 'UserError',
    NotFound = 'NotFound',
    Forbidden = 'Forbidden',
    Unauthorized = 'Unauthorized',
}