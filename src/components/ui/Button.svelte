<script lang="ts">
  import { cva, type VariantProps } from 'class-variance-authority';
  import { cn } from '@/lib/utils';

  const buttonVariants = cva(
    'appearance-none font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 border focus:outline-none focus:ring-2 focus:ring-opacity-75',
    {
      variants: {
        variant: {
          default: 'py-2 px-4 bg-purple-500 text-white hover:bg-purple-700 focus:ring-purple-400',
          menu: 'w-full py-4 px-6 bg-white/20 hover:bg-white/30 text-white rounded-xl shadow-lg hover:shadow-xl border-white/30 backdrop-blur-sm',
        },
        size: {
          default: 'h-10 px-4 py-2',
          sm: 'h-9 rounded-md px-3',
          lg: 'h-11 rounded-md px-8',
          icon: 'h-10 w-10',
        },
      },
      defaultVariants: {
        variant: 'default',
        size: 'default',
      },
    }
  );

  export let variant: VariantProps<typeof buttonVariants>['variant'] = 'default';
  export let size: VariantProps<typeof buttonVariants>['size'] = 'default';
  export let className: string = '';
  export let href: string | undefined = undefined;
  // Forward common HTML button attributes
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled: boolean = false;

  $: finalClass = cn(buttonVariants({ variant, size, className }));
</script>

{#if href}
  <a {href} class={finalClass} on:click {...$$restProps}>
    <slot />
  </a>
{:else}
  <button class={finalClass} on:click {type} {disabled} aria-disabled={disabled} {...$$restProps}>
    <slot />
  </button>
{/if}