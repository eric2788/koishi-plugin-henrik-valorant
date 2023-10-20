import { Context, Schema, Session, Command, h } from 'koishi'
import { Affinities, Configuration, DefaultApiFactory } from './henrik-valorant'
import { Cache } from './cache'
import { Response } from 'node-fetch-commonjs'
import { getDefuseCount, getPlantCount, calculateHeadShotPercentage, displayTeamScores, parseNameTag, regionName, displayPageFeed, parseShortId } from './utils'

export const using = ['cache']
export const name = 'henrik-valorant'
export const usage = `查询瓦罗兰特外服战绩的插件`

export interface Config {
  api: string,
  token: string,
  region: `${Affinities}`
}

export const Config: Schema<Config> = Schema.object({
  api: Schema.string().default('https://api.henrikdev.xyz').description('默认API地址，国内可改用cf-worker地址加快存取'),
  token: Schema
    .string()
    .description('Henrik API 令牌，使用后可增加每分钟请求次数，详情: https://github.com/Henrik-3/unofficial-valorant-api#authentication-and-rate-limits')
    .role('secret')
    .default(''),
  region: Schema
    .union([
      Schema.const('eu').description('欧洲'),
      Schema.const('na').description('北美'),
      Schema.const('ap').description('亚太'),
      Schema.const('latam').description('拉丁美洲'),
      Schema.const('kr').description('韩国'),
      Schema.const('br').description('巴西'),
    ])
    .description('预设请求的服务器地区')
    .default('ap')
})


async function query<T extends { status?: number }>(session: Session<never, never>, func: Promise<T>): Promise<T | undefined> {
  try {
    await session.send('正在查询，请稍后...')
    const res = await func
    if (res.status === 200) {
      return res
    }
    await session.send(`查询失败: ${res.status}`)
  } catch (err) {

    let message = undefined
    // henrik api error
    if (err instanceof Response) {
      const errResponse: any = await err.json()
      console.error(errResponse)
      if ('errors' in errResponse) {
        message = (errResponse.errors as any[]).map((e) => e.message).join('\n')
      } else {
        message = `${JSON.stringify(errResponse)} (${err.url})`
      }
    } else {
      console.error(err)
    }
    await session.send(`查询失败: ${message} ${err.status ? `(${err.status})` : ''}`)
  }
  return undefined;
}

const cmdConfig: Command.Config = {
  checkArgCount: true,
  checkUnknown: true,
  handleError: (err, { session, command }) => {
    console.error(err)
    session.send(`执行指令 ${command.displayName} 时出现错误: ${err.message ?? err}`)
  }
}

const httpConfig = new Configuration();

export function apply(ctx: Context, config: Config) {

  // write your plugin here
  httpConfig.apiKey = config.token;
  const api = DefaultApiFactory(httpConfig, undefined, config.api)
  const shortIdCache = new Cache(ctx, 'valorant-short-id')
  const longIdCache = new Cache(ctx, 'valorant-long-id')
  const idSeqCache = new Cache(ctx, 'valorant-id-seq')


  async function shortenMatchIds(longIds: string[]): Promise<{ [key: string]: string }> {
    const ids: { [key: string]: string } = {}
    for (const i of longIds) {
      if (!i) continue
      const id = await longIdCache.get(i)
      if (id) {
        ids[i] = id
      } else {
        const lastSeq = await idSeqCache.get('last_seq')
        const newShortId = (lastSeq ?? 0) + 1;
        await Promise.all([
          shortIdCache.set(newShortId.toString(), i),
          longIdCache.set(i, newShortId.toString()),
          idSeqCache.set('last_seq', newShortId)
        ])
        ids[i] = newShortId.toString()
      }
    }
    return ids
  }

  ctx.command('valorant.info <nametag>', '查询 Valorant 玩家信息(不限地区)', cmdConfig)
    .alias('valinfo', '瓦查询')
    .option('force', '-f [force]', { fallback: false })
    .action(async ({ session, options }, nametag) => {
      const [name, tag] = parseNameTag(nametag)
      const res = await query(session, api.valorantV1AccountNameTagGet(name, tag, options.force))
      if (!res) return
      const { data } = res;

      await session.send(<div>
        <image url={data.card.small} />
        <p>名称: {data.name}#{data.tag}</p>
        <p>地区: {regionName(data.region)}</p>
        <p>账户等级: {data.account_level}</p>
        <p>API上次更新: {new Date(data.last_update_raw * 1000)?.toLocaleString() ?? data.last_update}</p>
      </div>)
    })

  ctx.command('valorant.matches <nametag>', '查询 Valorant 玩家最近的对战记录', cmdConfig)
    .alias('valmatches', '瓦对战记录')
    .option('region', '-r [region] 指定地区, 如无则使用预设', { fallback: config.region })
    .option('page', '-p [page] 指定页数', { fallback: 1 })
    .option('size', '-s [size] 指定每页数量', { fallback: 10 })
    .option('map', '-m [地图] 地图过滤, 例如 -m Bind', { fallback: undefined })
    .option('mode', '-o [模式] 模式过滤(全小写), 例如 -o deathmatch', { fallback: undefined })
    .action(async ({ session, options }, nametag) => {

      const [name, tag] = parseNameTag(nametag)

      const res = await query(session, api.valorantV1LifetimeMatchesAffinityNameTagGet(options.region, name, tag, options.mode, options.map, options.page, options.size))
      if (!res) return

      const { data, results } = res;

      const shorts = await shortenMatchIds(data.map((match) => match.meta.id))

      await session.send(<div>
        <p>玩家 {name}#{tag} 最近的对战记录:</p>
        <p>----------------</p>
        {data.map((match) => (<div>
          <p>ID: {match.meta.id} {shorts[match.meta.id] ? <span>(短号: {shorts[match.meta.id]})</span> : <></>}</p>
          <p>模式: {match.meta.mode}</p>
          <p>地图: {match.meta.map.name}</p>
          <p>使用角色: {match.stats.character.name}</p>
          {match.meta.mode === 'Deathmatch' ? <></> : <p>比分: {displayTeamScores(match.teams)} (用户所在队伍: {match.stats.team})</p>}
          <p>K/D/A: {match.stats.kills} / {match.stats.deaths} / {match.stats.assists}</p>
          {match.meta.mode === 'Deathmatch' ? <></> : <p>爆头率: {calculateHeadShotPercentage(match.stats.shots)}%</p>}
          <p>开始时间: {new Date(match.meta.started_at).toLocaleString()}</p>
          <p>服务器: {match.meta.cluster} ({regionName(match.meta.region)})</p>
          <p>----------------</p>
        </div>))}
        <p></p>
        <p>{displayPageFeed(results, options.page)}</p>
      </div>)
    })

  ctx.command('valorant.match <match-id>', '查看这场比赛的信息', cmdConfig)
    .alias('valmatch', '瓦对战')
    .action(async ({ session }, matchId) => {

      matchId = await parseShortId(matchId, shortIdCache)
      if (!matchId) {
        await session.send('找不到此短号相对应的对战ID')
        return
      }

      const res = await query(session, api.valorantV2MatchMatchIdGet(matchId))
      if (!res) return

      const { data: match } = res;

      await session.send(<div>
        <p>ID: {matchId} </p>
        <p>模式: {match.metadata.mode}</p>
        <p>地图: {match.metadata.map}</p>
        {match.metadata.mode_id === "deathmatch" ?
          <></> :
          <p>比分: {match.teams.red.has_won ? '(胜利)' : ''} Red {match.teams.red.rounds_won} : {match.teams.blue.rounds_won} Blue {match.teams.blue.has_won ? '(胜利)' : ''}</p>}
        <p>开始时间: {new Date(match.metadata.game_start * 1000).toLocaleString()}</p>
        <p>总时长: {Math.round(match.metadata.game_length / 60)} 分钟</p>
        <p>总回合: {match.metadata.rounds_played}</p>
        <p>服务器: {match.metadata.cluster} ({regionName(match.metadata.region)})</p>
      </div>)

    })

  ctx.command('valorant.leaderboard <match-id>', '查看该场比赛的排行榜', cmdConfig)
    .alias('vallb', '瓦排行')
    .action(async ({ session }, matchId) => {

      matchId = await parseShortId(matchId, shortIdCache)
      if (!matchId) {
        await session.send('找不到此短号相对应的对战ID')
        return
      }

      const res = await query(session, api.valorantV2MatchMatchIdGet(matchId))
      if (!res) return

      const { data } = res;


      await session.send(<div>
        <p>对战 {matchId} 的排行榜:</p>
        <p>----------------</p>
        {(data.players.all_players as any[])
          .sort((a, b) => b.stats.score - a.stats.score)
          .map((player, i) => (<div>
            <p>{i + 1}. {player.name}#{player.tag} ({player.character})</p>
            {data.metadata.mode_id === 'competitive' ? <p>段位: {player.currenttier_patched}</p> : <></>}
            {data.metadata.mode_id === 'deathmatch' ? <></> : <p>队伍: {player.team}</p>}
            <p>均分: {player.stats.score}</p>
            <p>K/D/A: {player.stats.kills} / {player.stats.deaths} / {player.stats.assists}</p>
            <p>爆头率: {calculateHeadShotPercentage(player.stats, 'headshots', 'bodyshots', 'legshots')}%</p>
            <p>装包次数: {getPlantCount(data, player.puuid)}</p>
            <p>拆包次数: {getDefuseCount(data, player.puuid)}</p>
            <image url={player.assets.agent.killfeed} />
            <p>----------------</p>
          </div>))}
      </div>)

    })


  ctx.command('valorant.mmr <nametag>', '查询 Valorant 玩家的段位', cmdConfig)
    .alias('valmmr', '瓦段位')
    .option('region', '-r [region] 指定地区, 如无则使用预设', { fallback: config.region })
    .action(async ({ session, options }, nametag) => {

      const [name, tag] = parseNameTag(nametag)

      const res = await query(session, api.valorantV2MmrAffinityNameTagGet(name, tag, options.region))
      if (!res) return

      const { data: { current_data: data } } = res;

      if (!data || data == null) {
        await session.send('找不到该玩家的段位信息')
        return
      } 

      await session.send(<div>
        <p>玩家 {name}#{tag} 的段位信息:</p>
        <p>----------------</p>
        <p>目前段位: {data.currenttierpatched}</p>
        <p>目前段位分数: {data.ranking_in_tier}/100</p>
        <p>上一次的分数变更: {data.mmr_change_to_last_game < 0 ? '' : '+'}{data.mmr_change_to_last_game}</p>
        <p>ELO: {data.elo}</p>
        <p>----------------</p>
        { data.images ? <image url={data.images.large ?? data.images.small} /> : <></>}
      </div>)
    })

  ctx.command('valorant.mmrhistory <nametag>', '查询 Valorant 玩家的段位变化历史', cmdConfig)
    .alias('valmmrh', '瓦段位历史')
    .option('region', '-r [region] 指定地区, 如无则使用预设', { fallback: config.region })
    .option('page', '-p [page] 指定页数', { fallback: 1 })
    .option('size', '-s [size] 指定每页数量', { fallback: 10 })
    .action(async ({ session, options }, nametag) => {

      const [name, tag] = parseNameTag(nametag)

      const res = await query(session, api.valorantV1LifetimeMmrHistoryAffinityNameTagGet(options.region, name, tag, options.page, options.size))
      if (!res) return

      const { data, results } = res;

      const shorts = await shortenMatchIds(data.map((history) => history.match_id))

      await session.send(<div>
        <p>玩家 {name}#{tag} 的段位变化历史:</p>
        <p>----------------</p>
        {data.map((history) => (<div>
          <p>日期: {new Date(history.date).toLocaleString()}</p>
          <p>段位: {history.tier.name} </p>
          <p>对战ID: {history.match_id} {shorts[history.match_id] ? <span>(短号: {shorts[history.match_id]})</span> : <></>}</p>
          <p>地图: {history.map.name}</p>
          <p>分数变更: {history.last_mmr_change < 0 ? '' : '+'}{history.last_mmr_change}</p>
          <p>----------------</p>
        </div>))}
        <p></p>
        <p>{displayPageFeed(results, options.page)}</p>
      </div>)

    })
}