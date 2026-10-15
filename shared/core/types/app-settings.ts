import { AppTheme } from './../enum/app-theme';

/** The instance's settings (SET-1.2). Every field has a default, used until the user changes it. */
export interface AppSettings {
    /** How the app looks (SET-3.1). */
    theme: AppTheme;
    /** The Dashboard lists Retirement as its own group; off folds it into Investments (SET-5.1). */
    showRetirementGroup: boolean;
}
