# koishi-plugin-henrik-valorant

[![npm](https://img.shields.io/npm/v/koishi-plugin-henrik-valorant?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-henrik-valorant)

外服瓦洛兰特战绩查询工具，API源自 [valorant-unofficial-api](https://github.com/Henrik-3/unofficial-valorant-api)

### 目前封装的功能

- 玩家信息
- 目前段位
- 对战历史
- 对战详细内容
- 对战排行榜
- 段位历史


### API Token 的作用

作用在于增加每分钟的请求次数量，申请需要到该作者所属的Discord服务器申请Token.

详情(需要自行翻译): https://github.com/Henrik-3/unofficial-valorant-api#authentication-and-rate-limits


### API 地址反代

由于该API的服务器在国外，请求速度可能较慢，因此我这边提供了由cloudflare worker生成的反代网址，可以在配置中使用:

```
https://henrik.ericlamm.workers.dev
```