/*
send harvest requests directly to a crawler
Usage: node sendHarvestRequest npm/npmjs/-/glob/7.1.3
Output: Created
*/

const request = require('superagent')

sendHarvestRequest(process.argv[3])

async function sendHarvestRequest(coordinates) {
  const response = await request
    .post('https://<CrawlerURL>/requests/later')
    .set('X-token', '<TOKEN_HERE>')
    .send({
      type: 'component',
      url: `cd:/${coordinates}`
    })
  console.log(response.status)
}
