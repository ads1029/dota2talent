import { useMemo, useState } from 'react'
import { ArrowDownUp, BookOpen, ChevronDown, ExternalLink, Filter, GitCompareArrows, Globe2, LayoutGrid, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { categoryLabels, eventsForHero, heroes, talentsForHero, talentsForVersion, variantsForHero, versions, type ArchiveEvent, type HeroId, type Language, type PrimaryAttribute, type Talent, type TalentCategory, type VariantTalent } from './data'
import './styles.css'

type Page = 'archive' | 'index'
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
const copy = {
  zh: { archive:'英雄档案', index:'通用天赋索引', title:'古树档案', subtitle:'DOTA 2 天赋树历史数据库', snapshot:'版本快照', timeline:'变更时间线', official:'官方来源', level:'等级', generic:'通用', unique:'独特', all:'全部类别', asc:'从低到高', desc:'从高到低', results:'条记录', search:'搜索 127 名英雄…', source:'完整数据以官方更新日志与游戏数据锚点为依据', preview:'127 英雄 · 133 版本', compare:'对比版本', empty:'没有符合条件的天赋' },
  en: { archive:'Hero archive', index:'Generic index', title:'Ancient Archive', subtitle:'DOTA 2 TALENT TREE HISTORY', snapshot:'Version snapshot', timeline:'Change timeline', official:'Official source', level:'LEVEL', generic:'GENERIC', unique:'UNIQUE', all:'All categories', asc:'Low to high', desc:'High to low', results:'records', search:'Search 127 heroes…', source:'Complete data sourced from official patch notes and game-data anchors', preview:'127 HEROES · 133 PATCHES', compare:'Compare versions', empty:'No talents match these filters' }
}

export default function App() {
  const [language, setLanguage] = useState<Language>('zh')
  const [page, setPage] = useState<Page>('archive')
  const [heroId, setHeroId] = useState<HeroId>('crystal-maiden')
  const [version, setVersion] = useState(versions.at(-1) ?? '7.41e')
  const [view, setView] = useState<'snapshot'|'timeline'>('snapshot')
  const [timelineOrder, setTimelineOrder] = useState<'desc'|'asc'>('desc')
  const [category, setCategory] = useState<TalentCategory|'all'>('all')
  const [sort, setSort] = useState<'desc'|'asc'>('desc')
  const [query, setQuery] = useState('')
  const [attribute, setAttribute] = useState<PrimaryAttribute|'all'>('all')
  const c = copy[language]
  const hero = heroes.find(h => h.id === heroId)!
  const heroTalents = talentsForHero(version, heroId)
  const variantTalents = variantsForHero(version, heroId)
  const genericTalents = useMemo(() => talentsForVersion(version)
    .filter(t => t.generic && t.value !== undefined && (category === 'all' || t.category === category))
    .sort((a,b) => sort === 'desc' ? b.value! - a.value! : a.value! - b.value!), [version, category, sort])
  const matchingHeroes = heroes.filter(h => `${h.zh}${h.en}`.toLowerCase().includes(query.toLowerCase()) && (attribute === 'all' || h.primaryAttr === attribute))
  const hasTalentData = heroTalents.length > 0

  return <div className="app-shell">
    <header>
      <button className="brand" onClick={() => setPage('archive')} aria-label="Home"><span className="brand-rune">A</span><span><b>{c.title}</b><small>{c.subtitle}</small></span></button>
      <nav>
        <button className={page==='archive'?'active':''} onClick={() => setPage('archive')}><BookOpen size={16}/>{c.archive}</button>
        <button className={page==='index'?'active':''} onClick={() => setPage('index')}><LayoutGrid size={16}/>{c.index}</button>
      </nav>
      <div className="head-actions"><span className="sample-badge"><span/> {c.preview}</span><button className="language" onClick={() => setLanguage(language==='zh'?'en':'zh')}><Globe2 size={15}/>{language==='zh'?'EN':'中文'}</button></div>
    </header>

    <main>
      {page === 'archive' ? <>
        <section className="hero-rail">
          <div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={c.search}/>{query&&<button onClick={()=>setQuery('')}><X size={14}/></button>}</div>
          <div className="attribute-filters">{(['all','strength','agility','intelligence','universal'] as const).map(attr => <button key={attr} title={attr} aria-label={attr} className={`${attr} ${attribute===attr?'active':''}`} onClick={()=>setAttribute(attr)}>{attr==='all'?'ALL':attr[0].toUpperCase()}</button>)}</div>
          <div className="roster-count"><span>{matchingHeroes.length}</span> / {heroes.length} {language==='zh'?'名英雄':'HEROES'}</div>
          <div className="hero-list">{matchingHeroes.map(h => <button key={h.id} aria-label={language==='zh'?h.zh:h.en} className={h.id===heroId?'selected':''} onClick={()=>setHeroId(h.id)}>
            <span className="hero-mark" style={{'--hero':h.color} as React.CSSProperties}><img src={assetUrl(h.image)} alt="" loading="lazy"/></span><span><b>{language==='zh'?h.zh:h.en}</b></span><em className={`attr-dot ${h.primaryAttr}`}/>
          </button>)}</div>
          <div className="coverage"><ShieldCheck size={16}/><div><b>{language==='zh'?'英雄目录':'HERO ROSTER'}</b><span>{heroes.length} / {heroes.length} {language==='zh'?'官方英雄':'official heroes'}</span></div></div>
        </section>

        <section className="content">
          <div className="hero-heading">
            <div className="portrait" style={{'--hero':hero.color} as React.CSSProperties}><img src={assetUrl(hero.image)} alt={language==='zh'?hero.zh:hero.en}/></div>
            <div><div className={`eyebrow hero-attribute ${hero.primaryAttr}`}>{attributeLabel(hero.primaryAttr, language)} · {language==='zh'?`复杂度 ${hero.complexity}`:`COMPLEXITY ${hero.complexity}`}</div><h1>{language==='zh'?hero.zh:hero.en}</h1><p><span>{hasTalentData ? version : language==='zh'?'该版本尚未登场':'NOT RELEASED IN THIS PATCH'}</span></p></div>
            <button className="compare"><GitCompareArrows size={17}/>{c.compare}</button>
          </div>
          <div className="toolbar">
            <div className="segmented"><button className={view==='snapshot'?'active':''} onClick={()=>setView('snapshot')}>{c.snapshot}</button><button className={view==='timeline'?'active':''} onClick={()=>setView('timeline')}>{c.timeline}</button></div>
            <div className="toolbar-actions">
              {view==='timeline'&&<button className="timeline-order" onClick={()=>setTimelineOrder(timelineOrder==='desc'?'asc':'desc')} aria-label={language==='zh'?'切换时间线顺序':'Reverse timeline order'}><ArrowDownUp size={15}/>{timelineOrder==='desc'?(language==='zh'?'最新 → 最旧':'NEWEST → OLDEST'):(language==='zh'?'最旧 → 最新':'OLDEST → NEWEST')}</button>}
              <label>{language==='zh'?'查看版本':'VIEW PATCH'}<span className="select-wrap"><select value={version} onChange={e=>setVersion(e.target.value)}>{[...versions].reverse().map(item=><option key={item}>{item}</option>)}</select><ChevronDown size={15}/></span></label>
            </div>
          </div>
          {hasTalentData ? (view==='snapshot' ? <><TalentTree talents={heroTalents} language={language}/><VariantTalents talents={variantTalents} language={language}/></> : <Timeline events={eventsForHero(heroId)} language={language} order={timelineOrder}/>) : <PendingHero hero={hero} language={language} version={version}/>}
          <div className="source-card"><span><ShieldCheck size={18}/></span><div><b>{c.source}</b><p>{language==='zh'?`已载入 7.00–7.41e 全部 133 个版本；当前选择 ${version}，所有分支与变更记录均已载入。`:`All 133 patches from 7.00–7.41e are loaded. ${version} preserves every branch and change record.`}</p></div><a href={version==='7.00'?'https://www.dota2.com/700/gameplay':`https://www.dota2.com/patches/${version}`} target="_blank">{c.official}<ExternalLink size={14}/></a></div>
        </section>
      </> : <GenericIndex language={language} version={version} setVersion={setVersion} category={category} setCategory={setCategory} sort={sort} setSort={setSort} talents={genericTalents}/>}
    </main>
  </div>
}

const attributeLabel = (attribute:PrimaryAttribute, language:Language) => ({
  strength:{zh:'力量',en:'STRENGTH'}, agility:{zh:'敏捷',en:'AGILITY'}, intelligence:{zh:'智力',en:'INTELLIGENCE'}, universal:{zh:'全才',en:'UNIVERSAL'}
}[attribute][language])

function PendingHero({hero,language,version}:{hero:(typeof heroes)[number],language:Language,version:string}) { return <div className="pending-hero"><div className="pending-sigil"><img src={assetUrl(hero.image)} alt=""/></div><div><span>HERO NOT YET RELEASED</span><h2>{language==='zh'?'该英雄在此版本尚未登场':'Hero not released in this patch'}</h2><p>{language==='zh'?`${hero.zh} 在 ${version} 尚无天赋树，请选择其发布之后的版本。`:`${hero.en} has no talent tree in ${version}; choose a patch after the hero's release.`}</p></div></div>}

function TalentTree({talents, language}:{talents: Talent[], language:Language}) {
  const c=copy[language]
  return <div className="tree-card"><div className="tree-head"><span>{language==='zh'?'左分支':'LEFT BRANCH'}</span><span>{language==='zh'?'天赋等级':'TALENT LEVEL'}</span><span>{language==='zh'?'右分支':'RIGHT BRANCH'}</span></div>
    {[25,20,15,10].map(level => { const left=talents.find(t=>t.level===level&&t.side==='left'), right=talents.find(t=>t.level===level&&t.side==='right'); return <div className="talent-row" key={level}>
      <TalentCell talent={left} language={language}/><div className="level-orb"><small>{c.level}</small><b>{level}</b></div><TalentCell talent={right} language={language}/>
    </div>})}
  </div>
}

function TalentCell({talent,language}:{talent?:Talent,language:Language}) { if(!talent) return <div className="talent-cell muted">—</div>; return <div className="talent-cell"><span className={talent.generic?'generic':'unique'}>{talent.generic?copy[language].generic:copy[language].unique}</span><b>{language==='zh'?talent.zh:talent.en}</b></div> }

function VariantTalents({talents,language}:{talents:VariantTalent[],language:Language}) { if(!talents.length)return null; return <section className="variant-card"><div className="eyebrow">{language==='zh'?'命石专属天赋':'FACET-SPECIFIC TALENTS'}</div>{talents.map((talent,index)=><div className="variant-row" key={`${talent.facet}-${talent.level}-${index}`}><span>{talent.facet}</span><b>LV {talent.level}</b><p>{language==='zh'?talent.zh:talent.en}</p></div>)}</section> }

function TimelineChange({text,language}:{text:string,language:Language}) {
  const displayText = text.replace(/^\s*(?:(?:天赋|Talent)\s*[:：]\s*)+/i, '')
  const pattern = language === 'zh'
    ? /^(.*?从\s*)(.+?)(\s*(?:(?:增加|降低|提升|减少|削弱|提高|改善|改良|下降|上升)?(?:至|到)|改为|变为)\s*)(.+?)([。.!！]?)$/
    : /^(.*?\bfrom\s+)(.+?)(\s+to\s+)(.+?)([.!]?)$/i
  const match = displayText.match(pattern)
  if (!match) return <p className="timeline-copy">{displayText}</p>
  return <p className="timeline-copy">{match[1]}<span className="talent-token before-token">{match[2]}</span>{match[3]}<span className="talent-token after-token">{match[4]}</span>{match[5]}</p>
}

const changeTypeLabels: Record<string,{zh:string;en:string}> = {
  added:{zh:'新增天赋',en:'ADDED'}, removed:{zh:'移除天赋',en:'REMOVED'}, replaced:{zh:'天赋替换',en:'REPLACED'},
  value_changed:{zh:'数值调整',en:'VALUE CHANGED'}, moved:{zh:'位置调整',en:'MOVED'}, reworked:{zh:'机制调整',en:'REWORKED'},
  unknown:{zh:'其他调整',en:'OTHER CHANGE'},
}

function Timeline({events,language,order}:{events:ArchiveEvent[],language:Language,order:'desc'|'asc'}) {
  const groups = events.reduce<ArchiveEvent[][]>((result,event) => {
    const last = result.at(-1)
    if (last?.[0].version === event.version) last.push(event)
    else result.push([event])
    return result
  }, [])
  const orderedEvents = (order === 'desc' ? [...groups].reverse() : groups).flat()
  return <div className="timeline">{orderedEvents.length?orderedEvents.map((event,i)=><article key={`${event.version}-${i}`}><div className="time-mark"><span/></div><div className="time-meta"><b>{event.version}</b><small>{event.facet ?? (language==='zh'?'英雄天赋':'HERO TALENT')}</small></div><div className="change-card"><span className="change-type">{(changeTypeLabels[event.type]??changeTypeLabels.unknown)[language]}</span><h3>{event.level?(language==='zh'?`${event.level} 级天赋`:`Level ${event.level}`):(language==='zh'?'天赋变更':'Talent change')}</h3><TimelineChange text={language==='zh'?event.zh:event.en} language={language}/></div></article>):<div className="empty"><Sparkles/>{language==='zh'?'该英雄没有单独的天赋变更事件':'No individual talent changes for this hero'}</div>}</div>
}

function GenericIndex({language,version,setVersion,category,setCategory,sort,setSort,talents}:{language:Language,version:string,setVersion:(v:string)=>void,category:TalentCategory|'all',setCategory:(v:TalentCategory|'all')=>void,sort:'asc'|'desc',setSort:(v:'asc'|'desc')=>void,talents:Talent[]}) {
 const c=copy[language]; return <section className="index-page"><div className="index-title"><div><span className="eyebrow">NORMALIZED TALENT DATA</span><h1>{c.index}</h1><p>{language==='zh'?'跨英雄比较可量化的通用属性天赋。独特、复合型天赋不会进入排名。':'Compare normalized generic attributes across heroes. Unique and compound talents are excluded.'}</p></div><div className="result-count"><b>{talents.length}</b><span>{c.results}</span></div></div>
 <div className="filterbar"><div><Filter size={16}/><select value={category} onChange={e=>setCategory(e.target.value as TalentCategory|'all')}><option value="all">{c.all}</option>{Object.entries(categoryLabels).map(([k,v])=><option key={k} value={k}>{v[language]}</option>)}</select></div><div><BookOpen size={16}/><select value={version} onChange={e=>setVersion(e.target.value)}>{[...versions].reverse().map(item=><option key={item}>{item}</option>)}</select></div><button onClick={()=>setSort(sort==='desc'?'asc':'desc')}><ArrowDownUp size={16}/>{sort==='desc'?c.desc:c.asc}</button></div>
 <div className="talent-table"><div className="table-head"><span>#</span><span>{language==='zh'?'英雄':'HERO'}</span><span>{language==='zh'?'类别':'CATEGORY'}</span><span>{language==='zh'?'天赋':'TALENT'}</span><span>{language==='zh'?'等级':'LEVEL'}</span><span>{language==='zh'?'数值':'VALUE'}</span></div>{talents.map((t,i)=>{const h=heroes.find(x=>x.id===t.hero)!;return <div className="table-row" key={`${t.hero}-${t.level}-${t.side}`}><span className="rank">{String(i+1).padStart(2,'0')}</span><span className="table-hero"><span className="table-hero-image" style={{'--hero':h.color} as React.CSSProperties}><img src={assetUrl(h.image)} alt="" loading="lazy"/></span><b>{language==='zh'?h.zh:h.en}</b></span><span><em>{categoryLabels[t.category!][language]}</em></span><span className="bilingual"><b>{language==='zh'?t.zh:t.en}</b></span><span>LV {t.level}</span><span className="value">{t.value}{t.unit==='percent'?'%':''}</span></div>})}{!talents.length&&<div className="empty"><Sparkles/>{c.empty}</div>}</div></section>
}
