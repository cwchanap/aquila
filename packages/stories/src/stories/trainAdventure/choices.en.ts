import type { ChoiceText } from '../choice-utils';

// Player choice text (prompt + option labels) for every branch point, in en.
export const trainAdventureChoiceTextEn: ChoiceText = {
    choice_act3: {
        prompt: 'The doors are open. Do you step out?',
        labels: {
            b1a: 'Step off onto the platform',
            b1b: 'Stay on the train',
        },
    },
    choice_b1a_act6: {
        prompt: 'Follow them into the forest, or stay?',
        labels: {
            b2a: 'Stay and search the station',
            b2b: 'Follow the older man into the forest',
        },
    },
    choice_b1a_b2a_act8: {
        prompt: 'Four paths — but only one is a real choice.',
        labels: {
            b3a: 'Keep to the main path',
        },
    },
    choice_b1a_b2a_b3a_act12: {
        prompt: 'Another fork. Which way do you go?',
        labels: {
            b4a: 'Trust Emi and go left',
        },
    },
    choice_b1a_b2a_b3a_b4a_act35: {
        prompt: 'Will you help Emi deceive Saito?',
        labels: {
            b5a: 'Agree to help Emi',
            b5b: "Refuse Emi's request",
        },
    },
    choice_b1a_b2b_act7: {
        prompt: 'Go with the older man, or after the guy in glasses?',
        labels: {
            b3a: 'Help the older man find the students',
            b3b: 'Go after the guy in glasses',
        },
    },
    choice_b1a_b2b_b3a_act26: {
        prompt: 'Hold Ling Mo back, or flee with the elves?',
        labels: {
            b4a: 'Stay and stand beside Ailaru',
            b4b: 'Evacuate with the elves',
        },
    },
    choice_b1a_b2b_b3b_act30: {
        prompt: 'Three doors. Which one do you open?',
        labels: {
            b4a: 'Open the left door',
            b4b: 'Open the right door',
        },
    },
    choice_b1a_b2b_b3b_b4b_act64: {
        prompt: 'Two pills. What do you do?',
        labels: {
            b5a: "Don't run; take neither pill",
            b5b: 'Pick up the blue pill',
        },
    },
    choice_b1a_b2b_b3b_b4b_b5a_act70: {
        prompt: 'The last pills. What do you choose?',
        labels: {
            b6a: 'Swallow the red pill',
            b6b: 'Swallow the blue pill',
            b6c: 'Take neither',
            b6d: 'Swallow both',
        },
    },
    choice_b1b_act8: {
        prompt: 'Go with this family, or set out alone?',
        labels: {
            b2a: 'Go with the mother and children',
            b2b: 'Head alone for the Misty Forest',
            b2c: 'Head alone for Silver Moon Lake',
        },
    },
    choice_b1b_b2a_act14: {
        prompt: 'South to the cabin, or north to the canyon?',
        labels: {
            b3a: 'Search the cabin for the Kobayashis',
            b3b: 'Head north to the Canyon of the Dead',
        },
    },
    choice_b1b_b2a_b3b_act16: {
        prompt: 'Follow the tracks, or explore the altar?',
        labels: {
            b4a: 'Follow the tracks to the Eternal Forest',
            b4b: "Enter the altar's dark corridor",
        },
    },
    choice_b1b_b2a_b3b_b4a_act20: {
        prompt: 'Board the train, or seek the Sacred Tree?',
        labels: {
            b5a: 'Ride the train back to the start',
            b5b: 'Journey to the Sacred Tree',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5a_act21: {
        prompt: 'When you wake, will you heed the déjà vu?',
        labels: {
            b6a: 'Chalk it up to exhaustion',
            b6b: 'Chase that familiar feeling',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5a_b6b_act59: {
        prompt: 'Who gets off here?',
        labels: {
            b7a: 'Get off and find Yamamoto',
            b7b: 'Make Saito get off',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5a_b6b_b7a_act69: {
        prompt: "Do you drive the sword into Ling Mo's chest?",
        labels: {
            b8a: 'Trust the sword and take the chance',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_act27: {
        prompt: 'Run from it, or face the truth?',
        labels: {
            b6a: 'Uncover the whole truth',
            b6b: 'Pretend nothing happened',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_act34: {
        prompt: 'Do you take up the black sword?',
        labels: {
            b7a: 'Trust your gut and leave it',
            b7b: 'Grasp the black sword',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_act39: {
        prompt: 'Who takes which path?',
        labels: {
            b8a: 'Go deeper alone; send them back',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_act44: {
        prompt: 'Which way would Yamamoto have gone?',
        labels: {
            b9a: 'West to Silver Moon Lake',
            b9b: 'North to the Canyon of the Dead',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_b9a_act56: {
        prompt: 'Will you step through the golden door?',
        labels: {
            b10a: 'Say goodbye and step through',
            b10b: 'Let it go and stay here',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_b9a_b10a_act62: {
        prompt: 'Will you give up your body to save the island?',
        labels: {
            b11a: "Accept Orion's plea",
            b11b: 'Refuse the sacrifice',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_b9a_b10b_act68: {
        prompt: 'Stay here, or sail for the Demon Isle?',
        labels: {
            b11a: 'Stay here with Emi',
            b11b: 'Go with the elves to the Demon Isle',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6b_act36: {
        prompt: 'At gunpoint, do you tell the truth?',
        labels: {
            b7a: 'Spin a half-true story',
            b7b: 'Grit your teeth and say nothing',
        },
    },
    choice_b1b_b2a_b3b_b4b_act37: {
        prompt: 'A quiet life, or the truth about your father?',
        labels: {
            b5a: 'Stay in Zhuhai with Mom',
            b5b: 'Go to Japan for the truth',
        },
    },
    choice_b1b_b2a_b3b_b4b_b5b_act43: {
        prompt: 'Call the police, or go alone?',
        labels: {
            b6a: 'Go to the police first',
            b6b: 'Skip the police and go alone',
        },
    },
    choice_b1b_b2a_b3b_b4b_b5b_b6b_act76: {
        prompt: 'Run, or stay with them?',
        labels: {
            b7a: "Stay; don't abandon them",
            b7b: 'Turn and run',
        },
    },
    choice_b1b_b2a_b3b_b4b_b5b_b6b_b7a_act94: {
        prompt: 'With only one key, who do you save?',
        labels: {
            b8a: 'Use the key to save Mio',
            b8b: 'Use the key to save Erika',
        },
    },
    choice_b1b_b2b_act17: {
        prompt: 'The tunnel runs both ways. Which way?',
        labels: {
            b3a: 'Follow the tracks left',
            b3b: 'Follow the tracks right',
        },
    },
};
