const request = require('superagent')

const api_key = '<KEY>'

go()

async function go() {
  for (let i = 59; i <= 100; i++) {
    console.log('---------------------------')
    console.log(i)
    console.log('---------------------------')

    const response = await request
      .get('https://libraries.io/api/search')
      .query({
        sort: 'rank',
        api_key,
        per_page: 100,
        page: i
        //platforms: 'NPM'
      })

    const items = []
    for (let package of response.body) {
      const item = {
        tool: 'package'
      }

      if (!package.latest_stable_release) continue
      switch (package.platform) {
        case 'NPM':
          item.coordinates = `npm/npmjs/${
            package.name.indexOf('/') > 0 ? package.name : `-/${package.name}`
          }/${package.latest_stable_release.number}`
          break
        case 'Rubygems':
          item.coordinates = `gem/rubygems/-/${package.name}/${
            package.latest_stable_release.number
          }`
          break
        case 'NuGet':
          item.coordinates = `nuget/nuget/-/${package.name}/${
            package.latest_stable_release.number
          }`
          break
        case 'Maven':
          item.coordinates = `maven/mavencentral/${
            package.name.split(':')[0]
          }/${package.name.split(':')[1]}/${
            package.latest_stable_release.number
          }`
          break
        case 'CocoaPods':
          item.coordinates = `pod/cocoapods/-/${package.name}/${
            package.latest_stable_release.number
          }`
      }

      if (item.coordinates) {
        items.push(item)
      }
    }
    console.log(response.body.length)
    try {
      await sendHarvestRequest(items)
    } catch (e) {
      var x = e
    }
  }
}

async function sendHarvestRequest(coordinates) {
  for (let x of coordinates) {
    const response = await request
      .post(
        'https://clearlydefined-crawler-prod.azurewebsites.net/requests/later'
      )
      .set('X-token', '<TOKEN>')
      .send({
        type: 'component',
        url: `cd:/${x.coordinates}`
      })
    console.log(response.status)
  }
  //'{"type":"component", "url":"cd:/nuget/nuget/-/Newtonsoft.Json/12.0.1"}' -H "Content-Type: application/json" -H "X-token: a7aaf99c1f383e63046faba6f31343eeb444d9569fe800861e76041c" -X POST https://clearlydefined-crawler-prod.azurewebsites.net/requests/later
}

async function sendHarvestRequestThroughService(payload) {
  const response = await request
    .post('https://api.clearlydefined.io/harvest')
    .send(payload)

  console.log(response.status)
}
