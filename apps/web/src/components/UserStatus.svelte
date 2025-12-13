<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/utils.js';
  import {
    authorizedFetch,
    getCurrentUser,
    getSupabaseAuthClient,
  } from '@/lib/auth';

  interface User {
    id: string;
    name: string | null;
    email: string;
  }

  export let user: User | null = null;
  export let currentLocale: string = 'en';
  let dropdownOpen = false;
  let menuButton: globalThis.HTMLElement;
  let dropdown: globalThis.HTMLElement;
  let hasClientError = false;
  let errorMessage = '';

  onMount(async () => {
    if (import.meta.env.DEV) {
      console.log('UserStatus component mounted');
    }

    // Always sync locale with document to ensure correct localization
    currentLocale = globalThis.document.documentElement.lang || 'en';

    // Only fetch if no user was provided server-side
    if (!user) {
      try {
        const current = await getCurrentUser();

        if (current && typeof current === 'object') {
          const raw = current as {
            id?: string;
            email?: string;
            name?: string | null;
          };

          if (raw.email) {
            user = {
              id: (raw.id as string) ?? raw.email,
              email: raw.email,
              name: (raw.name as string | null) ?? null,
            };
          } else {
            user = null;
          }
        } else {
          user = null;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.log(
            'Auth session error:',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
        hasClientError = true;
        errorMessage =
          'Unable to verify session. Please try refreshing the page.';
        user = null; // Clear any potentially stale user data
      }
    }
  });

  const toggleDropdown = (e: Event) => {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  };

  // Handle escape key
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dropdownOpen = false;
    }
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (
      !menuButton?.contains(e.target as Node) &&
      !dropdown?.contains(e.target as Node)
    ) {
      dropdownOpen = false;
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  const handleLogout = async (e: Event) => {
    e.preventDefault();

    try {
      // Call server-side logout first while we still have a valid token
      await authorizedFetch('/api/auth/logout', { method: 'POST' });

      const client = getSupabaseAuthClient();
      await client.auth.signOut();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.log(
          'Supabase signOut error:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    } finally {
      user = null;
      const locale =
        globalThis.document.documentElement.lang || currentLocale || 'en';
      globalThis.location.href = `/${locale}/login`;
    }
  };
</script>

<div class="user-status absolute top-6 right-6 z-50">
  {#if user}
    <div class="flex items-center relative">
      <div class="relative">
        <button
          bind:this={menuButton}
          on:click={toggleDropdown}
          class="flex items-center gap-3 bg-white/80 hover:bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-white/60"
          title="User Menu"
          style="font-family: 'Exo 2', sans-serif;"
        >
          <div
            class="w-8 h-8 bg-linear-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg"
          >
            {user.name?.charAt(0).toUpperCase() ||
              user.email?.charAt(0).toUpperCase() ||
              'U'}
          </div>
          <span class="text-slate-700 font-medium"
            >{user.name || user.email}</span
          >
          <svg
            class="w-4 h-4 text-slate-500 transition-transform duration-200 {dropdownOpen
              ? 'rotate-180'
              : ''}"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <div
          bind:this={dropdown}
          class="absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-md border border-white/50 rounded-2xl shadow-2xl transition-all duration-200 z-50 {dropdownOpen
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible translate-y-2'}"
        >
          <div class="py-2">
            <a
              href={`/${currentLocale}/profile`}
              class="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100/60 hover:text-slate-900 transition-colors duration-200 rounded-lg mx-2 font-medium"
              style="font-family: 'Exo 2', sans-serif;"
            >
              Profile
            </a>
            <a
              href={`/${currentLocale}/characters`}
              class="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100/60 hover:text-slate-900 transition-colors duration-200 rounded-lg mx-2 font-medium"
              style="font-family: 'Exo 2', sans-serif;"
            >
              Story Config
            </a>
            <div class="border-t border-slate-200/60 my-2 mx-2"></div>
            <button
              type="button"
              on:click={handleLogout}
              title={t(currentLocale, 'auth.signOut')}
              class="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50/60 hover:text-red-700 transition-colors duration-200 rounded-lg mx-2 font-medium"
              style="font-family: 'Exo 2', sans-serif;"
            >
              {t(currentLocale, 'auth.signOut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="flex flex-col items-end gap-2">
      <a
        href={`/${currentLocale}/login`}
        class="px-6 py-3 bg-white/80 hover:bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl text-slate-700 hover:text-slate-900 font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
        style="font-family: 'Orbitron', monospace;"
      >
        Login
      </a>
      {#if hasClientError && errorMessage}
        <div
          class="text-xs text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-lg px-3 py-2 shadow-sm max-w-xs text-right"
        >
          {errorMessage}
        </div>
      {/if}
    </div>
  {/if}
</div>
