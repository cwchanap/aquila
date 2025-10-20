<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-200 to-blue-400">
  <div class="text-center">
    <h1 class="text-4xl font-bold text-white mb-4">Page Not Found</h1>
    <p class="text-white opacity-80 mb-4">Route: {$page.url.pathname}</p>
    <a href="/" class="inline-block px-6 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors">
      Return Home
    </a>
  </div>
</div>
