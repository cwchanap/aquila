/**
 * Centralized logging utility for consistent log formatting and control.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Failed to fetch data', error, { endpoint: '/api/users' });
 *
 * Log level filtering (based on NODE_ENV):
 *   - production: logs "info", "warn", and "error" (info+)
 *   - development/other: logs "debug", "info", "warn", and "error" (debug+)
 *   - test: logs "error" only
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: unknown;
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function getMinLogLevel(): LogLevel {
    const env = process.env.NODE_ENV;
    if (env === 'production') return 'info';
    if (env === 'test') return 'error';
    return 'debug';
}

function shouldLog(level: LogLevel): boolean {
    const minLevel = getMinLogLevel();
    return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatError(error: Error): {
    name: string;
    message: string;
    stack?: string;
} {
    return {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    };
}

function createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
): LogEntry {
    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
        entry.context = context;
    }

    if (error) {
        entry.error = formatError(error);
    }

    return entry;
}

function logToConsole(entry: LogEntry): void {
    const { level, message, timestamp, context, error } = entry;

    // In production, output structured JSON for log aggregators
    if (process.env.NODE_ENV === 'production') {
        const output = JSON.stringify(entry);
        switch (level) {
            case 'error':
                console.error(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            default:
                console.log(output);
        }
        return;
    }

    // In development, output human-readable format
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';

    switch (level) {
        case 'error':
            console.error(`${prefix} ${message}${contextStr}`);
            if (error) {
                console.error(`  Error: ${error.name}: ${error.message}`);
                if (error.stack) {
                    console.error(`  Stack: ${error.stack}`);
                }
            }
            break;
        case 'warn':
            console.warn(`${prefix} ${message}${contextStr}`);
            break;
        case 'debug':
            console.debug(`${prefix} ${message}${contextStr}`);
            break;
        default:
            console.log(`${prefix} ${message}${contextStr}`);
    }
}

export const logger = {
    debug(message: string, context?: LogContext): void {
        if (!shouldLog('debug')) return;
        const entry = createLogEntry('debug', message, context);
        logToConsole(entry);
    },

    info(message: string, context?: LogContext): void {
        if (!shouldLog('info')) return;
        const entry = createLogEntry('info', message, context);
        logToConsole(entry);
    },

    warn(message: string, context?: LogContext): void {
        if (!shouldLog('warn')) return;
        const entry = createLogEntry('warn', message, context);
        logToConsole(entry);
    },

    error(
        message: string,
        error?: Error | unknown,
        context?: LogContext
    ): void {
        if (!shouldLog('error')) return;
        const err = error instanceof Error ? error : undefined;
        const entry = createLogEntry('error', message, context, err);
        logToConsole(entry);
    },
};

export type { LogLevel, LogContext, LogEntry };
