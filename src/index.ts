import { Context, Schema, Session, Tables } from 'koishi'
import { Affinities, DefaultApiFactory, V1LifetimeMatchesItem } from './henrik-valorant'
import { md } from 'koishi-plugin-markdown'
import { Cache } from './cache'

export const using = ['cache']
export const name = 'henrik-valorant'

export interface Config {
  api: string,
  token: string,
  region: Affinities
}

export const Config: Schema<Config> = Schema.object({
  api: Schema.string().default('https://api.henrikdev.xyz/').description('默认API地址，国内可改用cf-worker地址加快存取'),
  token: Schema
    .string()
    .description('Henrik API 令牌，使用后可增加每分钟请求次数，详情: https://github.com/Henrik-3/unofficial-valorant-api#authentication-and-rate-limits')
    .default(''),
  region: Schema
    .union([
      Schema.const(Affinities.Eu).description('欧洲'), 
      Schema.const(Affinities.Na).description('北美'), 
      Schema.const(Affinities.Ap).description('亚太'), 
      Schema.const(Affinities.Latam).description('拉丁美洲'),, 
      Schema.const(Affinities.Kr).description('韩国'), 
      Schema.const(Affinities.Br).description('巴西'),
    ])
    .description('预设请求的服务器地区')
    .default(Affinities.Ap)
})


async function query<T extends { status?: number }>(session: Session<never, never>, func: Promise<T>): Promise<T | undefined> {
  try {
    await session.send('正在查询，请稍后...')
    const res = await func
    if (res.status === 200) {
      return res
    }
    await session.send(`查询失败: ${res.status}`)
  }catch(err){
    console.error(err)
    await session.send(`查询失败: ${err?.message ?? err}`)
  }
  return undefined;
}


export function apply(ctx: Context, config: Config) {
  // write your plugin here
  const api = DefaultApiFactory(undefined, undefined, config.api)
  const shortIdCache = new Cache(ctx, 'valorant-short-id')


  async function shortenMatchIds(longIds: string[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>()
    for (const i of longIds) {
      const id = await shortIdCache.get(i)
      if (id) {
        ids.set(i, id)
      } else {
        const newShortId = (await shortIdCache.size()) + 1
        await shortIdCache.set(newShortId.toString(), i)
        ids.set(i, newShortId.toString())
      }
    }
    return ids
  }

  ctx.command('valorant.info <name> <tag>', '查询 Valorant 玩家信息(不限地区)')
    .alias('val.info', '瓦.信息')
    .option('force', '-f [force]', { fallback: false })
    .action(async ({ session, options }, name, tag) => {
      const { data } = await query(session, api.valorantV1AccountNameTagGet(name, tag, options.force))
      if (!data) return
      await session.send(md`
        ![card](${data.card.small})
        名称: ${data.name}
        地区: ${data.region}
        账户等级: ${data.account_level}
        API上次更新: ${new Date(data.last_update_row * 1000)?.toLocaleString() ?? data.last_update}
      `)
  })


  ctx.command('valorant.matches <name> <tag>', '查询 Valorant 玩家最近的比赛记录(不限地区)')
    .alias('val.matches', '瓦.比赛记录')
    .option('region', '-r [region] 指定地区, 如无则使用预设', { fallback: config.region })
    .option('page', '-p [page] 指定页数', { fallback: 1 })
    .option('size', '-s [size] 指定每页数量', { fallback: 10 })
    .option('map', '-m [地图] 地图过滤', { fallback: undefined })
    .option('mode', '-mo [模式] 模式过滤', { fallback: undefined })
    .action(async ({ session, options }, name, tag) => {
      const { data } = await query(session, api.valorantV1LifetimeMatchesAffinityNameTagGet(options.region, name, tag, options.map, options.mode, options.page, options.size))
      if (!data) return

      const shorts = await shortenMatchIds(data.map((match) => match.meta.id))

      await session.send(md`
        玩家 ${name}#${tag} 最近的比赛记录:
        
        ---
        ${data.map((match) => {
          return md`
            ID: ${match.meta.id} ${match.meta.id in shorts ? `(短号: ${shorts[match.meta.id]})` : ''}
            模式: ${match.meta.mode}
            地图: ${match.meta.map.name}
            使用角色: ${match.stats.character.name}
            比分: ${displayTeamScores(match.teams)} (用户所在队伍: ${match.stats.team})
            K/D/A: ${match.stats.kills} / ${match.stats.deaths} / ${match.stats.assists}
            爆头率: ${calculateHeadShotPercentage(match.stats.shots)}%
            开始时间: ${new Date(match.meta.started_at).toLocaleString()}
            服务器: ${match.meta.cluster}

            ---
          `
        }).join('\n')}
      `)
    })


    ctx.command('valorant.leaderboard <match-id>', '查看该场比赛的排行榜')
      .alias('val.lb', '瓦.排行')
      .action(async ({ session }, matchId) => {
        const { data } = await query(session, api.valorantV2MatchMatchIdGet(matchId))
        if (!data) return
        await session.send(md`
          玩家 
        `)
      })
}
