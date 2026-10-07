import { AccountCategory } from './../enum/account-category';
import { AccountGroup } from './../enum/account-group';
import { AccountType } from './../enum/account-type';
import { AccountTypeUtil } from './account-type-util';

describe('AccountTypeUtil', () => {
    it('ACCT-1.2 should put every type in exactly one group', () => {
        const listed = AccountTypeUtil.groups.flatMap(info => info.types);
        expect([...listed].sort()).toEqual(Object.values(AccountType).sort());
    });

    it('ACCT-1.2 should list the groups in display order', () => {
        expect(AccountTypeUtil.groups.map(info => info.group)).toEqual([
            AccountGroup.Cash,
            AccountGroup.Investments,
            AccountGroup.Retirement,
            AccountGroup.RealEstate,
            AccountGroup.OtherAssets,
            AccountGroup.CreditCards,
            AccountGroup.Loans
        ]);
    });

    it('ACCT-1.2 should derive the group and Asset or Liability from the type', () => {
        expect(AccountTypeUtil.groupOf(AccountType.Checking)).toBe(AccountGroup.Cash);
        expect(AccountTypeUtil.groupOf(AccountType.RothIRA)).toBe(AccountGroup.Retirement);
        expect(AccountTypeUtil.groupOf(AccountType.Vehicle)).toBe(AccountGroup.OtherAssets);
        expect(AccountTypeUtil.categoryOf(AccountType.Vehicle)).toBe(AccountCategory.Asset);
        expect(AccountTypeUtil.categoryOf(AccountType.CreditCard)).toBe(AccountCategory.Liability);
        expect(AccountTypeUtil.categoryOf(AccountType.Mortgage)).toBe(AccountCategory.Liability);
    });

    it('ACCT-1.2 should list the types that are liabilities', () => {
        expect(AccountTypeUtil.typesIn(AccountCategory.Liability)).toEqual([
            AccountType.CreditCard,
            AccountType.Mortgage,
            AccountType.HELOC,
            AccountType.AutoLoan,
            AccountType.StudentLoan,
            AccountType.PersonalLoan,
            AccountType.OtherLoan
        ]);
    });
});
