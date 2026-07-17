# Reader state architecture

- **`readerState` (`src/lib/reader-state.svelte.ts`)** is the single canonical reactive owner of reader PROGRESSION (`storyId`, `currentSceneId`, `locale`, `dialogueIndex`) — the only state serialized to URL/localStorage — plus the runtime SCENE PAYLOAD (`dialogue`, `choice`, `canGoNext`), which is derived from the loaded scene and never persisted.
- **`reader-session.ts`** holds pure serialization/precedence/validation logic (`resolveInitialState`, `validateSessionState`, `serializeSessionParams`, `migratePersisted`). Story accessors are injected, so it is unit-testable without `@aquila/stories`.
- **`ReaderManager`** is a plain-TS orchestrator: restore precedence, URL/history (`initialize`→replaceState, scene→pushState, line→throttled replaceState, popstate→cancel+restore/soft-reject, pagehide→flush), debounced persistence, and the `onIndexChange` write path. It has no `currentState` mirror — it reads `readerState`.
- **`ReaderShell`** is the reactive store→props bridge: it derives every progressive field from `readerState` and forwards it as props.
- **`NovelReader` / `MobileNovelReader`** are pure controlled components: data in via props, `onIndexChange`/actions out, no store import. Visible history derives from the index; the typewriter follows the two-signal algorithm (scene-ref change animates the first line; index change animates only if self-initiated, else snaps).
- **URL contract:** `story` / `scene` / `dialogue=N` (1-based). `locale` is path-owned, never in the URL.
