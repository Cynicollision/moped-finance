export enum CategoryType {
    Income = 'Income',
    Expense = 'Expense',
    Transfer = 'Transfer'
}

export type Category = {
    id: string;
    profileId: string;
    type: CategoryType;
    group: string;
    icon: string;
    name: string;
};