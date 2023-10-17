import { Context, Schema } from 'koishi'
import Valorant, { Regions } from 'unofficial-valorant-api'

export const name = 'henrik-valorant'

export interface Config {
  token: string,
  region: Regions
}

export const Config: Schema<Config> = Schema.object({
  token: Schema
          .string()
          .description('Henrik API 令牌，使用后可增加每分钟请求次数，详情: https://github.com/Henrik-3/unofficial-valorant-api#authentication-and-rate-limits')
          .default(''),
  region: Schema
          .union(['eu', 'na', 'kr', 'ap', 'latam', 'br'])
          .description('Valorant 服务器地区')
          .default('ap')
})

export function apply(ctx: Context, config: Config) {
  // write your plugin here

  const val = new Valorant(config.token)
  

  ctx.command('val <name> <tag>', '查询 Valorant 玩家信息(不限地区)')
      .action(async ({ session }, name, tag) => {
        
      })
}
