/** Submit-time controller for the story character-setup form: prefills the
 *  locally saved name, decides between the account save and the local save,
 *  and re-checks for an existing setup when the SSR session lookup was
 *  uncertain — a session that recovers by submit time redirects to the
 *  story instead of overwriting the saved name. */

interface CharacterSetupDeps {
    /** Test seam; defaults to assigning window.location.href. */
    navigate?: (url: string) => void;
    /** Test seam; defaults to window.localStorage. */
    storage?: Storage | null;
}

export class CharacterSetupManager {
    private readonly navigate: (url: string) => void;
    private readonly storage: Storage | null;
    private readonly story: string;
    private readonly isAuthed: boolean;
    private readonly authUncertain: boolean;
    private readonly pageLocale: string;

    constructor(
        private readonly root: HTMLElement,
        deps: CharacterSetupDeps = {}
    ) {
        this.navigate =
            deps.navigate ??
            (url => {
                window.location.href = url;
            });
        this.storage =
            deps.storage === undefined
                ? typeof localStorage === 'undefined'
                    ? null
                    : localStorage
                : deps.storage;
        const urlParams = new URLSearchParams(window.location.search);
        this.story =
            root.getAttribute('data-story') ||
            urlParams.get('story') ||
            'train_adventure';
        this.isAuthed = root.getAttribute('data-authed') === 'true';
        // True when the SSR session lookup timed out or errored — auth may
        // be fine, so the submit re-tries the account save instead of
        // trusting the degraded flag.
        this.authUncertain =
            root.getAttribute('data-auth-uncertain') === 'true';
        this.pageLocale = root.getAttribute('data-locale') || 'en';
    }

    initialize(): void {
        const form = this.root.querySelector<HTMLFormElement>('#setup-form');
        const nameInput =
            this.root.querySelector<HTMLInputElement>('#character-name');
        if (!form || !nameInput) return;
        this.prefill(nameInput);
        form.addEventListener('submit', event => {
            void this.onSubmit(form, nameInput, event);
        });
    }

    /** If there's a saved local setup, prefill the input (do NOT
     *  auto-redirect). */
    private prefill(nameInput: HTMLInputElement): void {
        try {
            const local = this.storage?.getItem(
                `aquila:character:${this.story}`
            );
            if (local) {
                const { characterName } = JSON.parse(local);
                if (
                    characterName &&
                    typeof characterName === 'string' &&
                    !nameInput.value
                ) {
                    nameInput.value = characterName;
                }
            }
        } catch (e) {
            console.warn('Failed to read local character setup:', e);
        }
    }

    private saveLocal(characterName: string): void {
        this.storage?.setItem(
            `aquila:character:${this.story}`,
            JSON.stringify({ characterName })
        );
    }

    private storyUrl(): string {
        return `/${this.pageLocale}/story/${this.story}`;
    }

    /** Reads the server's error message out of a failed POST body. */
    private async readError(response: Response): Promise<Error> {
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const bodyText = await response.text();
            if (bodyText) {
                try {
                    const errorData = JSON.parse(bodyText);
                    errorMsg = errorData.error || errorMsg;
                } catch {
                    errorMsg = bodyText;
                }
            }
        } catch {
            // Body read failed, use default error message
        }
        return new Error(errorMsg);
    }

    private async onSubmit(
        form: HTMLFormElement,
        nameInput: HTMLInputElement,
        event: Event
    ): Promise<void> {
        event.preventDefault();
        const submitButton = form.querySelector<HTMLButtonElement>(
            'button[type="submit"]'
        );
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a character name');
            return;
        }

        // Disable form during submission
        const originalText = submitButton?.textContent ?? null;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent =
                this.root.getAttribute('data-saving-label') || 'Saving...';
        }

        try {
            if (!this.isAuthed && this.authUncertain) {
                // The SSR session lookup failed, so the existing-setup
                // redirect never ran — check now: a saved setup under a
                // recovered session goes straight to the story instead of
                // being renamed by the POST below. A 401 confirms
                // signed-out and takes the local-save path unchanged.
                const probe = await fetch(
                    `/api/character-setup?storyId=${encodeURIComponent(this.story)}`,
                    { credentials: 'same-origin' }
                );
                if (probe.status === 401) {
                    this.saveLocal(name);
                    this.navigate(this.storyUrl());
                    return;
                }
                // Any other probe failure leaves the question unanswered —
                // the POST below could still rename a saved setup, so the
                // submit stops instead of guessing.
                if (!probe.ok) {
                    throw await this.readError(probe);
                }
                if (await probe.json()) {
                    this.navigate(this.storyUrl());
                    return;
                }
            }

            if (this.isAuthed || this.authUncertain) {
                // Save character setup to database. When auth was uncertain
                // at render this POST is the recheck: a 401 confirms
                // signed-out, anything else proves the account save
                // belongs here.
                const response = await fetch('/api/character-setup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        characterName: name,
                        storyId: this.story,
                    }),
                });

                if (response.status === 401 && !this.isAuthed) {
                    // The recheck found no session — signed-out save it is.
                    this.saveLocal(name);
                } else if (!response.ok) {
                    throw await this.readError(response);
                }
            } else {
                // Save character setup locally
                this.saveLocal(name);
            }

            // Redirect to story
            this.navigate(this.storyUrl());
        } catch (error) {
            console.error('Setup error:', error);
            alert('Failed to save character setup. Please try again.');

            // Re-enable form
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent =
                    originalText ||
                    this.root.getAttribute('data-start-label') ||
                    'Start Adventure';
            }
        }
    }
}
