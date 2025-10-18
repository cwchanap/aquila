import type { ChoiceMap } from '../../../types';

export const trainAdventureZhChoices: ChoiceMap = {
    get_off_or_stay: {
        prompt: '李杰應該怎麼做？',
        options: [
            {
                id: 'leave_train',
                label: '走下車廂，踏入未知',
                nextScene: 'scene_4a',
            },
            {
                id: 'stay_on_train',
                label: '留在車內，靜待變化',
                nextScene: 'scene_4b',
            },
        ],
    },
};
