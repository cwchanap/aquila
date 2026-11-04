import type { ChoiceText } from '../choice-utils';

// Player choice text (prompt + option labels) for every branch point, in zh.
export const trainAdventureChoiceText: ChoiceText = {
    choice_act3: {
        prompt: '車門開了，要踏出去嗎？',
        labels: {
            b1a: '下車，踏上月台',
            b1b: '留在列車上',
        },
    },
    choice_b1a_act6: {
        prompt: '跟進森林，還是留在車站？',
        labels: {
            b2a: '留下來調查車站',
            b2b: '跟大叔追進森林',
        },
    },
    choice_b1a_b2a_act8: {
        prompt: '四條岔路，敢走的只有一條。',
        labels: {
            b3a: '沿著主路繼續前進',
        },
    },
    choice_b1a_b2a_b3a_act12: {
        prompt: '又是岔路口，要往哪走？',
        labels: {
            b4a: '相信恵美，走左邊',
        },
    },
    choice_b1a_b2a_b3a_b4a_act35: {
        prompt: '要幫恵美欺騙斎藤嗎？',
        labels: {
            b5a: '答應幫助恵美',
            b5b: '拒絕恵美的請求',
        },
    },
    choice_b1a_b2b_act7: {
        prompt: '跟大叔走，還是追回眼鏡男？',
        labels: {
            b3a: '跟大叔去找大學生',
            b3b: '去追回眼鏡男',
        },
    },
    choice_b1a_b2b_b3a_act26: {
        prompt: '留下來阻擋凌墨，還是撤離？',
        labels: {
            b4a: '留下來與艾拉如並肩',
            b4b: '跟著精靈們撤離',
        },
    },
    choice_b1a_b2b_b3b_act30: {
        prompt: '三扇門，要推開哪一扇？',
        labels: {
            b4a: '推開左邊的門',
            b4b: '推開右邊的門',
        },
    },
    choice_b1a_b2b_b3b_b4b_act64: {
        prompt: '兩顆藥丸，該怎麼選？',
        labels: {
            b5a: '不逃避，兩顆都不吃',
            b5b: '拿起藍色藥丸',
        },
    },
    choice_b1a_b2b_b3b_b4b_b5a_act70: {
        prompt: '最後的藥丸，要怎麼選？',
        labels: {
            b6a: '吞下紅色藥丸',
            b6b: '吞下藍色藥丸',
            b6c: '兩顆都不吃',
            b6d: '兩顆一起吞下',
        },
    },
    choice_b1b_act8: {
        prompt: '跟這家人走，還是獨自上路？',
        labels: {
            b2a: '與母子三人同行',
            b2b: '獨自前往迷霧之森',
            b2c: '獨自前往銀月湖',
        },
    },
    choice_b1b_b2a_act14: {
        prompt: '往南回小屋，還是往北去峽谷？',
        labels: {
            b3a: '回小屋找小林一家',
            b3b: '往北前往亡者峽谷',
        },
    },
    choice_b1b_b2a_b3b_act16: {
        prompt: '追著鐵軌走，還是探索祭壇深處？',
        labels: {
            b4a: '沿鐵軌前往永恆之森',
            b4b: '走進祭壇的幽暗長廊',
        },
    },
    choice_b1b_b2a_b3b_b4a_act20: {
        prompt: '搭上列車，還是前往神樹？',
        labels: {
            b5a: '搭上列車回到起點',
            b5b: '前往森林深處的神樹',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5a_act21: {
        prompt: '醒來時的似曾相識，要理會嗎？',
        labels: {
            b6a: '只當是太累了',
            b6b: '追著那份熟悉感',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5a_b6b_act59: {
        prompt: '誰該在這裡下車？',
        labels: {
            b7a: '自己下車去找山本',
            b7b: '讓斎藤下車',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5a_b6b_b7a_act69: {
        prompt: '要把神劍刺進凌墨胸膛嗎？',
        labels: {
            b8a: '相信神劍，賭這一次',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_act27: {
        prompt: '逃避，還是面對真相？',
        labels: {
            b6a: '去揭開一切的真相',
            b6b: '當作什麼都沒發生',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_act34: {
        prompt: '要拿起那柄黑劍嗎？',
        labels: {
            b7a: '相信直覺，不碰黑劍',
            b7b: '伸手握住黑劍',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_act39: {
        prompt: '誰該走哪條路？',
        labels: {
            b8a: '我獨自深入，兩人回岔路',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_act44: {
        prompt: '山本會選哪一條路？',
        labels: {
            b9a: '往西前往銀月湖',
            b9b: '往北前往亡者峽谷',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_b9a_act56: {
        prompt: '要穿過那扇金色的門嗎？',
        labels: {
            b10a: '道別，走進金色的門',
            b10b: '放下穿越，留在這裡',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_b9a_b10a_act62: {
        prompt: '要犧牲身體拯救島嶼嗎？',
        labels: {
            b11a: '答應歐瑞恩的請求',
            b11b: '拒絕這樣的犧牲',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6a_b7a_b8a_b9a_b10b_act68: {
        prompt: '留在這裡，還是前往魔族之島？',
        labels: {
            b11a: '和恵美留在這裡',
            b11b: '隨精靈前往魔族之島',
        },
    },
    choice_b1b_b2a_b3b_b4a_b5b_b6b_act36: {
        prompt: '槍口之下，要說出真相嗎？',
        labels: {
            b7a: '編一個半真半假的故事',
            b7b: '咬緊牙關，什麼都不說',
        },
    },
    choice_b1b_b2a_b3b_b4b_act37: {
        prompt: '要過平靜的日子，還是追尋真相？',
        labels: {
            b5a: '留在珠海陪伴母親',
            b5b: '前往日本追查真相',
        },
    },
    choice_b1b_b2a_b3b_b4b_b5b_act43: {
        prompt: '要報警，還是獨自赴約？',
        labels: {
            b6a: '先去警察局報警',
            b6b: '不報警，獨自前往',
        },
    },
    choice_b1b_b2a_b3b_b4b_b5b_b6b_act76: {
        prompt: '逃走，還是留下陪她們？',
        labels: {
            b7a: '留下來，不丟下她們',
            b7b: '轉身逃走',
        },
    },
    choice_b1b_b2a_b3b_b4b_b5b_b6b_b7a_act94: {
        prompt: '只有一把鑰匙，要救誰？',
        labels: {
            b8a: '用鑰匙救澪',
            b8b: '用鑰匙救繪里花',
        },
    },
    choice_b1b_b2b_act17: {
        prompt: '隧道向兩邊延伸，要走哪邊？',
        labels: {
            b3a: '沿著鐵軌往左走',
            b3b: '沿著鐵軌往右走',
        },
    },
};
