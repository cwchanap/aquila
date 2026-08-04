/**
 * Keeps release-gate results in the existing assets command exit taxonomy.
 * This module is deliberately dependency-free so command routing does not
 * eagerly load report rendering or evidence I/O.
 */
function isDiagnosticCategory(code: string, category: string): boolean {
    return code === category || code.startsWith(`${category}/`);
}

export function gateDiagnosticExitCode(code: string): 1 | 2 | 3 | 4 | 5 {
    if (isDiagnosticCategory(code, 'configuration')) return 1;
    if (
        isDiagnosticCategory(code, 'storage') ||
        isDiagnosticCategory(code, 'environment') ||
        isDiagnosticCategory(code, 'prerequisite')
    ) {
        return 3;
    }
    if (isDiagnosticCategory(code, 'concurrency')) return 4;
    if (
        isDiagnosticCategory(code, 'activation-target') ||
        isDiagnosticCategory(code, 'operation') ||
        code === 'clock-skew' ||
        code === 'non-monotonic-pointer-time'
    ) {
        return 5;
    }
    return 2;
}
