/**
 * Conditional logger that only logs in development mode.
 * Use this instead of console.log to avoid performance overhead in production.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  table: (data: unknown) => {
    if (isDev) console.table(data);
  },
  group: (label: string) => {
    if (isDev) console.group(label);
  },
  groupEnd: () => {
    if (isDev) console.groupEnd();
  },
  time: (label: string) => {
    if (isDev) console.time(label);
  },
  timeEnd: (label: string) => {
    if (isDev) console.timeEnd(label);
  }
};

export default logger;
