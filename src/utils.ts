function displayTeamScores(teams: any): string {
    const red = teams['red'] ?? 0
    const blue = teams['blue'] ?? 0
    return `Red ${red} : ${blue} Blue`
}

function calculateHeadShotPercentage(shots: any): number {
    const total = shots.head + shots.body + shots.legs
    return Math.round((shots.head / total) * 100)
}