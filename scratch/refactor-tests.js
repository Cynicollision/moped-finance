const fs = require('fs');

const testFiles = [
    'c:/code/HomeLab/server/src/api/accounts/account-routes.spec.ts',
    'c:/code/HomeLab/server/src/api/budget/budget-stream-routes.spec.ts',
    'c:/code/HomeLab/server/src/api/categories/category-routes.spec.ts',
    'c:/code/HomeLab/server/src/api/institutions/institution-routes.spec.ts',
    'c:/code/HomeLab/server/src/api/transactions/transaction-routes.spec.ts',
    'c:/code/HomeLab/server/src/auth/auth-routes.spec.ts'
];

testFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;

    // 1. Replace afterAll with TestDatabaseUtil.destroyMockDatabase
    // We match a block like:
    // afterAll(async () => {
    //     if (pglite) {
    //         await pglite.close();
    //     }
    // });
    const afterAllRegex = /afterAll\(async\s*\(\)\s*=>\s*\{\s*if\s*\(pglite\)\s*\{\s*await\s*pglite\.close\(\);\s*\}\s*\}\);/g;
    content = content.replace(afterAllRegex, 'afterAll(async () => {\n        await TestDatabaseUtil.destroyMockDatabase(pglite);\n    });');

    // 2. Replace TRUNCATE finance... CASCADE;
    const truncateRegex = /await\s*pglite\.exec\('TRUNCATE\s+finance\.[^']+CASCADE;?'\);/g;
    content = content.replace(truncateRegex, 'await TestDatabaseUtil.clearFinanceData(pglite);');

    // 3. Replace DELETE FROM core.users
    const deleteRegex = /await\s*pglite\.exec\('DELETE\s+FROM\s+core\.users;?'\);/g;
    content = content.replace(deleteRegex, 'await TestDatabaseUtil.clearCoreData(pglite);');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
});
