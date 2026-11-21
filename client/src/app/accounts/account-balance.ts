import { AccountCategory, AccountType } from '@shared/finance/enum';
import { AccountTypeUtil } from '@shared/finance/util';

export function isLiability(type: AccountType): boolean {
    return AccountTypeUtil.categoryOf(type) === AccountCategory.Liability;
}

/**
 * Converts between a stored balance and the amount a form shows, either way: a liability's balance is stored
 * negative and shown as the amount owed (APP-6.3). `|| 0` keeps nothing owed from becoming -0.
 */
export function flipForLiability(type: AccountType, amount: number): number {
    return (isLiability(type) ? -amount : amount) || 0;
}
