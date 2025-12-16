export class CharacterCardManager {
    private handlersSetup = false;

    private container: Element | null;
    private onSave:
        | ((storyId: string, newName: string) => Promise<void>)
        | null;

    private handleClick: ((e: Event) => void) | null = null;
    private handleKeydown: ((e: Event) => void) | null = null;

    constructor(
        container: Element,
        onSave: (storyId: string, newName: string) => Promise<void>
    ) {
        this.container = container;
        this.onSave = onSave;
    }

    setupHandlers() {
        if (!this.container) return;
        if (this.handlersSetup) return;
        this.handlersSetup = true;

        this.handleClick = e => {
            void this.onContainerClick(e);
        };

        this.handleKeydown = e => {
            this.onContainerKeydown(e);
        };

        this.container.addEventListener('click', this.handleClick);
        this.container.addEventListener('keydown', this.handleKeydown);
    }

    public destroy() {
        if (!this.container) {
            this.handlersSetup = false;
            this.handleClick = null;
            this.handleKeydown = null;
            this.onSave = null;
            return;
        }

        if (this.handleClick)
            this.container.removeEventListener('click', this.handleClick);
        if (this.handleKeydown)
            this.container.removeEventListener('keydown', this.handleKeydown);

        this.handlersSetup = false;
        this.handleClick = null;
        this.handleKeydown = null;

        this.onSave = null;
        this.container = null;
    }

    private async onContainerClick(e: Event) {
        if (!this.onSave) return;

        const target = e.target;
        if (!(target instanceof Element)) return;
        const card = target.closest(
            '[data-character-id], [data-local-character]'
        );
        if (!card) return;

        const nameDisplay = card.querySelector(
            '.character-name-display'
        ) as HTMLElement | null;
        const nameInput = card.querySelector(
            '.character-name-input'
        ) as HTMLInputElement | null;
        const editBtn = card.querySelector(
            '.character-edit-btn'
        ) as HTMLElement | null;
        const saveBtn = card.querySelector(
            '.character-save-btn'
        ) as HTMLElement | null;
        const cancelBtn = card.querySelector(
            '.character-cancel-btn'
        ) as HTMLElement | null;
        const playLink = card.querySelector(
            '.character-play-link'
        ) as HTMLElement | null;

        if (!nameDisplay || !nameInput || !editBtn || !saveBtn || !cancelBtn)
            return;

        if (target.closest('.character-edit-btn')) {
            const originalName = nameDisplay.textContent || '';
            card.setAttribute('data-original-name', originalName);

            nameDisplay.classList.add('hidden');
            nameInput.classList.remove('hidden');
            editBtn.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');
            playLink?.classList.add('hidden');

            nameInput.focus();
            nameInput.select();
            return;
        }

        if (target.closest('.character-save-btn')) {
            const newName = nameInput.value.trim();
            if (!newName) {
                alert('Character name cannot be empty');
                return;
            }

            const storyId = card.getAttribute('data-story-id');
            if (!storyId) {
                alert('Story ID is missing');
                return;
            }

            if (card.getAttribute('data-is-saving') === 'true') return;
            card.setAttribute('data-is-saving', 'true');

            const saveButton = saveBtn as HTMLButtonElement;
            saveBtn.setAttribute('aria-disabled', 'true');
            saveBtn.classList.add('pointer-events-none');
            if ('disabled' in saveButton) saveButton.disabled = true;

            try {
                await this.onSave(storyId, newName);

                nameDisplay.textContent = newName;
                const avatar = card.querySelector(
                    '.character-avatar'
                ) as HTMLElement | null;
                if (avatar)
                    avatar.textContent = newName.charAt(0).toUpperCase();

                nameDisplay.classList.remove('hidden');
                nameInput.classList.add('hidden');
                editBtn.classList.remove('hidden');
                saveBtn.classList.add('hidden');
                cancelBtn.classList.add('hidden');
                playLink?.classList.remove('hidden');
            } catch (error) {
                console.error('Error updating character:', error);
                alert('Failed to update character name. Please try again.');
            } finally {
                card.removeAttribute('data-is-saving');
                saveBtn.removeAttribute('aria-disabled');
                saveBtn.classList.remove('pointer-events-none');
                if ('disabled' in saveButton) saveButton.disabled = false;
            }

            return;
        }

        if (target.closest('.character-cancel-btn')) {
            const originalName = card.getAttribute('data-original-name') || '';
            nameInput.value = originalName;

            nameDisplay.classList.remove('hidden');
            nameInput.classList.add('hidden');
            editBtn.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            cancelBtn.classList.add('hidden');
            playLink?.classList.remove('hidden');
        }
    }

    private onContainerKeydown(e: Event) {
        const keyboardEvent = e as KeyboardEvent;
        const target = keyboardEvent.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains('character-name-input')) return;

        const card = target.closest(
            '[data-character-id], [data-local-character]'
        );
        if (!card) return;

        if (keyboardEvent.key === 'Enter') {
            keyboardEvent.preventDefault();
            const saveBtn = card.querySelector(
                '.character-save-btn'
            ) as HTMLElement | null;
            saveBtn?.click();
        } else if (keyboardEvent.key === 'Escape') {
            const cancelBtn = card.querySelector(
                '.character-cancel-btn'
            ) as HTMLElement | null;
            cancelBtn?.click();
        }
    }
}
