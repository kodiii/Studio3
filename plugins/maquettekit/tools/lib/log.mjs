// @ts-check
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
export const color = {
  dim: (s) => c(2, s), bold: (s) => c(1, s), red: (s) => c(31, s), green: (s) => c(32, s),
  yellow: (s) => c(33, s), cyan: (s) => c(36, s),
};
let quiet = false;
export function setQuiet(q) { quiet = !!q; }
/** Human-facing progress goes to stderr so stdout stays machine-readable (JSON). */
export const log = {
  info: (...a) => { if (!quiet) console.error(...a); },
  step: (s) => { if (!quiet) console.error(color.cyan('›'), s); },
  ok: (s) => { if (!quiet) console.error(color.green('✔'), s); },
  warn: (s) => console.error(color.yellow('!'), s),
  error: (s) => console.error(color.red('✖'), s),
};
/** Error whose message is shown without a stack trace. @extends Error */
export class UserError extends Error {
  /** @param {string} message @param {number} [exitCode] */
  constructor(message, exitCode = 2) { super(message); this.name = 'UserError'; this.exitCode = exitCode; }
}
