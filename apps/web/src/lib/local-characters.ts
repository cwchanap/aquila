export const ALLOWED_STORIES = ['train_adventure'] as const;
export type AllowedStoryId = (typeof ALLOWED_STORIES)[number];

// Import validation constants from the centralized validation module
import { CHARACTER_NAME_MAX_LENGTH, CHARACTER_NAME_REGEX } from './validation';

export type CharacterTranslations = {
    playStory: string;
    edit: string;
    save: string;
    cancel: string;
    noLocalCharacters: string;
    startFirstStory: string;
    errorLoadingLocalCharacters: string;
    nameRequired: string;
    invalidName: string;
    updateFailed: string;
};

type NameValidationResult =
    | { valid: true; value: string }
    | { valid: false; reason: 'empty' | 'invalid' };

export const validateAndClampName = (rawName: string): NameValidationResult => {
    const trimmed = rawName.trim();
    if (!trimmed) {
        return { valid: false, reason: 'empty' };
    }
    const clampedName = trimmed.slice(0, CHARACTER_NAME_MAX_LENGTH);
    if (!CHARACTER_NAME_REGEX.test(clampedName)) {
        return { valid: false, reason: 'invalid' };
    }
    return { valid: true, value: clampedName };
};

export function createCharacterCard(
    characterName: string,
    storyId: string,
    translations: CharacterTranslations,
    locale: string = 'en'
): HTMLDivElement {
    if (!ALLOWED_STORIES.includes(storyId as AllowedStoryId)) {
        console.warn(
            `[Security] Invalid storyId detected: "${storyId}". Skipping this character.`
        );
        throw new Error(`Invalid story ID: ${storyId}`);
    }

    const card = document.createElement('div');
    card.className =
        'bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/60 hover:bg-white/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]';
    card.setAttribute('data-local-character', 'true');
    card.setAttribute('data-story-id', storyId);

    const header = document.createElement('div');
    header.className = 'flex items-center gap-4 mb-6';

    const avatar = document.createElement('div');
    avatar.className =
        'w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold character-avatar shadow-lg border-2 border-white/30';
    avatar.textContent = characterName.charAt(0).toUpperCase();

    const info = document.createElement('div');
    info.className = 'flex-1';

    const nameDisplay = document.createElement('h3');
    nameDisplay.className =
        'text-2xl font-bold text-slate-800 character-name-display tracking-wide';
    nameDisplay.style.fontFamily = "'Orbitron', monospace";
    nameDisplay.textContent = characterName;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className =
        'character-name-input w-full bg-white/70 border-2 border-slate-300/60 rounded-xl text-slate-800 placeholder-slate-500 px-4 py-2 text-2xl font-bold hidden shadow-lg';
    nameInput.value = characterName;
    nameInput.maxLength = CHARACTER_NAME_MAX_LENGTH;
    nameInput.style.fontFamily = "'Orbitron', monospace";

    const storyLabel = document.createElement('p');
    storyLabel.className =
        'text-slate-600 text-sm capitalize font-semibold tracking-wider mt-1';
    storyLabel.style.fontFamily = "'Exo 2', sans-serif";
    storyLabel.textContent = storyId.replace('_', ' ');

    info.appendChild(nameDisplay);
    info.appendChild(nameInput);
    info.appendChild(storyLabel);
    header.appendChild(avatar);
    header.appendChild(info);

    const buttons = document.createElement('div');
    buttons.className = 'flex gap-3 flex-wrap';

    const playLink = document.createElement('a');
    playLink.href = `/${locale}/story/${encodeURIComponent(storyId)}`;
    playLink.className =
        'character-play-link flex-1 min-w-0 py-3 px-6 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 hover:from-blue-600 hover:via-cyan-500 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.05] text-center border-2 border-cyan-300/50';
    playLink.style.cssText =
        "font-family: 'Orbitron', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.3);";
    playLink.textContent = translations.playStory;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className =
        'character-edit-btn py-3 px-6 bg-gradient-to-r from-slate-200 to-white hover:from-white hover:to-slate-100 text-slate-700 hover:text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-slate-300/60';
    editBtn.style.fontFamily = "'Orbitron', monospace";
    editBtn.textContent = translations.edit;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className =
        'character-save-btn py-3 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-green-400/50 hidden';
    saveBtn.style.cssText =
        "font-family: 'Orbitron', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.3);";
    saveBtn.textContent = translations.save;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className =
        'character-cancel-btn py-3 px-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-400/50 hidden';
    cancelBtn.style.cssText =
        "font-family: 'Orbitron', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.3);";
    cancelBtn.textContent = translations.cancel;

    buttons.appendChild(playLink);
    buttons.appendChild(editBtn);
    buttons.appendChild(saveBtn);
    buttons.appendChild(cancelBtn);

    card.appendChild(header);
    card.appendChild(buttons);

    return card;
}

export function createEmptyState(
    translations: CharacterTranslations,
    locale: string = 'en'
): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'text-center py-12';

    const message = document.createElement('div');
    message.className = 'text-slate-600 text-xl mb-6 font-semibold';
    message.style.fontFamily = "'Exo 2', sans-serif";
    message.textContent = translations.noLocalCharacters;

    const link = document.createElement('a');
    link.href = `/${locale}/stories`;
    link.className =
        'group relative inline-block py-6 px-8 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 hover:from-blue-600 hover:via-cyan-500 hover:to-blue-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.05] hover:-translate-y-2 border-2 border-cyan-300/50 overflow-hidden';
    link.style.cssText =
        "font-family: 'Orbitron', 'Exo 2', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.3);";

    const span = document.createElement('span');
    span.className = 'relative text-lg tracking-wider uppercase font-black';
    span.textContent = translations.startFirstStory;
    link.appendChild(span);

    container.appendChild(message);
    container.appendChild(link);
    return container;
}

export function createErrorState(
    translations: CharacterTranslations
): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'text-center py-12';

    const errorDiv = document.createElement('div');
    errorDiv.className =
        'text-red-600 text-lg font-semibold bg-red-100 rounded-lg p-4 border border-red-300';
    errorDiv.style.fontFamily = "'Exo 2', sans-serif";
    errorDiv.textContent = translations.errorLoadingLocalCharacters;

    container.appendChild(errorDiv);
    return container;
}

type CardWithEditController = HTMLElement & {
    _editAbortController?: AbortController;
};

export function setupEditHandler(
    card: HTMLElement,
    translations: CharacterTranslations,
    locale: string = 'en'
): void {
    const editBtn = card.querySelector('.character-edit-btn');
    if (!editBtn) return;

    editBtn.addEventListener('click', () => {
        const nameDisplay = card.querySelector(
            '.character-name-display'
        ) as HTMLElement;
        const nameInput = card.querySelector(
            '.character-name-input'
        ) as HTMLInputElement;
        const editButton = card.querySelector(
            '.character-edit-btn'
        ) as HTMLElement;
        const saveBtn = card.querySelector(
            '.character-save-btn'
        ) as HTMLElement;
        const cancelBtn = card.querySelector(
            '.character-cancel-btn'
        ) as HTMLElement;
        const playLink = card.querySelector(
            '.character-play-link'
        ) as HTMLElement;

        if (nameDisplay && nameInput && editButton && saveBtn && cancelBtn) {
            const cardWithController = card as CardWithEditController;
            if (cardWithController._editAbortController) {
                cardWithController._editAbortController.abort();
            }

            const abortController = new AbortController();
            cardWithController._editAbortController = abortController;
            const { signal } = abortController;

            const originalName = nameDisplay.textContent || '';
            const storyId = card.getAttribute('data-story-id');

            nameDisplay.classList.add('hidden');
            nameInput.classList.remove('hidden');
            editButton.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');
            playLink.classList.add('hidden');

            nameInput.focus();
            nameInput.select();

            const handleSave = () => {
                const validation = validateAndClampName(nameInput.value);
                if (!validation.valid) {
                    const message =
                        validation.reason === 'empty'
                            ? translations.nameRequired
                            : translations.invalidName;
                    alert(message);
                    return;
                }

                const newName = validation.value;
                if (!newName) return;
                nameInput.value = newName;

                if (storyId) {
                    localStorage.setItem(
                        `aquila:character:${storyId}`,
                        JSON.stringify({ characterName: newName })
                    );
                    nameDisplay.textContent = newName;
                    const avatar = card.querySelector('.character-avatar');
                    if (avatar) {
                        avatar.textContent = newName.charAt(0).toUpperCase();
                    }
                    playLink.setAttribute(
                        'href',
                        `/${locale}/story/${encodeURIComponent(storyId)}`
                    );
                }

                nameDisplay.classList.remove('hidden');
                nameInput.classList.add('hidden');
                editButton.classList.remove('hidden');
                saveBtn.classList.add('hidden');
                cancelBtn.classList.add('hidden');
                playLink.classList.remove('hidden');

                abortController.abort();
            };

            const handleCancel = () => {
                nameInput.value = originalName;
                nameDisplay.classList.remove('hidden');
                nameInput.classList.add('hidden');
                editButton.classList.remove('hidden');
                saveBtn.classList.add('hidden');
                cancelBtn.classList.add('hidden');
                playLink.classList.remove('hidden');

                abortController.abort();
            };

            saveBtn.addEventListener('click', handleSave, { signal });
            cancelBtn.addEventListener('click', handleCancel, { signal });

            nameInput.addEventListener(
                'keydown',
                event => {
                    if (event.key === 'Enter') {
                        handleSave();
                    } else if (event.key === 'Escape') {
                        handleCancel();
                    }
                },
                { signal }
            );
        }
    });
}

type CardWithRemoteEditController = HTMLElement & {
    _remoteEditAbortController?: AbortController;
};

function setupRemoteEditHandler(
    card: HTMLElement,
    translations: CharacterTranslations,
    locale: string = 'en'
): void {
    const editBtn = card.querySelector('.character-edit-btn');
    if (!editBtn) return;

    editBtn.addEventListener('click', () => {
        const nameDisplay = card.querySelector(
            '.character-name-display'
        ) as HTMLElement;
        const nameInput = card.querySelector(
            '.character-name-input'
        ) as HTMLInputElement;
        const editButton = card.querySelector(
            '.character-edit-btn'
        ) as HTMLElement;
        const saveBtn = card.querySelector(
            '.character-save-btn'
        ) as HTMLElement;
        const cancelBtn = card.querySelector(
            '.character-cancel-btn'
        ) as HTMLElement;
        const playLink = card.querySelector(
            '.character-play-link'
        ) as HTMLElement;

        if (nameDisplay && nameInput && editButton && saveBtn && cancelBtn) {
            const cardWithController = card as CardWithRemoteEditController;
            if (cardWithController._remoteEditAbortController) {
                cardWithController._remoteEditAbortController.abort();
            }

            const abortController = new AbortController();
            cardWithController._remoteEditAbortController = abortController;
            const { signal } = abortController;

            const originalName = nameDisplay.textContent || '';
            const storyId = card.getAttribute('data-story-id');

            nameDisplay.classList.add('hidden');
            nameInput.classList.remove('hidden');
            editButton.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');
            playLink.classList.add('hidden');

            nameInput.focus();
            nameInput.select();

            const handleSave = async () => {
                const validation = validateAndClampName(nameInput.value);
                if (!validation.valid) {
                    const message =
                        validation.reason === 'empty'
                            ? translations.nameRequired
                            : translations.invalidName;
                    alert(message);
                    return;
                }

                const newName = validation.value;
                nameInput.value = newName;

                try {
                    const response = await fetch('/api/character-setup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            characterName: newName,
                            storyId: storyId,
                        }),
                    });

                    if (!response.ok) {
                        const error = await response.json().catch(() => null);
                        throw new Error(
                            (error as { error?: string } | null)?.error ||
                                'Failed to update character name. Please try again.'
                        );
                    }

                    nameDisplay.textContent = newName;
                    const avatar = card.querySelector('.character-avatar');
                    if (avatar) {
                        avatar.textContent = newName.charAt(0).toUpperCase();
                    }

                    if (playLink && storyId) {
                        playLink.setAttribute(
                            'href',
                            `/${locale}/story/${storyId}`
                        );
                    }

                    nameDisplay.classList.remove('hidden');
                    nameInput.classList.add('hidden');
                    editButton.classList.remove('hidden');
                    saveBtn.classList.add('hidden');
                    cancelBtn.classList.add('hidden');
                    playLink.classList.remove('hidden');

                    abortController.abort();
                } catch (error) {
                    console.error('Error updating character:', error);
                    alert(translations.updateFailed);
                }
            };

            const handleCancel = () => {
                nameInput.value = originalName;
                nameDisplay.classList.remove('hidden');
                nameInput.classList.add('hidden');
                editButton.classList.remove('hidden');
                saveBtn.classList.add('hidden');
                cancelBtn.classList.add('hidden');
                playLink.classList.remove('hidden');

                abortController.abort();
            };

            saveBtn.addEventListener('click', () => void handleSave(), {
                signal,
            });
            cancelBtn.addEventListener('click', handleCancel, { signal });

            nameInput.addEventListener(
                'keydown',
                event => {
                    if (event.key === 'Enter') {
                        void handleSave();
                    } else if (event.key === 'Escape') {
                        handleCancel();
                    }
                },
                { signal }
            );
        }
    });
}

function setupAuthenticatedCharacterEditing(
    translations: CharacterTranslations,
    locale: string = 'en'
): void {
    document.addEventListener('DOMContentLoaded', () => {
        document
            .querySelectorAll('.character-edit-btn')
            .forEach((button: Element) => {
                const card = (button as HTMLElement).closest(
                    '[data-character-id]'
                );
                if (!card) return;
                setupRemoteEditHandler(
                    card as HTMLElement,
                    translations,
                    locale
                );
            });
    });
}

function loadLocalCharacters(
    translations: CharacterTranslations,
    locale: string = 'en'
): void {
    if (document.querySelector('[data-user]')) {
        return;
    }

    const localCharactersContainer =
        document.getElementById('local-characters');
    if (!localCharactersContainer) {
        return;
    }

    try {
        const localChars: { characterName: string; storyId: string }[] = [];

        ALLOWED_STORIES.forEach(story => {
            const local = localStorage.getItem(`aquila:character:${story}`);
            if (local) {
                try {
                    const { characterName } = JSON.parse(local);
                    if (typeof characterName === 'string') {
                        const validation = validateAndClampName(characterName);
                        if (validation.valid) {
                            localChars.push({
                                characterName: validation.value,
                                storyId: story,
                            });
                        } else {
                            console.warn(
                                `[Validation] Invalid character name skipped: "${characterName}"`
                            );
                        }
                    }
                } catch {
                    // Invalid JSON, skip this entry
                }
            }
        });

        while (localCharactersContainer.firstChild) {
            localCharactersContainer.removeChild(
                localCharactersContainer.firstChild
            );
        }

        if (localChars.length > 0) {
            localChars.forEach(char => {
                const card = createCharacterCard(
                    char.characterName,
                    char.storyId,
                    translations,
                    locale
                );
                localCharactersContainer.appendChild(card);
                setupEditHandler(card, translations, locale);
            });
        } else {
            localCharactersContainer.appendChild(
                createEmptyState(translations, locale)
            );
        }
    } catch (error) {
        console.error('Error loading local characters:', error);
        while (localCharactersContainer.firstChild) {
            localCharactersContainer.removeChild(
                localCharactersContainer.firstChild
            );
        }
        localCharactersContainer.appendChild(createErrorState(translations));
    }
}

export function initializeCharacterPage(
    translations: CharacterTranslations,
    locale: string = 'en'
): void {
    setupAuthenticatedCharacterEditing(translations, locale);
    loadLocalCharacters(translations, locale);
}
