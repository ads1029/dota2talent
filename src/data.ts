import { heroCatalog, type Hero, type HeroId } from './heroCatalog'

export type { Hero, HeroId, PrimaryAttribute } from './heroCatalog'
export type Language = 'zh' | 'en'
export type TalentCategory = 'health' | 'damage' | 'attack-speed' | 'movement-speed' | 'cast-range' | 'magic-resistance' | 'attack-range' | 'other'

export type Talent = {
  hero: HeroId
  level: 10 | 15 | 20 | 25
  side: 'left' | 'right'
  en: string
  zh: string
  generic: boolean
  category?: TalentCategory
  value?: number
  unit?: 'flat' | 'percent' | 'seconds'
}

export const heroes: readonly Hero[] = heroCatalog

const t = (hero: HeroId, level: Talent['level'], side: Talent['side'], en: string, zh: string, generic = false, category?: TalentCategory, value?: number, unit: Talent['unit'] = 'flat'): Talent => ({ hero, level, side, en, zh, generic, category, value, unit })

export const snapshots: Record<'7.00' | '7.06', Talent[]> = {
  '7.00': [
    t('wraith-king',25,'left','No Reincarnation mana cost','重生不消耗魔法'), t('wraith-king',25,'right','+20% Vampiric Aura Lifesteal','吸血光环吸血 +20%'),
    t('wraith-king',20,'left','+40 Attack Speed','攻击速度 +40',true,'attack-speed',40), t('wraith-king',20,'right','+20 Strength','力量 +20',true,'other',20),
    t('wraith-king',15,'left','+15 Movement Speed','移动速度 +15',true,'movement-speed',15), t('wraith-king',15,'right','+200 Health','生命值 +200',true,'health',200),
    t('wraith-king',10,'left','+15 Damage','攻击力 +15',true,'damage',15), t('wraith-king',10,'right','+8 Intelligence','智力 +8',true,'other',8),
    t('crystal-maiden',25,'left','+1.5s Frostbite Duration','冰封禁制持续时间 +1.5秒'), t('crystal-maiden',25,'right','+200 Crystal Nova Damage','水晶新星伤害 +200'),
    t('crystal-maiden',20,'left','+120 Gold/Min','每分钟金钱 +120'), t('crystal-maiden',20,'right','-35s Respawn Time','复活时间 -35秒'),
    t('crystal-maiden',15,'left','+125 Cast Range','施法距离 +125',true,'cast-range',125), t('crystal-maiden',15,'right','+200 Health','生命值 +200',true,'health',200),
    t('crystal-maiden',10,'left','+15% Magic Resistance','魔法抗性 +15%',true,'magic-resistance',15,'percent'), t('crystal-maiden',10,'right','+50 Damage','攻击力 +50',true,'damage',50),
    t('jakiro',25,'left','+1.25s Ice Path Duration','冰封路径持续时间 +1.25秒'), t('jakiro',25,'right','-50s Respawn Time','复活时间 -50秒'),
    t('jakiro',20,'left','+400 Attack Range','攻击距离 +400',true,'attack-range',400), t('jakiro',20,'right','+150 Gold/Min','每分钟金钱 +150'),
    t('jakiro',15,'left','+125 Cast Range','施法距离 +125',true,'cast-range',125), t('jakiro',15,'right','+250 Health','生命值 +250',true,'health',250),
    t('jakiro',10,'left','+15% XP Gain','经验获取 +15%'), t('jakiro',10,'right','+8% Spell Amplification','技能增强 +8%'),
    t('shadow-fiend',25,'left','+150 Attack Range','攻击距离 +150',true,'attack-range',150), t('shadow-fiend',25,'right','-7s Shadow Raze Cooldown','毁灭阴影冷却时间 -7秒'),
    t('shadow-fiend',20,'left','15% Evasion','闪避 +15%',true,'other',15,'percent'), t('shadow-fiend',20,'right','+2 Damage Per Soul','每个灵魂攻击力 +2'),
    t('shadow-fiend',15,'left','+6% Spell Amplification','技能增强 +6%',true,'other',6,'percent'), t('shadow-fiend',15,'right','+175 Health','生命值 +175',true,'health',175),
    t('shadow-fiend',10,'left','+15 Movement Speed','移动速度 +15',true,'movement-speed',15), t('shadow-fiend',10,'right','+20 Attack Speed','攻击速度 +20',true,'attack-speed',20),
  ],
  '7.06': []
}

snapshots['7.06'] = snapshots['7.00'].map((talent) => {
  if (talent.hero === 'crystal-maiden' && talent.level === 20 && talent.side === 'right') return t('crystal-maiden',20,'right','+50 Freezing Field Damage','极寒领域伤害 +50')
  if (talent.hero === 'jakiro' && talent.level === 25 && talent.side === 'right') return t('jakiro',25,'right','Macropyre Pure and Pierces Immunity','烈焰焚身改为纯粹伤害并无视技能免疫')
  if (talent.hero === 'shadow-fiend' && talent.level === 25 && talent.side === 'right') return t('shadow-fiend',25,'right','+150 Shadowraze Damage','毁灭阴影伤害 +150')
  return talent
})

export const changes = [
  { version: '7.06', date: '2017-05-15', hero: 'crystal-maiden' as HeroId, level: 20, type: 'replaced', beforeEn: '-35s Respawn Time', beforeZh: '复活时间 -35秒', afterEn: '+50 Freezing Field Damage', afterZh: '极寒领域伤害 +50' },
  { version: '7.06', date: '2017-05-15', hero: 'jakiro' as HeroId, level: 25, type: 'replaced', beforeEn: '-50s Respawn Time', beforeZh: '复活时间 -50秒', afterEn: 'Macropyre Pure and Pierces Immunity', afterZh: '烈焰焚身改为纯粹伤害并无视技能免疫' },
  { version: '7.06', date: '2017-05-15', hero: 'shadow-fiend' as HeroId, level: 25, type: 'value_changed', beforeEn: '+125 Shadowraze Damage', beforeZh: '毁灭阴影伤害 +125', afterEn: '+150 Shadowraze Damage', afterZh: '毁灭阴影伤害 +150' },
  { version: '7.00', date: '2016-12-12', hero: 'wraith-king' as HeroId, level: 10, type: 'added', beforeEn: 'No talent tree', beforeZh: '尚无天赋树', afterEn: '+15 Damage / +8 Intelligence', afterZh: '攻击力 +15 / 智力 +8' },
]

export const categoryLabels: Record<TalentCategory, { zh: string; en: string }> = {
  health:{zh:'生命值',en:'Health'}, damage:{zh:'攻击力',en:'Damage'}, 'attack-speed':{zh:'攻击速度',en:'Attack Speed'},
  'movement-speed':{zh:'移动速度',en:'Movement Speed'}, 'cast-range':{zh:'施法距离',en:'Cast Range'},
  'magic-resistance':{zh:'魔法抗性',en:'Magic Resistance'}, 'attack-range':{zh:'攻击距离',en:'Attack Range'}, other:{zh:'其他属性',en:'Other attributes'}
}
