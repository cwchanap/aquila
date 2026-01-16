import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, type LogEntry } from '../logger';

describe('Logger', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleDebugSpy = vi
            .spyOn(console, 'debug')
            .mockImplementation(() => {});
        originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleDebugSpy.mockRestore();
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('Log Level Filtering', () => {
        describe('in test environment', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'test';
            });

            it('suppresses debug logs', () => {
                logger.debug('test message');
                expect(consoleDebugSpy).not.toHaveBeenCalled();
            });

            it('suppresses info logs', () => {
                logger.info('test message');
                expect(consoleLogSpy).not.toHaveBeenCalled();
            });

            it('suppresses warn logs', () => {
                logger.warn('test message');
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            it('allows error logs', () => {
                logger.error('test error');
                expect(consoleErrorSpy).toHaveBeenCalled();
            });
        });

        describe('in development environment', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'development';
            });

            it('allows debug logs', () => {
                logger.debug('test message');
                expect(consoleDebugSpy).toHaveBeenCalled();
            });

            it('allows info logs', () => {
                logger.info('test message');
                expect(consoleLogSpy).toHaveBeenCalled();
            });

            it('allows warn logs', () => {
                logger.warn('test message');
                expect(consoleWarnSpy).toHaveBeenCalled();
            });

            it('allows error logs', () => {
                logger.error('test error');
                expect(consoleErrorSpy).toHaveBeenCalled();
            });
        });

        describe('in production environment', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'production';
            });

            it('suppresses debug logs', () => {
                logger.debug('test message');
                expect(consoleDebugSpy).not.toHaveBeenCalled();
            });

            it('allows info logs', () => {
                logger.info('test message');
                expect(consoleLogSpy).toHaveBeenCalled();
            });

            it('allows warn logs', () => {
                logger.warn('test message');
                expect(consoleWarnSpy).toHaveBeenCalled();
            });

            it('allows error logs', () => {
                logger.error('test error');
                expect(consoleErrorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('Development Output Format', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('includes timestamp and level in debug output', () => {
            logger.debug('test message');
            expect(consoleDebugSpy).toHaveBeenCalledWith(
                expect.stringContaining('[DEBUG]')
            );
            expect(consoleDebugSpy).toHaveBeenCalledWith(
                expect.stringContaining('test message')
            );
        });

        it('includes timestamp and level in info output', () => {
            logger.info('test message');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('[INFO]')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('test message')
            );
        });

        it('includes timestamp and level in warn output', () => {
            logger.warn('test message');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WARN]')
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('test message')
            );
        });

        it('includes timestamp and level in error output', () => {
            logger.error('test message');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]')
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('test message')
            );
        });

        it('includes context in output when provided', () => {
            logger.info('test message', { userId: '123', action: 'login' });
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('"userId":"123"')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('"action":"login"')
            );
        });

        it('excludes context from output when not provided', () => {
            logger.info('test message');
            const callArg = consoleLogSpy.mock.calls[0][0];
            expect(callArg).not.toContain('{}');
        });
    });

    describe('Production Output Format', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('outputs valid JSON for info logs', () => {
            logger.info('test message', { key: 'value' });
            const callArg = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(callArg) as LogEntry;

            expect(parsed.level).toBe('info');
            expect(parsed.message).toBe('test message');
            expect(parsed.context).toEqual({ key: 'value' });
            expect(parsed.timestamp).toBeDefined();
        });

        it('outputs valid JSON for warn logs', () => {
            logger.warn('warning message');
            const callArg = consoleWarnSpy.mock.calls[0][0];
            const parsed = JSON.parse(callArg) as LogEntry;

            expect(parsed.level).toBe('warn');
            expect(parsed.message).toBe('warning message');
        });

        it('outputs valid JSON for error logs', () => {
            logger.error('error message');
            const callArg = consoleErrorSpy.mock.calls[0][0];
            const parsed = JSON.parse(callArg) as LogEntry;

            expect(parsed.level).toBe('error');
            expect(parsed.message).toBe('error message');
        });

        it('excludes stack trace in production error logs', () => {
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at Object.<anonymous>';

            logger.error('failed operation', error);
            const callArg = consoleErrorSpy.mock.calls[0][0];
            const parsed = JSON.parse(callArg) as LogEntry;

            expect(parsed.error?.name).toBe('Error');
            expect(parsed.error?.message).toBe('Test error');
            expect(parsed.error?.stack).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('formats Error objects with name and message', () => {
            const error = new Error('Something went wrong');
            logger.error('Operation failed', error);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Operation failed')
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error: Something went wrong')
            );
        });

        it('includes stack trace in development', () => {
            const error = new Error('Test error');
            logger.error('failed', error);

            // Second call should be the stack trace
            expect(consoleErrorSpy).toHaveBeenCalledTimes(3); // message, error, stack
        });

        it('handles non-Error objects gracefully', () => {
            logger.error('failed', 'string error');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('failed')
            );
        });

        it('handles null/undefined errors gracefully', () => {
            logger.error('failed', null);
            logger.error('failed', undefined);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
        });

        it('includes error with context', () => {
            const error = new Error('DB connection failed');
            logger.error('Database error', error, { host: 'localhost' });

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('"host":"localhost"')
            );
        });
    });

    describe('Context Object Handling', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('handles empty context object', () => {
            logger.info('message', {});
            const callArg = consoleLogSpy.mock.calls[0][0];
            // Empty context should not add {} to output
            expect(callArg).not.toContain(' {}');
        });

        it('handles nested context objects', () => {
            logger.info('message', {
                user: { id: '123', name: 'test' },
                metadata: { version: 1 },
            });
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('"user"')
            );
        });

        it('handles arrays in context', () => {
            logger.info('message', { ids: ['a', 'b', 'c'] });
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('["a","b","c"]')
            );
        });

        it('handles numeric values in context', () => {
            logger.info('message', { count: 42, ratio: 3.14 });
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('"count":42')
            );
        });

        it('handles boolean values in context', () => {
            logger.info('message', { enabled: true, disabled: false });
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('"enabled":true')
            );
        });
    });

    describe('Logger Methods', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('debug() logs to console.debug', () => {
            logger.debug('debug message');
            expect(consoleDebugSpy).toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('info() logs to console.log', () => {
            logger.info('info message');
            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('warn() logs to console.warn', () => {
            logger.warn('warn message');
            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('error() logs to console.error', () => {
            logger.error('error message');
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('Timestamp', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('includes ISO timestamp in log entry', () => {
            logger.info('message');
            const callArg = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(callArg) as LogEntry;

            // Should be a valid ISO date string
            expect(parsed.timestamp).toMatch(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
            );
        });
    });
});
