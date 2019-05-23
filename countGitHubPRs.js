/*
Usage: node countGitHubPRs
Output:
10 total PRs
8 merged PRs
8 timely PRs
*/

const octokit = require('@octokit/rest')()

const startDate = '2019-05-11T00:00:00Z'

go()

async function go() {
  let allPrs = []
  let page = 1
  let response
  do {
    response = await octokit.pullRequests.list({
      owner: 'clearlydefined',
      repo: 'curated-data',
      state: 'all',
      per_page: 100,
      page
    })
    allPrs = allPrs.concat(response.data)
    page++
  } while (response.data.length === 100)

  allPrs = allPrs.filter(x => new Date(x.created_at) > new Date(startDate))
  const mergedPrs = allPrs.filter(x => x.merged_at)
  const timelyMergedPrs = mergedPrs.filter(x => {
    const msElapsed = new Date(x.merged_at) - new Date(x.created_at)
    const daysElapsed = msElapsed / 1000 / 60 / 60 / 24
    return daysElapsed < 7
  })

  console.log(`${allPrs.length} total PRs`)
  console.log(`${mergedPrs.length} merged PRs`)
  console.log(`${timelyMergedPrs.length} timely PRs`)
}
