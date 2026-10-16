// Sets a new password when the owner has forgotten theirs (AUTH-12). Run it on the host:
//   production image: docker exec -it moped-finance-api npm run reset-password
//   development:      docker compose exec api npm run reset-password:dev
// With input piped in instead of a terminal, it reads the password and its confirmation from the first two lines.
import { PasswordReset, UserData } from '@server/auth';
import { DatabaseClient } from '@server/data';

class Cancelled extends Error {}

interface PasswordInput {
    /** Whether a refused password can be asked for again (a terminal), or ends the command (piped input). */
    readonly canAskAgain: boolean;
    ask(prompt: string): Promise<string>;
}

/** Reads from the terminal without showing what's typed. Ctrl+C or Ctrl+D cancels. */
class TerminalInput implements PasswordInput {
    readonly canAskAgain = true;

    ask(prompt: string): Promise<string> {
        const stdin = process.stdin;
        process.stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.setEncoding('utf8');
        stdin.resume();

        return new Promise((resolve, reject) => {
            let value = '';
            const finish = () => {
                stdin.off('data', onData);
                stdin.setRawMode(false);
                stdin.pause();
                process.stdout.write('\n');
            };
            const onData = (chunk: string) => {
                // Arrow and other special keys arrive as escape sequences; they aren't part of a password
                if (chunk.startsWith('\u001b')) {
                    return;
                }
                for (const char of Array.from(chunk)) {
                    if (char === '\r' || char === '\n') {
                        finish();
                        resolve(value);
                        return;
                    }
                    if (char === '\u0003' || char === '\u0004') {
                        finish();
                        reject(new Cancelled());
                        return;
                    }
                    if (char === '\u007f' || char === '\b') {
                        value = Array.from(value).slice(0, -1).join('');
                    } else if (char >= ' ') {
                        value += char;
                    }
                }
            };
            stdin.on('data', onData);
        });
    }
}

/** Reads the answers, one per line, from piped input (AUTH-12.5). */
class PipedInput implements PasswordInput {
    readonly canAskAgain = false;

    private constructor(private readonly lines: string[]) {}

    static async read(): Promise<PipedInput> {
        let text = '';
        process.stdin.setEncoding('utf8');
        for await (const chunk of process.stdin) {
            text += chunk;
        }
        return new PipedInput(text.split(/\r?\n/));
    }

    async ask(prompt: string): Promise<string> {
        const line = this.lines.shift();
        if (line === undefined) {
            throw new Error(
                `No input for '${prompt.trim()}': pipe in the new password and its confirmation, one per line.`
            );
        }
        return line;
    }
}

async function resetPassword(dbClient: DatabaseClient): Promise<number> {
    const reset = new PasswordReset(new UserData(dbClient));
    const user = await reset.owner();
    if (!user) {
        console.error('There is no user yet, so registration is still open. Register in the app instead.');
        return 1;
    }

    console.log(`Setting a new password for ${user.username} (${user.displayName}).`);
    const input: PasswordInput = process.stdin.isTTY ? new TerminalInput() : await PipedInput.read();

    for (;;) {
        const password = await input.ask('New password: ');
        const confirmation = await input.ask('Confirm new password: ');
        const problems = reset.problems(user, password, confirmation);
        if (problems.length === 0) {
            await reset.reset(user, password);
            console.log('Password changed. Every device was signed out; API tokens still work.');
            console.log(
                'If sign-in is refused for too many failed attempts, restart the app: docker restart moped-finance-api'
            );
            return 0;
        }

        problems.forEach(problem => console.error(problem));
        if (!input.canAskAgain) {
            return 1;
        }
    }
}

async function main(): Promise<void> {
    const dbClient = DatabaseClient.fromEnvironment();
    let exitCode = 1;
    try {
        exitCode = await resetPassword(dbClient);
    } catch (error) {
        if (error instanceof Cancelled) {
            console.log('Cancelled. The password was not changed.');
        } else {
            console.error(`Could not reset the password: ${error instanceof Error ? error.message : String(error)}`);
        }
    } finally {
        await dbClient.close().catch(() => undefined);
    }
    process.exit(exitCode);
}

main();
