<script lang="ts">
  import { onMount } from 'svelte';
  import UserStatus from './UserStatus.svelte';
  import { getTranslations } from '@aquila/stories/translations';
  import type { Locale } from '@aquila/stories';
  import type { User } from '../lib/drizzle/schema.js';

  export let user: User | null = null;
  export let locale: string = 'en';

  let currentLocale = locale;

  // Use centralized translations
  $: translations = getTranslations(currentLocale as Locale);

  // Helper to check if current path is Chinese
  const isChinesePath = (): boolean => {
    return window.location.pathname.startsWith('/zh');
  };

  // Update locale on client side if different from prop
  onMount(() => {
    const clientLocale = document.documentElement.lang || 'en';
    if (clientLocale !== locale) {
      currentLocale = clientLocale;
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
    }
  };

  // Button click handlers
  const handleBookmarksClick = () => {
    const isChinese = isChinesePath();
    window.location.href = isChinese ? '/zh/bookmarks' : '/en/bookmarks';
  };

  const handleSettingsClick = () => {
    // Settings functionality not yet implemented
    window.alert(translations.menu?.settingsComingSoon ?? '[Coming soon]');
  };
</script>

<!-- Ocean Background -->
<div class="min-h-screen relative overflow-hidden">

  <!-- Sky-to-ocean gradient -->
  <div class="absolute inset-0 bg-linear-to-b from-sky-100 via-sky-200 to-blue-400"></div>

  <!-- Subtle light shimmer on horizon -->
  <div class="absolute inset-0"
    style="background: radial-gradient(ellipse 80% 40% at 50% 30%, rgba(255,255,255,0.18) 0%, transparent 70%);"
  ></div>

  <!-- Ocean wave layers -->
  <div class="absolute inset-0 pointer-events-none">
    <!-- Deep wave -->
    <svg class="absolute bottom-0 w-full" style="height: 45%;" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path fill="rgba(37, 99, 235, 0.22)" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L0,320Z">
        <animateTransform attributeName="transform" type="translate" values="0 0; 60 0; 0 0" dur="9s" repeatCount="indefinite"/>
      </path>
    </svg>
    <!-- Mid wave -->
    <svg class="absolute bottom-0 w-full" style="height: 35%;" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path fill="rgba(37, 99, 235, 0.35)" d="M0,192L48,176C96,160,192,128,288,128C384,128,480,160,576,176C672,192,768,192,864,176C960,160,1056,128,1152,128C1248,128,1344,160,1392,176L1440,192L1440,320L0,320Z">
        <animateTransform attributeName="transform" type="translate" values="0 0; -40 0; 0 0" dur="7s" repeatCount="indefinite"/>
      </path>
    </svg>
    <!-- Shore wave -->
    <svg class="absolute bottom-0 w-full" style="height: 22%;" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path fill="rgba(59, 130, 246, 0.55)" d="M0,256L48,240C96,224,192,192,288,192C384,192,480,224,576,240C672,256,768,256,864,240C960,224,1056,192,1152,192C1248,192,1344,224,1392,240L1440,256L1440,320L0,320Z">
        <animateTransform attributeName="transform" type="translate" values="0 0; 45 0; 0 0" dur="5s" repeatCount="indefinite"/>
      </path>
    </svg>
  </div>

  <!-- Soft cloud wisps -->
  <div class="absolute inset-0 pointer-events-none overflow-hidden">
    <div class="absolute top-[12%] left-[15%] w-40 h-10 bg-white/25 rounded-full blur-2xl"></div>
    <div class="absolute top-[8%] right-[22%] w-28 h-8 bg-white/20 rounded-full blur-2xl"></div>
    <div class="absolute top-[18%] right-[10%] w-36 h-9 bg-white/15 rounded-full blur-2xl"></div>
  </div>

  <!-- User status -->
  <UserStatus {user} {currentLocale} />

  <!-- Language switcher — top left, minimal pill -->
  <div class="absolute top-5 left-5 z-20">
    <div class="flex flex-col gap-0.5 bg-white/60 backdrop-blur-md rounded-xl px-1 py-1 shadow-sm border border-white/50">
      <a
        href="/en/"
        class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/70 transition-all duration-200 language-link"
        style="font-family: 'Exo 2', sans-serif;"
        on:click={() => handleLanguageClick('en')}
      >
        {translations.languages.english}
      </a>
      <a
        href="/zh/"
        class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/70 transition-all duration-200 language-link"
        style="font-family: 'Exo 2', sans-serif;"
        on:click={() => handleLanguageClick('zh')}
      >
        {translations.languages.chinese}
      </a>
    </div>
  </div>

  <!-- Main content — centered card -->
  <div class="min-h-screen flex items-center justify-center px-4 relative z-10">
    <div class="w-full max-w-sm">

      <!-- Glass card -->
      <div class="bg-white/75 backdrop-blur-lg rounded-3xl shadow-xl border border-white/60 overflow-hidden">

        <!-- Card inner padding -->
        <div class="px-8 pt-10 pb-8">

          <!-- Title block -->
          <div class="text-center mb-8">
            <h1
              class="text-4xl sm:text-5xl lg:text-6xl font-black tracking-widest uppercase mb-3 bg-linear-to-b from-blue-600 to-cyan-500 bg-clip-text text-transparent"
              style="font-family: 'Orbitron', monospace;"
            >
              {translations.menu.heading}
            </h1>
            <!-- Thin accent line under title -->
            <div class="mx-auto h-px w-16 bg-linear-to-r from-transparent via-cyan-400 to-transparent"></div>
          </div>

          <!-- Action buttons -->
          <div class="flex flex-col gap-3">

            <!-- Primary: Start -->
            <a
              id="start-btn"
              href={`/${currentLocale}/stories`}
              class="block w-full text-center py-3.5 px-6 rounded-2xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-base tracking-wide transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
              style="font-family: 'Exo 2', sans-serif;"
            >
              {translations.menu.startGame}
            </a>

            <!-- Secondary: Bookmarks -->
            <button
              class="w-full py-3 px-6 rounded-2xl bg-white/60 hover:bg-white/80 active:bg-white/90 text-slate-700 hover:text-slate-900 font-medium text-sm tracking-wide border border-white/70 hover:border-slate-200 transition-all duration-200"
              style="font-family: 'Exo 2', sans-serif;"
              on:click={handleBookmarksClick}
            >
              {translations.menu.bookmarks}
            </button>

            <!-- Secondary: Settings -->
            <button
              id="settings-btn"
              class="w-full py-3 px-6 rounded-2xl bg-white/60 hover:bg-white/80 active:bg-white/90 text-slate-700 hover:text-slate-900 font-medium text-sm tracking-wide border border-white/70 hover:border-slate-200 transition-all duration-200"
              style="font-family: 'Exo 2', sans-serif;"
              on:click={handleSettingsClick}
            >
              {translations.menu.settings}
            </button>

          </div>
        </div>

        <!-- Card footer — subtle wave accent -->
        <div class="h-1 w-full bg-linear-to-r from-blue-300 via-cyan-300 to-blue-300 opacity-60"></div>
      </div>

    </div>
  </div>
</div>
