import { useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react'
import type { Language } from './data'
import { formatGrowth, growthSnapshot, growthValue, heroGrowthRows, sortHeroGrowth, type GrowthColumn, type SortDirection } from './heroGrowth'

const columns: GrowthColumn[] = ['strength', 'agility', 'intelligence', 'total']
const labels = {
  zh: { title: '属性成长排名', hero: '英雄', strength: '力量成长', agility: '敏捷成长', intelligence: '智力成长', total: '总成长', asc: '升序', desc: '降序' },
  en: { title: 'Attribute growth', hero: 'Hero', strength: 'Strength', agility: 'Agility', intelligence: 'Intelligence', total: 'Total', asc: 'Ascending', desc: 'Descending' },
}

export default function HeroGrowthRanking({ language }: { language: Language }) {
  const [column, setColumn] = useState<GrowthColumn>('total')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const c = labels[language]
  const rows = sortHeroGrowth(heroGrowthRows, column, direction)
  const completeCount = rows.filter(row => growthValue(row.values, 'total') !== null).length
  const date = growthSnapshot.generatedAt.replace('T', ' ').slice(0, 16) + ' UTC'

  function selectSort(nextColumn: GrowthColumn, nextDirection: SortDirection) {
    setColumn(nextColumn)
    setDirection(nextDirection)
  }

  return <section className="index-page growth-page" aria-labelledby="growth-title">
    <div className="index-title">
      <div><span className="eyebrow">HERO ATTRIBUTE GROWTH</span><h1 id="growth-title">{c.title}</h1>
        <p>{language === 'zh' ? '每升一级获得的属性点。总成长 = 力量 + 敏捷 + 智力成长，不含基础属性、天赋或技能加成。' : 'Attribute points gained per level. Total = strength + agility + intelligence growth, excluding base stats, talents and abilities.'}</p>
      </div>
      <div className="result-count"><b>{rows.length}</b><span>{language === 'zh' ? '名英雄' : 'HEROES'}</span></div>
    </div>
    <p className="growth-metadata">{language === 'zh' ? 'Valve 官方当前快照' : 'Current Valve snapshot'} · <time dateTime={growthSnapshot.generatedAt}>{date}</time> · {language === 'zh' ? '接口未标注版本' : 'API patch version unspecified'}</p>
    <div className="growth-status"><span aria-live="polite">{language === 'zh' ? '当前排序' : 'Sorted by'}：<b>{c[column]} · {c[direction]}</b></span><span>{language === 'zh' ? `完整数据 ${completeCount} / ${rows.length} 名英雄` : `Complete data for ${completeCount} / ${rows.length} heroes`}</span></div>
    <p className="growth-scroll-hint" id="growth-scroll-hint">{language === 'zh' ? '点击列标题下的升序 / 降序按钮排序；窄屏可左右滑动表格。' : 'Use the arrows below each column to sort. Swipe the table horizontally on narrow screens.'}</p>
    <div className="growth-table-scroll" role="region" aria-label={c.title} aria-describedby="growth-scroll-hint" tabIndex={0}>
      <table className="growth-table">
        <caption className="sr-only">{language === 'zh' ? '全部英雄每级力量、敏捷、智力与总属性成长' : 'All heroes: strength, agility, intelligence and total growth per level'}</caption>
        <thead><tr><th scope="col">{c.hero}</th>{columns.map(key => <th scope="col" key={key} className={`growth-${key}`} aria-sort={column === key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
          <span>{c[key]}</span><small>{language === 'zh' ? '点 / 级' : 'PTS / LVL'}</small>
          <div className="growth-sort-buttons">{(['asc', 'desc'] as const).map(order => <button key={order} onClick={() => selectSort(key, order)} aria-label={`${c[key]} ${c[order]}`} aria-pressed={column === key && direction === order} title={`${c[key]} · ${c[order]}`}>
            {order === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>}<span>{language === 'zh' ? c[order] : order.toUpperCase()}</span>
          </button>)}</div>
        </th>)}</tr></thead>
        <tbody>{rows.map(({ hero, values }) => <tr key={hero.id}>
          <th scope="row"><img src={`${import.meta.env.BASE_URL}${hero.image.replace(/^\//, '')}`} alt="" width="42" height="28" loading="lazy"/><span>{language === 'zh' ? hero.zh : hero.en}</span></th>
          {columns.map(key => <td key={key} className={`growth-${key}${column === key ? ' sorted' : ''}`} title={growthValue(values, key) === null ? language === 'zh' ? '数据缺失' : 'Data unavailable' : undefined}>{formatGrowth(growthValue(values, key))}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <div className="growth-source">
      <p><a href={growthSnapshot.heroDataUrl.replace('{id}', '1')} target="_blank" rel="noreferrer">Valve Dota 2 herodata <ExternalLink size={12}/></a> · <a href={growthSnapshot.rosterUrl} target="_blank" rel="noreferrer">{language === 'zh' ? '官方英雄名单' : 'Official roster'}</a> · <a href={growthSnapshot.patchListUrl} target="_blank" rel="noreferrer">{language === 'zh' ? '补丁列表' : 'Patch list'}</a> · {language === 'zh' ? '抓取于' : 'Retrieved'} <time dateTime={growthSnapshot.generatedAt}>{date}</time></p>
      <p>{language === 'zh' ? `官方当前数据快照；接口未标注版本。抓取时最新补丁公告为 ${growthSnapshot.latestListedPatch}，不代表逐项验证了该补丁。此表不随天赋档案的历史版本切换。` : `Current official snapshot; the API does not specify a patch version. Latest listed patch at retrieval: ${growthSnapshot.latestListedPatch}; values are not individually verified against that patch. This table is independent of the talent archive’s historical patch selection.`}</p>
      {completeCount < rows.length && <p role="status">{language === 'zh' ? '缺失数据以 — 标记，并排在末尾；三项不全时不计算总成长。' : 'Missing values appear as — and sort last; total is unavailable if any attribute is missing.'}</p>}
    </div>
  </section>
}
