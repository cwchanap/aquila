<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import UserStatus from './UserStatus.svelte';
  import Modal from './ui/Modal.svelte';
  import en from '@aquila/dialogue/translations/en.json';
  import zh from '@aquila/dialogue/translations/zh.json';
  import type { User } from '../lib/drizzle/schema.js';

  export let user: User | null = null;
  export let locale: string = 'en';

  let currentLocale = locale;
  let showSettingsModal = false;
  const dispatch = createEventDispatcher();

  // Helper function to get translations
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: Record<string, unknown> = currentLocale === 'zh' ? zh : en;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k] as Record<string, unknown>;
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  };

  // Helper to check if current path is Chinese
  const isChinesePath = (): boolean => {
    return window.location.pathname.startsWith('/zh');
  };

  // Update locale on client side if different from prop
  onMount(() => {
    const clientLocale = document.documentElement.lang || 'en';
    if (clientLocale !== locale) {
      currentLocale = clientLocale;
      dispatch('localeChange', { locale: clientLocale });
    }
  });

  // Handle language preference saving
  const handleLanguageClick = (lang: string) => {
    try {
      localStorage.setItem('aquila:language', lang);
    } catch (error) {
      console.error(
        'Failed to save language preference to localStorage:',
        error
      );
      // Fall back gracefully - app continues to function without persistent storage
    }
  };

  // Button click handlers
  const handleStartClick = () => {
    const isChinese = isChinesePath();
    window.location.href = isChinese ? '/zh/stories' : '/en/stories';
  };

  const handleBookmarksClick = () => {
    const isChinese = isChinesePath();
    window.location.href = isChinese ? '/zh/bookmarks' : '/en/bookmarks';
  };

  const handleSettingsClick = () => {
    showSettingsModal = true;
  };
</script>

<!-- Ocean Background with animated waves -->
<div class="min-h-screen relative overflow-hidden">
  <!-- Gradient Ocean Background -->
  <div
    class="absolute inset-0 bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400"
  ></div>

  <!-- Animated Ocean Waves (Background Layer) -->
  <div class="absolute inset-0">
    <svg
      class="absolute bottom-0 w-full h-96"
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
    >
      <path
        fill="rgba(59, 130, 246, 0.3)"
        fill-opacity="1"
        d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 50 0; 0 0"
          dur="6s"
          repeatCount="indefinite"
        />
      </path>
    </svg>

    <svg
      class="absolute bottom-0 w-full h-80"
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
    >
      <path
        fill="rgba(59, 130, 246, 0.4)"
        fill-opacity="1"
        d="M0,192L48,176C96,160,192,128,288,128C384,128,480,160,576,176C672,192,768,192,864,176C960,160,1056,128,1152,128C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; -30 0; 0 0"
          dur="8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>

    <svg
      class="absolute bottom-0 w-full h-64"
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
    >
      <path
        fill="rgba(59, 130, 246, 0.6)"
        fill-opacity="1"
        d="M0,256L48,240C96,224,192,192,288,192C384,192,480,224,576,240C672,256,768,256,864,240C960,224,1056,128,1152,128C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 40 0; 0 0"
          dur="10s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  </div>

  <!-- Subtle cloud shadows -->
  <div class="absolute inset-0 opacity-20">
    <div
      class="absolute top-20 left-1/4 w-32 h-16 bg-white rounded-full blur-xl animate-pulse"
    ></div>
    <div
      class="absolute top-32 right-1/3 w-24 h-12 bg-white rounded-full blur-xl animate-pulse"
      style="animation-delay: 2s;"
    ></div>
    <div
      class="absolute top-16 right-1/4 w-28 h-14 bg-white rounded-full blur-xl animate-pulse"
      style="animation-delay: 4s;"
    ></div>
  </div>

  <!-- User status in top right corner -->
  <UserStatus {user} {currentLocale} />

  <!-- Language Switcher - Visual Novel Style -->
  <div class="absolute top-6 left-6 z-10">
    <div
      class="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-white/40"
    >
      <a
        href="/en/"
        class="px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 text-slate-700 hover:text-slate-900 hover:bg-white/60 language-link block mb-1"
        onclick={() => handleLanguageClick('en')}
      >
        English
      </a>
      <a
        href="/zh/"
        class="px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 text-slate-700 hover:text-slate-900 hover:bg-white/60 language-link block"
        onclick={() => handleLanguageClick('zh')}
      >
        中文
      </a>
    </div>
  </div>

  <!-- Main Content Container - Visual Novel Style -->
  <div class="min-h-screen flex items-center justify-center relative">
    <div
      class="bg-white/90 backdrop-blur-md rounded-3xl p-10 shadow-2xl border border-white/50 max-w-lg w-full mx-6 transform hover:scale-[1.02] transition-all duration-500"
    >
      <!-- Title with Gaming-inspired styling -->
      <div class="text-center mb-12">
        <h1
          class="text-6xl font-black mb-4 tracking-wider uppercase bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent drop-shadow-lg"
          style="font-family: 'Orbitron', 'Exo 2', 'Rajdhani', monospace, sans-serif; text-shadow: 0 0 20px rgba(59, 130, 246, 0.3);"
        >
          {t('menu.heading')}
        </h1>
        <div
          class="w-32 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto rounded-full animate-pulse"
        ></div>
        <div
          class="text-sm font-semibold text-slate-600 mt-2 tracking-widest uppercase opacity-70"
          style="font-family: 'Orbitron', monospace;"
        >
          Interactive Adventure
        </div>
      </div>

      <!-- Menu Buttons - Gaming Style -->
      <div class="space-y-6">
        <button
          id="start-btn"
          class="group relative w-full py-6 px-8 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 hover:from-blue-600 hover:via-cyan-500 hover:to-blue-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.05] hover:-translate-y-2 border-2 border-cyan-300/50 overflow-hidden"
          style="font-family: 'Orbitron', 'Exo 2', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.3);"
          onclick={handleStartClick}
        >
          <!-- Button glow effect -->
          <div
            class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"
          ></div>
          <span class="relative text-xl tracking-wider uppercase font-black"
            >{t('menu.startGame')}</span
          >
          <!-- Gaming accent corners -->
          <div
            class="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-white/60"
          ></div>
          <div
            class="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-white/60"
          ></div>
          <div
            class="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-white/60"
          ></div>
          <div
            class="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-white/60"
          ></div>
        </button>

        <button
          class="group relative w-full py-6 px-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.05] hover:-translate-y-2 border-2 border-purple-300/50 overflow-hidden"
          style="font-family: 'Orbitron', 'Exo 2', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.3);"
          onclick={handleBookmarksClick}
        >
          <!-- Button glow effect -->
          <div
            class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"
          ></div>
          <span class="relative text-xl tracking-wider uppercase font-black"
            >{t('menu.bookmarks')}</span
          >
          <!-- Gaming accent corners -->
          <div
            class="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-white/60"
          ></div>
          <div
            class="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-white/60"
          ></div>
          <div
            class="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-white/60"
          ></div>
          <div
            class="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-white/60"
          ></div>
        </button>

        <button
          id="settings-btn"
          class="group relative w-full py-6 px-8 bg-gradient-to-r from-slate-200 to-white hover:from-white hover:to-slate-100 text-slate-700 hover:text-slate-900 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.05] hover:-translate-y-2 border-2 border-slate-300/60 overflow-hidden"
          style="font-family: 'Orbitron', 'Exo 2', monospace;"
          onclick={handleSettingsClick}
        >
          <!-- Button glow effect -->
          <div
            class="absolute inset-0 bg-gradient-to-r from-transparent via-slate-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          ></div>
          <span class="relative text-xl tracking-wider uppercase font-black"
            >{t('menu.settings')}</span
          >
          <!-- Gaming accent corners -->
          <div
            class="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-slate-500/60"
          ></div>
          <div
            class="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-slate-500/60"
          ></div>
          <div
            class="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-slate-500/60"
          ></div>
          <div
            class="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-slate-500/60"
          ></div>
        </button>
      </div>

      <!-- Settings Modal -->
      <Modal
        bind:open={showSettingsModal}
        title={t('menu.settings')}
        className="max-w-md"
      >
        <div class="space-y-6">
          <div class="space-y-4">
            <h3
              class="text-lg font-bold text-white uppercase tracking-wider"
              style="font-family: 'Orbitron', sans-serif;"
            >
              {t('setup.characterName')}
            </h3>
            <p class="text-slate-400 text-sm">
              Settings are currently managed via the story configuration.
            </p>
          </div>
          <div class="flex justify-end pt-4">
            <button
              class="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-bold uppercase tracking-widest text-xs border border-white/10"
              onclick={() => (showSettingsModal = false)}
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      </Modal>

      <!-- Gaming Decorative Elements -->
      <div class="mt-12 flex justify-center items-center space-x-4 opacity-60">
        <!-- Power indicator bars -->
        <div class="flex space-x-1">
          <div class="w-1 h-3 bg-cyan-400 rounded-sm animate-pulse"></div>
          <div
            class="w-1 h-4 bg-blue-400 rounded-sm animate-pulse"
            style="animation-delay: 0.2s;"
          ></div>
          <div
            class="w-1 h-5 bg-cyan-400 rounded-sm animate-pulse"
            style="animation-delay: 0.4s;"
          ></div>
          <div
            class="w-1 h-4 bg-blue-400 rounded-sm animate-pulse"
            style="animation-delay: 0.6s;"
          ></div>
          <div
            class="w-1 h-3 bg-cyan-400 rounded-sm animate-pulse"
            style="animation-delay: 0.8s;"
          ></div>
        </div>

        <!-- Gaming hexagon -->
        <div class="relative">
          <div
            class="w-6 h-6 bg-gradient-to-r from-blue-400 to-cyan-400 transform rotate-45 animate-spin"
            style="animation-duration: 8s; clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);"
          ></div>
          <div
            class="absolute inset-0 w-6 h-6 bg-white/30 transform rotate-45"
            style="clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);"
          ></div>
        </div>

        <!-- Power indicator bars (mirrored) -->
        <div class="flex space-x-1">
          <div
            class="w-1 h-3 bg-cyan-400 rounded-sm animate-pulse"
            style="animation-delay: 1s;"
          ></div>
          <div
            class="w-1 h-4 bg-blue-400 rounded-sm animate-pulse"
            style="animation-delay: 0.8s;"
          ></div>
          <div
            class="w-1 h-5 bg-cyan-400 rounded-sm animate-pulse"
            style="animation-delay: 0.6s;"
          ></div>
          <div
            class="w-1 h-4 bg-blue-400 rounded-sm animate-pulse"
            style="animation-delay: 0.4s;"
          ></div>
          <div
            class="w-1 h-3 bg-cyan-400 rounded-sm animate-pulse"
            style="animation-delay: 0.2s;"
          ></div>
        </div>
      </div>
    </div>
  </div>
</div>
