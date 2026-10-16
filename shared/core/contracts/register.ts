/** Registering the instance's one user (AUTH-2). */
export interface RegisterRequest {
    username: string;
    /** The display name. */
    name: string;
    password: string;
    /** Start with the default categories (CAT-6.2), or with none. */
    defaultCategories: boolean;
}
