import type { ChoiceDefinition, DialogueEntry, Locale } from '@aquila/stories';
import { isLocale, SUPPORTED_LOCALES } from '@aquila/stories/translations';
import { getBrowserStorage } from './reader-mode';

/** A language shown under every story line for language learners, or off. */
export type SecondLanguage = Locale | 'off';

export const READER_SECOND_LANGUAGE_KEY = 'aquila:reader-second-language:v1';

export function readSecondLanguage(
    storage: Storage | null = getBrowserStorage()
): SecondLanguage {
    try {
        const value = storage?.getItem(READER_SECOND_LANGUAGE_KEY);
        return isLocale(value) ? value : 'off';
    } catch {
        return 'off';
    }
}

export function writeSecondLanguage(
    value: SecondLanguage,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        if (value === 'off') {
            storage?.removeItem(READER_SECOND_LANGUAGE_KEY);
        } else {
            storage?.setItem(READER_SECOND_LANGUAGE_KEY, value);
        }
    } catch {
        return;
    }
}

/** Second-language choices offered while reading text in `textLocale`. */
export function secondLanguageOptions(textLocale: Locale): Locale[] {
    return SUPPORTED_LOCALES.filter(locale => locale !== textLocale);
}

/** The translated line for each main line, or null when the translation
 *  does not line up (a stale or mismatched scene). Translations mirror the
 *  zh source entry for entry, so line N pairs with line N. */
export function alignSecondDialogue(
    dialogue: readonly DialogueEntry[],
    second: readonly DialogueEntry[] | undefined
): DialogueEntry[] | null {
    if (!second || second.length !== dialogue.length) return null;
    return [...second];
}

export type SecondChoiceLabels = {
    prompt: string;
    /** Second-language option labels keyed by option id. */
    labels: Record<string, string>;
};

/** Second-language prompt and labels for the choice being shown. */
export function secondChoiceLabels(
    choice: ChoiceDefinition | null,
    second: ChoiceDefinition | null | undefined
): SecondChoiceLabels | null {
    if (!choice || !second) return null;
    const labels: Record<string, string> = {};
    for (const option of second.options) labels[option.id] = option.label;
    return { prompt: second.prompt, labels };
}
