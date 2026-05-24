import type { DialogueMap } from '../../../types';
import { scene1 } from './scene-1';
import { scene2 } from './scene-2';
import { scene3 } from './scene-3';
import { scene4 as branch1aScene4 } from './branch-1a/scene-4';
import { scene4 as branch1bScene4 } from './branch-1b/scene-4';
import { scene5 } from './branch-1b/scene-5';
import { scene6 } from './branch-1b/scene-6';
import { scene7 } from './branch-1b/scene-7';
import { scene8 } from './branch-1b/scene-8';
import { scene9 } from './branch-1b/branch-2b/scene-9';
import { scene10 } from './branch-1b/branch-2b/scene-10';
import { scene11 } from './branch-1b/branch-2b/scene-11';
import { scene12 } from './branch-1b/branch-2b/scene-12';
import { scene13 } from './branch-1b/branch-2b/scene-13';
import { scene14 } from './branch-1b/branch-2b/scene-14';
import { scene15 } from './branch-1b/branch-2b/scene-15';
import { scene16 } from './branch-1b/branch-2b/scene-16';
import { sceneFinal as branch3bSceneFinal } from './branch-1b/branch-2b/branch-3b/scene-final';

export const trainAdventureZhDialogue: DialogueMap = {
    scene_1: scene1,
    scene_2: scene2,
    scene_3: scene3,
    scene_4a: branch1aScene4,
    scene_4b: branch1bScene4,
    scene_5b: scene5,
    scene_6b: scene6,
    scene_7b: scene7,
    scene_8b: scene8,
    scene_9b: scene9,
    scene_10b: scene10,
    scene_11b: scene11,
    scene_12b: scene12,
    scene_13b: scene13,
    scene_14b: scene14,
    scene_15b: scene15,
    scene_16b: scene16,
    scene_final_3b: branch3bSceneFinal,
};
