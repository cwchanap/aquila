/**
 * Unix permission tests rely on `chmod 0o000` to make files unreadable. That
 * enforcement does not hold for the root user (root bypasses read permission
 * checks) and is not meaningful on Windows (which has no Unix permission bits).
 * Tests that assert EACCES/exit-3 from unreadable files must skip when this is
 * true.
 */
export const cannotEnforceFilePermissions =
    process.platform === 'win32' ||
    (typeof process.getuid === 'function' && process.getuid() === 0);
