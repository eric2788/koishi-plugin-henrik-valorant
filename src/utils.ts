import { Affinities } from "./henrik-valorant"


export function displayTeamScores(teams: any): string {
    const red = teams['red'] ?? 0
    const blue = teams['blue'] ?? 0
    return `Red ${red} : ${blue} Blue`
}

export function calculateHeadShotPercentage(shots: any, head = 'head', body = 'body', legs = 'leg'): number {
    console.debug(shots, head, body, legs)
    const total = shots[head] + shots[body] + shots[legs]
    return Math.round((shots[head] / total) * 100)
}


export function getPlantCount(match: any, user: string): number {
    let counts = 0
    for (const round of (match.rounds as any[])) {
        if (round.plant_events?.planted_by?.puuid === user) {
            counts++;
        }
    }
    return counts
}

export function displayPageFeed(results: any, page: number): string {
    return `第 ${page} / ${Math.ceil(results.total / results.returned)} 页，共 ${results.total} 条结果 (每页显示: ${results.returned} 条)`
}

export function getDefuseCount(match: any, user: string): number {
    let counts = 0
    for (const round of (match.rounds as any[])) {
        if (round.defuse_events?.defused_by?.puuid === user) {
            counts++;
        }
    }
    return counts
}

export function parseNameTag(nametag: string): [string, string] {
    if (!nametag) throw new Error('无效的名称标签，正确格式为: 名称#标签')
    const [name, tag] = nametag.split('#')
    if (!name || !tag) throw new Error('无效的名称标签，正确格式为: 名称#标签')
    return [name, tag]
}


export function regionName(region: `${Affinities}`): string {
    switch(region) {
        case 'ap': return '亚太';
        case 'na': return '北美';
        case 'eu': return '欧洲';
        case 'kr': return '韩国';
        case 'br': return '巴西';
        case 'latam': return '拉丁美洲';
        default: return '未知';
    }
}