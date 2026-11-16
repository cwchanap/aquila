import {
    Building2,
    Crown,
    CupSoda,
    Moon,
    Orbit,
    Sparkles,
    TrainFront,
    WashingMachine,
} from 'lucide-svelte';
import type { StoryAccent } from '@aquila/stories/catalog';

export const STORY_ACCENTS: Record<
    StoryAccent,
    { cover: string; ring: string; text: string; dot: string; bar: string }
> = {
    rose: {
        cover: 'from-rose-500/50 to-amber-400/40',
        ring: 'hover:border-rose-300/50',
        text: 'text-rose-200',
        dot: 'bg-rose-200',
        bar: 'bg-rose-300',
    },
    cyan: {
        cover: 'from-cyan-500/50 to-blue-500/40',
        ring: 'hover:border-cyan-300/50',
        text: 'text-cyan-200',
        dot: 'bg-cyan-200',
        bar: 'bg-cyan-300',
    },
    indigo: {
        cover: 'from-indigo-500/50 to-violet-500/40',
        ring: 'hover:border-indigo-300/50',
        text: 'text-indigo-200',
        dot: 'bg-indigo-200',
        bar: 'bg-indigo-300',
    },
    red: {
        cover: 'from-red-950/90 to-rose-700/70',
        ring: 'hover:border-red-300/50',
        text: 'text-red-200',
        dot: 'bg-red-200',
        bar: 'bg-red-300',
    },
    pink: {
        cover: 'from-pink-400/70 to-amber-300/60',
        ring: 'hover:border-pink-300/50',
        text: 'text-pink-200',
        dot: 'bg-pink-200',
        bar: 'bg-pink-300',
    },
    violet: {
        cover: 'from-indigo-950/90 to-violet-600/70',
        ring: 'hover:border-violet-300/50',
        text: 'text-violet-200',
        dot: 'bg-violet-200',
        bar: 'bg-violet-300',
    },
    amber: {
        cover: 'from-amber-400/80 to-orange-600/70',
        ring: 'hover:border-amber-300/50',
        text: 'text-amber-200',
        dot: 'bg-amber-200',
        bar: 'bg-amber-300',
    },
    emerald: {
        cover: 'from-emerald-900/90 to-lime-300/50',
        ring: 'hover:border-emerald-300/50',
        text: 'text-emerald-200',
        dot: 'bg-emerald-200',
        bar: 'bg-emerald-300',
    },
};

export const STORY_ICONS: Record<string, typeof Sparkles> = {
    the_seventh_mirror: Sparkles,
    train_adventure: TrainFront,
    dont_save_me_before_midnight: Moon,
    elevator_game: Building2,
    three_am_laundromat: WashingMachine,
    day_4012: Orbit,
    demon_lord_is_hiring: Crown,
    one_pot_before_dawn: CupSoda,
};

export function storyIconFor(id: string) {
    return STORY_ICONS[id] ?? Sparkles;
}
