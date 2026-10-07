import { AccountCategory } from './../enum/account-category';
import { AccountGroup } from './../enum/account-group';
import { AccountType } from './../enum/account-type';

export interface AccountGroupInfo {
    group: AccountGroup;
    category: AccountCategory;
    types: readonly AccountType[];
}

// ACCT-1.2: the type decides the group, and the group decides Asset or Liability. Display order (DASH-2.1).
const groups: readonly AccountGroupInfo[] = [
    {
        group: AccountGroup.Cash,
        category: AccountCategory.Asset,
        types: [
            AccountType.Checking,
            AccountType.Savings,
            AccountType.MoneyMarket,
            AccountType.CD,
            AccountType.OtherCash
        ]
    },
    {
        group: AccountGroup.Investments,
        category: AccountCategory.Asset,
        types: [AccountType.Brokerage, AccountType.HSA, AccountType.Plan529, AccountType.OtherInvestment]
    },
    {
        group: AccountGroup.Retirement,
        category: AccountCategory.Asset,
        types: [AccountType.Retirement401k, AccountType.IRA, AccountType.RothIRA, AccountType.OtherRetirement]
    },
    {
        group: AccountGroup.RealEstate,
        category: AccountCategory.Asset,
        types: [AccountType.PrimaryResidence, AccountType.RentalProperty, AccountType.OtherProperty]
    },
    {
        group: AccountGroup.OtherAssets,
        category: AccountCategory.Asset,
        types: [AccountType.Vehicle, AccountType.OtherAsset]
    },
    {
        group: AccountGroup.CreditCards,
        category: AccountCategory.Liability,
        types: [AccountType.CreditCard]
    },
    {
        group: AccountGroup.Loans,
        category: AccountCategory.Liability,
        types: [
            AccountType.Mortgage,
            AccountType.HELOC,
            AccountType.AutoLoan,
            AccountType.StudentLoan,
            AccountType.PersonalLoan,
            AccountType.OtherLoan
        ]
    }
];

const groupByType = new Map(groups.flatMap(info => info.types.map(type => [type, info] as const)));

export class AccountTypeUtil {
    /** Every group in display order, with its Asset/Liability and its types (ACCT-1.2). */
    public static readonly groups = groups;

    /** The group a type belongs to. */
    public static groupOf(type: AccountType): AccountGroup {
        return AccountTypeUtil.infoOf(type).group;
    }

    /** Whether a type is an Asset or a Liability. */
    public static categoryOf(type: AccountType): AccountCategory {
        return AccountTypeUtil.infoOf(type).category;
    }

    /** Every type that's an Asset, or every type that's a Liability. */
    public static typesIn(category: AccountCategory): AccountType[] {
        return groups.filter(info => info.category === category).flatMap(info => info.types);
    }

    private static infoOf(type: AccountType): AccountGroupInfo {
        const info = groupByType.get(type);
        if (!info) {
            throw new Error(`Unknown account type: ${type}`);
        }
        return info;
    }
}
