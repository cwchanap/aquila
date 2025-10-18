import type { DialogueMap } from '../../../types';
import { scene1 } from './scene-1';
import { scene2 } from './scene-2';
import { scene3 } from './scene-3';
import { scene4 as branch1aScene4 } from './branch-1a/scene-4';
import { scene4 as branch1bScene4 } from './branch-1b/scene-4';

export const trainAdventureZhDialogue: DialogueMap = {
    scene_1: scene1,
    scene_2: scene2,
    scene_3: scene3,
    scene_4a: branch1aScene4,
    scene_4b: branch1bScene4,
};
