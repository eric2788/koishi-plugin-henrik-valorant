import { Context, Schema, Session } from 'koishi'
import { Affinities, DefaultApiFactory } from './henrik-valorant'
import { md } from 'koishi-plugin-markdown'

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


const api = DefaultApiFactory()


async function safetyWrap<T extends { status?: number }>(session: Session<never, never>, func: Promise<T>): Promise<T | undefined> {
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

  ctx.command('valorant.info <name> <tag>', '查询 Valorant 玩家信息(不限地区)')
    .option('force', '-f [force]', { fallback: false })
    .action(async ({ session, options }, name, tag) => {
      const { data } = await safetyWrap(session, api.valorantV1AccountNameTagGet(name, tag, options.force))
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
    .option('region', '-r [region] 指定地区, 如无则使用预设', { fallback: config.region })
    .option('page', '-p [page] 指定页数', { fallback: 1 })
    .option('size', '-s [size] 指定每页数量', { fallback: 10 })
    .option('map', '-m [地图] 地图过滤', { fallback: undefined })
    .option('mode', '-mo [模式] 模式过滤', { fallback: undefined })
    .action(async ({ session, options }, name, tag) => {
      const { data } = await safetyWrap(session, api.valorantV1LifetimeMatchesAffinityNameTagGet(options.region, name, tag, options.region, options.page, options.size, options.map, options.mode))
      

    })

}
