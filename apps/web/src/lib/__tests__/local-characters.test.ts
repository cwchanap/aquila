import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    validateAndClampName,
    createCharacterCard,
    createEmptyState,
    createErrorState,
    setupEditHandler,
    initializeCharacterPage,
    ALLOWED_STORIES,
    type CharacterTranslations,
} from '../local-characters';

const translations: CharacterTranslations = {
    playStory: 'Play Story',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    noLocalCharacters: 'No characters yet.',
    startFirstStory: 'Start Your First Story',
    errorLoadingLocalCharacters: 'Error loading characters.',
    nameRequired: 'Name is required.',
    invalidName: 'Name is invalid.',
    updateFailed: 'Update failed.',
};

describe('ALLOWED_STORIES', () => {
    it('contains train_adventure', () => {
        expect(ALLOWED_STORIES).toContain('train_adventure');
    });
});

// ---------------------------------------------------------------------------
// validateAndClampName
// ---------------------------------------------------------------------------
describe('validateAndClampName', () => {
    it('returns valid result for a normal name', () => {
        const result = validateAndClampName('Alice');
        expect(result.valid).toBe(true);
        if (result.valid) expect(result.value).toBe('Alice');
    });

    it('trims surrounding whitespace before validating', () => {
        const result = validateAndClampName('  Bob  ');
        expect(result.valid).toBe(true);
        if (result.valid) expect(result.value).toBe('Bob');
    });

    it('returns empty reason for blank/whitespace-only input', () => {
        const result = validateAndClampName('   ');
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.reason).toBe('empty');
    });

    it('returns empty reason for completely empty string', () => {
        const result = validateAndClampName('');
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.reason).toBe('empty');
    });

    it('returns invalid reason for names with special characters', () => {
        const result = validateAndClampName('<script>alert(1)</script>');
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.reason).toBe('invalid');
    });

    it('clamps names longer than CHARACTER_NAME_MAX_LENGTH', () => {
        // CHARACTER_NAME_MAX_LENGTH is 50
        const longName = 'A'.repeat(60);
        const result = validateAndClampName(longName);
        expect(result.valid).toBe(true);
        if (result.valid) expect(result.value.length).toBeLessThanOrEqual(50);
    });

    it('accepts maximum-length name exactly', () => {
        const name = 'A'.repeat(50);
        const result = validateAndClampName(name);
        expect(result.valid).toBe(true);
    });

    it('preserves the sanitized name from the validator', () => {
        const result = validateAndClampName('Charlie');
        expect(result.valid).toBe(true);
        if (result.valid) expect(typeof result.value).toBe('string');
    });
});

// ---------------------------------------------------------------------------
// createCharacterCard
// ---------------------------------------------------------------------------
describe('createCharacterCard', () => {
    it('creates a div element', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        expect(card.tagName).toBe('DIV');
    });

    it('sets data-local-character attribute', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        expect(card.getAttribute('data-local-character')).toBe('true');
    });

    it('sets data-story-id attribute to the storyId', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        expect(card.getAttribute('data-story-id')).toBe('train_adventure');
    });

    it('shows character name in the name display h3', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        const nameDisplay = card.querySelector('.character-name-display');
        expect(nameDisplay?.textContent).toBe('Alice');
    });

    it('shows first letter of name as avatar initial', () => {
        const card = createCharacterCard(
            'Bob',
            'train_adventure',
            translations
        );
        const avatar = card.querySelector('.character-avatar');
        expect(avatar?.textContent).toBe('B');
    });

    it('uppercases the avatar initial regardless of input case', () => {
        const card = createCharacterCard(
            'charlie',
            'train_adventure',
            translations
        );
        const avatar = card.querySelector('.character-avatar');
        expect(avatar?.textContent).toBe('C');
    });

    it('renders a name input pre-filled with the character name', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        const input = card.querySelector<HTMLInputElement>(
            '.character-name-input'
        );
        expect(input?.value).toBe('Alice');
    });

    it('name input is hidden initially', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        const input = card.querySelector('.character-name-input');
        expect(input?.classList.contains('hidden')).toBe(true);
    });

    it('save button is hidden initially', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        const saveBtn = card.querySelector('.character-save-btn');
        expect(saveBtn?.classList.contains('hidden')).toBe(true);
    });

    it('cancel button is hidden initially', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        const cancelBtn = card.querySelector('.character-cancel-btn');
        expect(cancelBtn?.classList.contains('hidden')).toBe(true);
    });

    it('edit button is visible initially', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        const editBtn = card.querySelector('.character-edit-btn');
        expect(editBtn?.classList.contains('hidden')).toBe(false);
    });

    it('play link points to the correct story URL', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations,
            'en'
        );
        const playLink = card.querySelector<HTMLAnchorElement>(
            '.character-play-link'
        );
        expect(playLink?.getAttribute('href')).toBe(
            '/en/story/train_adventure'
        );
    });

    it('uses zh locale in play link when specified', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations,
            'zh'
        );
        const playLink = card.querySelector<HTMLAnchorElement>(
            '.character-play-link'
        );
        expect(playLink?.getAttribute('href')).toBe(
            '/zh/story/train_adventure'
        );
    });

    it('renders translation strings on buttons', () => {
        const card = createCharacterCard(
            'Alice',
            'train_adventure',
            translations
        );
        expect(card.querySelector('.character-play-link')?.textContent).toBe(
            'Play Story'
        );
        expect(card.querySelector('.character-edit-btn')?.textContent).toBe(
            'Edit'
        );
        expect(card.querySelector('.character-save-btn')?.textContent).toBe(
            'Save'
        );
        expect(card.querySelector('.character-cancel-btn')?.textContent).toBe(
            'Cancel'
        );
    });

    it('throws for an invalid storyId', () => {
        expect(() =>
            createCharacterCard('Alice', 'malicious_story', translations)
        ).toThrow('Invalid story ID: malicious_story');
    });

    it('warns to console when storyId is invalid', () => {
        const consoleSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        try {
            createCharacterCard('Alice', '../../../etc/passwd', translations);
        } catch {
            // expected
        }
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// createEmptyState
// ---------------------------------------------------------------------------
describe('createEmptyState', () => {
    it('creates a div element', () => {
        const el = createEmptyState(translations);
        expect(el.tagName).toBe('DIV');
    });

    it('contains the noLocalCharacters translation text', () => {
        const el = createEmptyState(translations);
        expect(el.textContent).toContain('No characters yet.');
    });

    it('contains the startFirstStory link text', () => {
        const el = createEmptyState(translations);
        expect(el.textContent).toContain('Start Your First Story');
    });

    it('link points to /en/stories by default', () => {
        const el = createEmptyState(translations, 'en');
        const link = el.querySelector<HTMLAnchorElement>('a');
        expect(link?.getAttribute('href')).toBe('/en/stories');
    });

    it('link uses locale prefix', () => {
        const el = createEmptyState(translations, 'zh');
        const link = el.querySelector<HTMLAnchorElement>('a');
        expect(link?.getAttribute('href')).toBe('/zh/stories');
    });
});

// ---------------------------------------------------------------------------
// createErrorState
// ---------------------------------------------------------------------------
describe('createErrorState', () => {
    it('creates a div element', () => {
        const el = createErrorState(translations);
        expect(el.tagName).toBe('DIV');
    });

    it('contains the errorLoadingLocalCharacters translation text', () => {
        const el = createErrorState(translations);
        expect(el.textContent).toContain('Error loading characters.');
    });

    it('error message has appropriate styling class', () => {
        const el = createErrorState(translations);
        const errorDiv = el.querySelector('div');
        expect(errorDiv?.classList.contains('text-red-600')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// setupEditHandler
// ---------------------------------------------------------------------------
describe('setupEditHandler', () => {
    function buildCard(characterName = 'Alice', storyId = 'train_adventure') {
        const card = createCharacterCard(
            characterName,
            storyId,
            translations,
            'en'
        );
        document.body.appendChild(card);
        setupEditHandler(card, translations, 'en');
        return card;
    }

    beforeEach(() => {
        document.body.replaceChildren();
        localStorage.clear();
    });

    afterEach(() => {
        document.body.replaceChildren();
        localStorage.clear();
    });

    describe('entering edit mode', () => {
        it('clicking edit button hides the name display', () => {
            const card = buildCard();
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            expect(
                card
                    .querySelector('.character-name-display')!
                    .classList.contains('hidden')
            ).toBe(true);
        });

        it('clicking edit button shows the name input', () => {
            const card = buildCard();
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            expect(
                card
                    .querySelector('.character-name-input')!
                    .classList.contains('hidden')
            ).toBe(false);
        });

        it('clicking edit button hides the edit button itself', () => {
            const card = buildCard();
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            expect(
                card
                    .querySelector('.character-edit-btn')!
                    .classList.contains('hidden')
            ).toBe(true);
        });

        it('clicking edit button reveals save and cancel buttons', () => {
            const card = buildCard();
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            expect(
                card
                    .querySelector('.character-save-btn')!
                    .classList.contains('hidden')
            ).toBe(false);
            expect(
                card
                    .querySelector('.character-cancel-btn')!
                    .classList.contains('hidden')
            ).toBe(false);
        });

        it('clicking edit button hides the play link', () => {
            const card = buildCard();
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            expect(
                card
                    .querySelector('.character-play-link')!
                    .classList.contains('hidden')
            ).toBe(true);
        });
    });

    describe('cancel action', () => {
        it('clicking cancel restores the name input to original value', () => {
            const card = buildCard('Alice');
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            const nameInput = card.querySelector<HTMLInputElement>(
                '.character-name-input'
            )!;
            nameInput.value = 'ChangedName';

            card.querySelector<HTMLElement>('.character-cancel-btn')!.click();

            expect(nameInput.value).toBe('Alice');
        });

        it('clicking cancel shows name display again', () => {
            const card = buildCard();
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();
            card.querySelector<HTMLElement>('.character-cancel-btn')!.click();

            expect(
                card
                    .querySelector('.character-name-display')!
                    .classList.contains('hidden')
            ).toBe(false);
        });

        it('clicking cancel hides save and cancel buttons', () => {
            const card = buildCard();
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();
            card.querySelector<HTMLElement>('.character-cancel-btn')!.click();

            expect(
                card
                    .querySelector('.character-save-btn')!
                    .classList.contains('hidden')
            ).toBe(true);
            expect(
                card
                    .querySelector('.character-cancel-btn')!
                    .classList.contains('hidden')
            ).toBe(true);
        });

        it('pressing Escape key cancels edit mode', () => {
            const card = buildCard('Alice');
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            const nameInput = card.querySelector<HTMLInputElement>(
                '.character-name-input'
            )!;
            nameInput.value = 'Other';
            nameInput.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
            );

            expect(nameInput.value).toBe('Alice');
            expect(
                card
                    .querySelector('.character-name-display')!
                    .classList.contains('hidden')
            ).toBe(false);
        });
    });

    describe('save action', () => {
        it('clicking save updates name display with new name', () => {
            const card = buildCard('Alice');
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            const nameInput = card.querySelector<HTMLInputElement>(
                '.character-name-input'
            )!;
            nameInput.value = 'NewAlice';

            card.querySelector<HTMLElement>('.character-save-btn')!.click();

            expect(
                card.querySelector('.character-name-display')!.textContent
            ).toBe('NewAlice');
        });

        it('clicking save persists new name to localStorage', () => {
            const card = buildCard('Alice');
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            const nameInput = card.querySelector<HTMLInputElement>(
                '.character-name-input'
            )!;
            nameInput.value = 'NewAlice';

            card.querySelector<HTMLElement>('.character-save-btn')!.click();

            const stored = JSON.parse(
                localStorage.getItem('aquila:character:train_adventure')!
            );
            expect(stored.characterName).toBe('NewAlice');
        });

        it('clicking save updates the avatar initial', () => {
            const card = buildCard('Alice');
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            const nameInput = card.querySelector<HTMLInputElement>(
                '.character-name-input'
            )!;
            nameInput.value = 'Bob';

            card.querySelector<HTMLElement>('.character-save-btn')!.click();

            expect(card.querySelector('.character-avatar')!.textContent).toBe(
                'B'
            );
        });

        it('clicking save returns to view mode (hides input, shows display)', () => {
            const card = buildCard('Alice');
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            const nameInput = card.querySelector<HTMLInputElement>(
                '.character-name-input'
            )!;
            nameInput.value = 'Bob';
            card.querySelector<HTMLElement>('.character-save-btn')!.click();

            expect(
                card
                    .querySelector('.character-name-input')!
                    .classList.contains('hidden')
            ).toBe(true);
            expect(
                card
                    .querySelector('.character-name-display')!
                    .classList.contains('hidden')
            ).toBe(false);
        });

        it('pressing Enter key triggers save', () => {
            const card = buildCard('Alice');
            card.querySelector<HTMLElement>('.character-edit-btn')!.click();

            const nameInput = card.querySelector<HTMLInputElement>(
                '.character-name-input'
            )!;
            nameInput.value = 'Bob';
            nameInput.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
            );

            expect(
                card.querySelector('.character-name-display')!.textContent
            ).toBe('Bob');
        });

        it('shows alert for empty name on save', () => {
            const alertSpy = vi
                .spyOn(window, 'alert')
                .mockImplementation(() => {});
            try {
                const card = buildCard('Alice');
                card.querySelector<HTMLElement>('.character-edit-btn')!.click();

                const nameInput = card.querySelector<HTMLInputElement>(
                    '.character-name-input'
                )!;
                nameInput.value = '   ';

                card.querySelector<HTMLElement>('.character-save-btn')!.click();

                expect(alertSpy).toHaveBeenCalledWith('Name is required.');
            } finally {
                alertSpy.mockRestore();
            }
        });

        it('shows alert for invalid name on save', () => {
            const alertSpy = vi
                .spyOn(window, 'alert')
                .mockImplementation(() => {});
            try {
                const card = buildCard('Alice');
                card.querySelector<HTMLElement>('.character-edit-btn')!.click();

                const nameInput = card.querySelector<HTMLInputElement>(
                    '.character-name-input'
                )!;
                nameInput.value = '<bad>';

                card.querySelector<HTMLElement>('.character-save-btn')!.click();

                expect(alertSpy).toHaveBeenCalledWith('Name is invalid.');
            } finally {
                alertSpy.mockRestore();
            }
        });

        it('does not update display name when validation fails', () => {
            const alertSpy = vi
                .spyOn(window, 'alert')
                .mockImplementation(() => {});
            try {
                const card = buildCard('Alice');
                card.querySelector<HTMLElement>('.character-edit-btn')!.click();

                const nameInput = card.querySelector<HTMLInputElement>(
                    '.character-name-input'
                )!;
                nameInput.value = '';

                card.querySelector<HTMLElement>('.character-save-btn')!.click();

                // Name display should still show Alice
                expect(
                    card.querySelector('.character-name-display')!.textContent
                ).toBe('Alice');
            } finally {
                alertSpy.mockRestore();
            }
        });
    });

    describe('no-op when card lacks edit button', () => {
        it('does not throw if .character-edit-btn is absent', () => {
            const div = document.createElement('div');
            expect(() =>
                setupEditHandler(div, translations, 'en')
            ).not.toThrow();
        });
    });
});

// ---------------------------------------------------------------------------
// initializeCharacterPage
// ---------------------------------------------------------------------------
describe('initializeCharacterPage', () => {
    beforeEach(() => {
        document.body.replaceChildren();
        localStorage.clear();
    });

    afterEach(() => {
        document.body.replaceChildren();
        localStorage.clear();
    });

    it('renders character card when localStorage has a valid entry', () => {
        localStorage.setItem(
            'aquila:character:train_adventure',
            JSON.stringify({ characterName: 'Alice' })
        );
        document.body.innerHTML = '<div id="local-characters"></div>';

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        expect(container.querySelector('[data-local-character]')).toBeTruthy();
    });

    it('renders empty state when localStorage has no characters', () => {
        document.body.innerHTML = '<div id="local-characters"></div>';

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        expect(container.textContent).toContain('No characters yet.');
    });

    it('skips rendering entirely when data-user element exists (authenticated mode)', () => {
        localStorage.setItem(
            'aquila:character:train_adventure',
            JSON.stringify({ characterName: 'Alice' })
        );
        document.body.innerHTML = `
            <div data-user="true"></div>
            <div id="local-characters"></div>
        `;

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        // Container should remain empty since authenticated users skip local rendering
        expect(container.children.length).toBe(0);
    });

    it('renders empty state when localStorage contains invalid JSON', () => {
        // Invalid JSON entries are silently skipped, resulting in empty state
        localStorage.setItem('aquila:character:train_adventure', '{bad json}');
        document.body.innerHTML = '<div id="local-characters"></div>';

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        expect(container.textContent).toContain('No characters yet.');
    });

    it('skips characters with invalid names from localStorage', () => {
        localStorage.setItem(
            'aquila:character:train_adventure',
            JSON.stringify({ characterName: '<script>' })
        );
        document.body.innerHTML = '<div id="local-characters"></div>';

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        // Invalid name should be skipped → empty state
        expect(container.querySelector('[data-local-character]')).toBeNull();
        expect(container.textContent).toContain('No characters yet.');
    });

    it('does nothing if local-characters container is absent', () => {
        document.body.replaceChildren();
        expect(() => initializeCharacterPage(translations, 'en')).not.toThrow();
    });

    it('clears pre-existing children before rendering new characters', () => {
        localStorage.setItem(
            'aquila:character:train_adventure',
            JSON.stringify({ characterName: 'Alice' })
        );
        document.body.innerHTML =
            '<div id="local-characters"><p>stale content</p></div>';

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        // Old content should be gone, replaced with the character card
        expect(
            container.querySelector('[data-local-character]')
        ).not.toBeNull();
        // The stale <p> should have been removed
        const paragraphs = Array.from(container.querySelectorAll('p'));
        expect(paragraphs.every(p => p.textContent !== 'stale content')).toBe(
            true
        );
    });

    it('clears pre-existing children before rendering error state', () => {
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        document.body.innerHTML =
            '<div id="local-characters"><p>stale content</p></div>';

        const getItemSpy = vi
            .spyOn(localStorage, 'getItem')
            .mockImplementationOnce(() => {
                throw new Error('Storage access denied');
            });

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        // Stale content should be gone, error state rendered
        expect(container.textContent).not.toContain('stale content');
        expect(container.textContent).toContain('Error loading characters.');

        consoleSpy.mockRestore();
        getItemSpy.mockRestore();
    });

    it('renders error state when an unexpected error occurs during loading', () => {
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        document.body.innerHTML = '<div id="local-characters"></div>';

        // Spy on localStorage.getItem to throw on the first call (triggers outer catch)
        const getItemSpy = vi
            .spyOn(localStorage, 'getItem')
            .mockImplementationOnce(() => {
                throw new Error('Storage access denied');
            });

        initializeCharacterPage(translations, 'en');

        const container = document.getElementById('local-characters')!;
        expect(container.textContent).toContain('Error loading characters.');

        consoleSpy.mockRestore();
        getItemSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// setupRemoteEditHandler (via initializeCharacterPage → setupAuthenticatedCharacterEditing)
// ---------------------------------------------------------------------------
describe('setupRemoteEditHandler (authenticated character editing)', () => {
    /** Build a card element that matches what setupRemoteEditHandler expects. */
    function buildRemoteCard(
        characterId = 'char-1',
        storyId = 'train_adventure'
    ) {
        const card = document.createElement('div');
        card.setAttribute('data-character-id', characterId);
        card.setAttribute('data-story-id', storyId);

        const nameDisplay = document.createElement('h3');
        nameDisplay.className = 'character-name-display';
        nameDisplay.textContent = 'Alice';

        const nameInput = document.createElement('input');
        nameInput.className = 'character-name-input hidden';
        nameInput.value = 'Alice';

        const editBtn = document.createElement('button');
        editBtn.className = 'character-edit-btn';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'character-save-btn hidden';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'character-cancel-btn hidden';

        const playLink = document.createElement('a');
        playLink.className = 'character-play-link';

        const avatar = document.createElement('span');
        avatar.className = 'character-avatar';
        avatar.textContent = 'A';

        card.append(
            nameDisplay,
            nameInput,
            editBtn,
            saveBtn,
            cancelBtn,
            playLink,
            avatar
        );
        document.body.appendChild(card);
        return card;
    }

    /**
     * Call initializeCharacterPage with a mocked document.addEventListener that
     * fires DOMContentLoaded handlers immediately (without registering them on
     * document, preventing listener accumulation across tests).
     */
    function wireUp(locale = 'en') {
        const origAdd = document.addEventListener.bind(document);
        vi.spyOn(document, 'addEventListener').mockImplementation(
            (
                type: string,
                handler: EventListenerOrEventListenerObject,
                options?: boolean | AddEventListenerOptions
            ) => {
                if (
                    type === 'DOMContentLoaded' &&
                    typeof handler === 'function'
                ) {
                    // Fire immediately and do NOT register on document (prevents accumulation)
                    handler(new Event('DOMContentLoaded'));
                } else {
                    origAdd(
                        type,
                        handler as EventListener,
                        options as AddEventListenerOptions
                    );
                }
            }
        );
        initializeCharacterPage(translations, locale);
        vi.mocked(document.addEventListener).mockRestore();
    }

    beforeEach(() => {
        document.body.replaceChildren();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('skips cards without [data-character-id] ancestor', () => {
        const btn = document.createElement('button');
        btn.className = 'character-edit-btn';
        document.body.appendChild(btn);

        expect(() => wireUp()).not.toThrow();
    });

    it('clicking edit button enters edit mode (shows input, hides display)', () => {
        const card = buildRemoteCard();
        wireUp();

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();

        expect(
            card
                .querySelector('.character-name-display')!
                .classList.contains('hidden')
        ).toBe(true);
        expect(
            card
                .querySelector('.character-name-input')!
                .classList.contains('hidden')
        ).toBe(false);
        expect(
            card
                .querySelector('.character-save-btn')!
                .classList.contains('hidden')
        ).toBe(false);
        expect(
            card
                .querySelector('.character-cancel-btn')!
                .classList.contains('hidden')
        ).toBe(false);
    });

    it('clicking cancel restores original name and exits edit mode', () => {
        const card = buildRemoteCard();
        wireUp();

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();

        const input = card.querySelector<HTMLInputElement>(
            '.character-name-input'
        )!;
        input.value = 'Changed';

        card.querySelector<HTMLElement>('.character-cancel-btn')!.click();

        expect(input.value).toBe('Alice');
        expect(
            card
                .querySelector('.character-name-display')!
                .classList.contains('hidden')
        ).toBe(false);
        expect(
            card
                .querySelector('.character-name-input')!
                .classList.contains('hidden')
        ).toBe(true);
        expect(
            card
                .querySelector('.character-edit-btn')!
                .classList.contains('hidden')
        ).toBe(false);
        expect(
            card
                .querySelector('.character-save-btn')!
                .classList.contains('hidden')
        ).toBe(true);
    });

    it('pressing Escape cancels edit mode', () => {
        const card = buildRemoteCard();
        wireUp();

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();

        const input = card.querySelector<HTMLInputElement>(
            '.character-name-input'
        )!;
        input.value = 'Changed';
        input.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );

        expect(input.value).toBe('Alice');
        expect(
            card
                .querySelector('.character-name-display')!
                .classList.contains('hidden')
        ).toBe(false);
    });

    it('clicking save with valid name calls fetch to update character', async () => {
        const card = buildRemoteCard();
        wireUp();

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({}),
        });

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        card.querySelector<HTMLElement>('.character-save-btn')!.click();

        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/character-setup',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('successful save updates name display and exits edit mode', async () => {
        const card = buildRemoteCard();
        wireUp();

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({}),
        });

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        card.querySelector<HTMLInputElement>('.character-name-input')!.value =
            'Bob';
        card.querySelector<HTMLElement>('.character-save-btn')!.click();

        const nameDisplay = card.querySelector('.character-name-display')!;
        await vi.waitFor(() => expect(nameDisplay.textContent).toBe('Bob'));
        expect(nameDisplay.classList.contains('hidden')).toBe(false);
        expect(
            card
                .querySelector('.character-save-btn')!
                .classList.contains('hidden')
        ).toBe(true);
    });

    it('save updates avatar initial to first letter of new name', async () => {
        const card = buildRemoteCard();
        wireUp();

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({}),
        });

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        card.querySelector<HTMLInputElement>('.character-name-input')!.value =
            'Charlie';
        card.querySelector<HTMLElement>('.character-save-btn')!.click();

        const avatar = card.querySelector('.character-avatar')!;
        await vi.waitFor(() => expect(avatar.textContent).toBe('C'));
    });

    it('save with empty name shows alert and does not call fetch', async () => {
        const card = buildRemoteCard();
        const alertMock = vi
            .spyOn(window, 'alert')
            .mockImplementation(() => {});
        wireUp();

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        card.querySelector<HTMLInputElement>('.character-name-input')!.value =
            '';
        card.querySelector<HTMLElement>('.character-save-btn')!.click();

        await vi.waitFor(() =>
            expect(alertMock).toHaveBeenCalledWith(translations.nameRequired)
        );
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('save with invalid name shows alert for invalidName translation', async () => {
        const card = buildRemoteCard();
        const alertMock = vi
            .spyOn(window, 'alert')
            .mockImplementation(() => {});
        wireUp();

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        card.querySelector<HTMLInputElement>('.character-name-input')!.value =
            '<script>';
        card.querySelector<HTMLElement>('.character-save-btn')!.click();

        await vi.waitFor(() =>
            expect(alertMock).toHaveBeenCalledWith(translations.invalidName)
        );
    });

    it('pressing Enter triggers save', async () => {
        const card = buildRemoteCard();
        wireUp();

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({}),
        });

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        const input = card.querySelector<HTMLInputElement>(
            '.character-name-input'
        )!;
        input.value = 'Dave';
        input.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    });

    it('failed save (non-ok response) shows updateFailed alert', async () => {
        const card = buildRemoteCard();
        const alertMock = vi
            .spyOn(window, 'alert')
            .mockImplementation(() => {});
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        wireUp();

        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({ error: 'Conflict' }),
        });

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        card.querySelector<HTMLElement>('.character-save-btn')!.click();

        await vi.waitFor(() =>
            expect(alertMock).toHaveBeenCalledWith(translations.updateFailed)
        );
        consoleSpy.mockRestore();
    });

    it('save with storyId updates play link href', async () => {
        const card = buildRemoteCard('char-1', 'train_adventure');
        wireUp('en');

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({}),
        });

        card.querySelector<HTMLElement>('.character-edit-btn')!.click();
        card.querySelector<HTMLInputElement>('.character-name-input')!.value =
            'Eve';
        card.querySelector<HTMLElement>('.character-save-btn')!.click();

        const playLink = card.querySelector<HTMLAnchorElement>(
            '.character-play-link'
        )!;
        await vi.waitFor(() =>
            expect(playLink.getAttribute('href')).toBe(
                '/en/story/train_adventure'
            )
        );
    });
});
