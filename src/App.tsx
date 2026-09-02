import { useMemo, useState } from 'react'
import { ArrowDownUp, BookOpen, ChevronDown, ExternalLink, Filter, GitCompareArrows, Globe2, LayoutGrid, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { categoryLabels, changes, heroes, snapshots, type HeroId, type Language, type PrimaryAttribute, type Talent, type TalentCategory } from './data'
import './styles.css'

type Page = 'archive' | 'index'
const copy = {
  zh: { archive:'英雄档案', index:'通用天赋索引', title:'古树档案', subtitle:'DOTA 2 天赋树历史数据库', snapshot:'版本快照', timeline:'变更时间线', official:'官方来源', level:'等级', generic:'通用', unique:'独特', all:'全部类别', asc:'从低到高', desc:'从高到低', results:'条记录', search:'搜索 127 名英雄…', source:'数据原型以官方更新日志为依据', preview:'127 名英雄已导入', compare:'对比版本', empty:'没有符合条件的天赋' },
  en: { archive:'Hero archive', index:'Generic index', title:'Ancient Archive', subtitle:'DOTA 2 TALENT TREE HISTORY', snapshot:'Version snapshot', timeline:'Change timeline', official:'Official source', level:'LEVEL', generic:'GENERIC', unique:'UNIQUE', all:'All categories', asc:'Low to high', desc:'High to low', results:'records', search:'Search 127 heroes…', source:'Prototype data is sourced from official patch notes', preview:'127 HEROES IMPORTED', compare:'Compare versions', empty:'No talents match these filters' }
}

export default function App() {
  const [language, setLanguage] = useState<Language>('zh')
  const [page, setPage] = useState<Page>('archive')
  const [heroId, setHeroId] = useState<HeroId>('crystal-maiden')
  const [version, setVersion] = useState<'7.00'|'7.06'>('7.06')
  const [view, setView] = useState<'snapshot'|'timeline'>('snapshot')
  const [category, setCategory] = useState<TalentCategory|'all'>('all')
  const [sort, setSort] = useState<'desc'|'asc'>('desc')
  const [query, setQuery] = useState('')
  const [attribute, setAttribute] = useState<PrimaryAttribute|'all'>('all')
  const c = copy[language]
  const hero = heroes.find(h => h.id === heroId)!
  const heroTalents = snapshots[version].filter(t => t.hero === heroId)
  const genericTalents = useMemo(() => snapshots[version]
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
          <div className="hero-list">{matchingHeroes.map(h => <button key={h.id} className={h.id===heroId?'selected':''} onClick={()=>setHeroId(h.id)}>
            <span className="hero-mark" style={{'--hero':h.color} as React.CSSProperties}><img src={h.image} alt=""/><i>{h.mark}</i></span><span><b>{language==='zh'?h.zh:h.en}</b><small>{language==='zh'?h.en:h.zh}</small></span><em className={`attr-dot ${h.primaryAttr}`}/>
          </button>)}</div>
          <div className="coverage"><ShieldCheck size={16}/><div><b>{language==='zh'?'英雄目录':'HERO ROSTER'}</b><span>{heroes.length} / {heroes.length} {language==='zh'?'官方英雄':'official heroes'}</span></div></div>
        </section>

        <section className="content">
          <div className="hero-heading">
            <div className="portrait" style={{'--hero':hero.color} as React.CSSProperties}><img src={hero.image} alt={language==='zh'?hero.zh:hero.en}/><span>{hero.mark}</span></div>
            <div><div className={`eyebrow hero-attribute ${hero.primaryAttr}`}>{attributeLabel(hero.primaryAttr, language)} · {language==='zh'?`复杂度 ${hero.complexity}`:`COMPLEXITY ${hero.complexity}`}</div><h1>{language==='zh'?hero.zh:hero.en}</h1><p>{language==='zh'?hero.en:hero.zh} · <span>{hasTalentData ? version : language==='zh'?'等待导入天赋':'TALENTS PENDING'}</span></p></div>
            <button className="compare"><GitCompareArrows size={17}/>{c.compare}</button>
          </div>
          <div className="toolbar">
            <div className="segmented"><button className={view==='snapshot'?'active':''} onClick={()=>setView('snapshot')}>{c.snapshot}</button><button className={view==='timeline'?'active':''} onClick={()=>setView('timeline')}>{c.timeline}</button></div>
            <label>{language==='zh'?'查看版本':'VIEW PATCH'}<span className="select-wrap"><select value={version} onChange={e=>setVersion(e.target.value as '7.00'|'7.06')}><option>7.06</option><option>7.00</option></select><ChevronDown size={15}/></span></label>
          </div>
          {hasTalentData ? (view==='snapshot' ? <TalentTree talents={heroTalents} language={language}/> : <Timeline heroId={heroId} language={language}/>) : <PendingHero hero={hero} language={language}/>} 
          <div className="source-card"><span><ShieldCheck size={18}/></span><div><b>{hasTalentData?c.source:(language==='zh'?'英雄身份已由官方数据接口确认':'Hero identity confirmed by official data feed')}</b><p>{hasTalentData?(language==='zh'?'已收录 7.00 初始天赋树与 7.06 代表性变更；解析字段和译文均可追溯。':'Includes the 7.00 launch trees and representative 7.06 changes. Parsed fields and translations remain traceable.'):(language==='zh'?'英雄名称、主属性、复杂度和本地头像已经导入；历史天赋将在后续批次填充。':'Name, primary attribute, complexity, and local portrait are imported. Historical talents will follow in later batches.')}</p></div>{hasTalentData&&<a href={version==='7.00'?'https://www.dota2.com/700/gameplay':'https://www.dota2.com/706'} target="_blank">{c.official}<ExternalLink size={14}/></a>}</div>
        </section>
      </> : <GenericIndex language={language} version={version} setVersion={setVersion} category={category} setCategory={setCategory} sort={sort} setSort={setSort} talents={genericTalents}/>} 
    </main>
  </div>
}

const attributeLabel = (attribute:PrimaryAttribute, language:Language) => ({
  strength:{zh:'力量',en:'STRENGTH'}, agility:{zh:'敏捷',en:'AGILITY'}, intelligence:{zh:'智力',en:'INTELLIGENCE'}, universal:{zh:'全才',en:'UNIVERSAL'}
}[attribute][language])

function PendingHero({hero,language}:{hero:(typeof heroes)[number],language:Language}) { return <div className="pending-hero"><div className="pending-sigil"><img src={hero.image} alt=""/></div><div><span>ROSTER IMPORT COMPLETE</span><h2>{language==='zh'?'英雄已导入，天赋历史待填充':'Hero imported, talent history pending'}</h2><p>{language==='zh'?`${hero.zh} 已进入完整英雄目录。下一数据批次会从官方更新日志重建其各版本天赋树。`:`${hero.en} is now in the complete roster. A later data batch will reconstruct every talent tree from official patch notes.`}</p></div></div>}

function TalentTree({talents, language}:{talents: Talent[], language:Language}) {
  const c=copy[language]
  return <div className="tree-card"><div className="tree-head"><span>{language==='zh'?'左分支':'LEFT BRANCH'}</span><span>{language==='zh'?'天赋等级':'TALENT LEVEL'}</span><span>{language==='zh'?'右分支':'RIGHT BRANCH'}</span></div>
    {[25,20,15,10].map(level => { const left=talents.find(t=>t.level===level&&t.side==='left'), right=talents.find(t=>t.level===level&&t.side==='right'); return <div className="talent-row" key={level}>
      <TalentCell talent={left} language={language}/><div className="level-orb"><small>{c.level}</small><b>{level}</b></div><TalentCell talent={right} language={language}/>
    </div>})}
  </div>
}

function TalentCell({talent,language}:{talent?:Talent,language:Language}) { if(!talent) return <div className="talent-cell muted">—</div>; return <div className="talent-cell"><span className={talent.generic?'generic':'unique'}>{talent.generic?copy[language].generic:copy[language].unique}</span><b>{language==='zh'?talent.zh:talent.en}</b><small>{language==='zh'?talent.en:talent.zh}</small></div> }

function Timeline({heroId,language}:{heroId:HeroId,language:Language}) { const list=changes.filter(x=>x.hero===heroId); return <div className="timeline">{list.length?list.map((x,i)=><article key={i}><div className="time-mark"><span/></div><div className="time-meta"><b>{x.version}</b><small>{x.date}</small></div><div className="change-card"><span className="change-type">{x.type==='added'?(language==='zh'?'新增':'ADDED'):(language==='zh'?'替换':'REPLACED')}</span><h3>Level {x.level}</h3><p className="before">− {language==='zh'?x.beforeZh:x.beforeEn}</p><p className="after">+ {language==='zh'?x.afterZh:x.afterEn}</p></div></article>):<div className="empty"><Sparkles/>{language==='zh'?'该英雄暂未录入变更事件':'No change events imported for this hero yet'}</div>}</div> }

function GenericIndex({language,version,setVersion,category,setCategory,sort,setSort,talents}:{language:Language,version:'7.00'|'7.06',setVersion:(v:'7.00'|'7.06')=>void,category:TalentCategory|'all',setCategory:(v:TalentCategory|'all')=>void,sort:'asc'|'desc',setSort:(v:'asc'|'desc')=>void,talents:Talent[]}) {
 const c=copy[language]; return <section className="index-page"><div className="index-title"><div><span className="eyebrow">NORMALIZED TALENT DATA</span><h1>{c.index}</h1><p>{language==='zh'?'跨英雄比较可量化的通用属性天赋。独特、复合型天赋不会进入排名。':'Compare normalized generic attributes across heroes. Unique and compound talents are excluded.'}</p></div><div className="result-count"><b>{talents.length}</b><span>{c.results}</span></div></div>
 <div className="filterbar"><div><Filter size={16}/><select value={category} onChange={e=>setCategory(e.target.value as TalentCategory|'all')}><option value="all">{c.all}</option>{Object.entries(categoryLabels).map(([k,v])=><option key={k} value={k}>{v[language]}</option>)}</select></div><div><BookOpen size={16}/><select value={version} onChange={e=>setVersion(e.target.value as '7.00'|'7.06')}><option>7.06</option><option>7.00</option></select></div><button onClick={()=>setSort(sort==='desc'?'asc':'desc')}><ArrowDownUp size={16}/>{sort==='desc'?c.desc:c.asc}</button></div>
 <div className="talent-table"><div className="table-head"><span>#</span><span>{language==='zh'?'英雄':'HERO'}</span><span>{language==='zh'?'类别':'CATEGORY'}</span><span>{language==='zh'?'天赋':'TALENT'}</span><span>{language==='zh'?'等级':'LEVEL'}</span><span>{language==='zh'?'数值':'VALUE'}</span></div>{talents.map((t,i)=>{const h=heroes.find(x=>x.id===t.hero)!;return <div className="table-row" key={`${t.hero}-${t.level}-${t.side}`}><span className="rank">{String(i+1).padStart(2,'0')}</span><span className="table-hero"><i style={{'--hero':h.color} as React.CSSProperties}>{h.mark}</i><b>{language==='zh'?h.zh:h.en}</b></span><span><em>{categoryLabels[t.category!][language]}</em></span><span className="bilingual"><b>{language==='zh'?t.zh:t.en}</b><small>{language==='zh'?t.en:t.zh}</small></span><span>LV {t.level}</span><span className="value">{t.value}{t.unit==='percent'?'%':''}</span></div>})}{!talents.length&&<div className="empty"><Sparkles/>{c.empty}</div>}</div></section>
}
