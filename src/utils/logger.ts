const isDev = process.env.NODE_ENV === 'development';

type LoggerOptions = {
    prod?: boolean;
};

function log(...args: any[]): void;
function log(options: LoggerOptions, ...args: any[]): void;
function log(...args: any[]) {
    if (typeof args[0] === 'object' && args[0] !== null && 'prod' in args[0] && !Array.isArray(args[0])) {
        const [options, ...rest] = args;
        if (options.prod) {
            console.log('[PROD LOG]', ...rest);
        }
    } else {
        if (!isDev) {
            return;
        }
        console.log('[DEV LOG]', ...args);
    }
}

function error(...args: any[]): void;
function error(options: LoggerOptions, ...args: any[]): void;
function error(...args: any[]) {
    if (typeof args[0] === 'object' && args[0] !== null && 'prod' in args[0] && !Array.isArray(args[0])) {
        const [options, ...rest] = args;
        if (options.prod) {
            console.error('[PROD ERROR]', ...rest);
        }
    } else {
        if (!isDev) {
            return;
        }
        console.error('[DEV ERROR]', ...args);
    }
}

function warn(...args: any[]): void;
function warn(options: LoggerOptions, ...args: any[]): void;
function warn(...args: any[]) {
    if (typeof args[0] === 'object' && args[0] !== null && 'prod' in args[0] && !Array.isArray(args[0])) {
        const [options, ...rest] = args;
        if (options.prod) {
            console.warn('[PROD WARN]', ...rest);
        }
    } else {
        if (!isDev) {
            return;
        }
        console.warn('[DEV WARN]', ...args);
    }
}

const logger = {
    log,
    error,
    warn,
};

export default logger;
