const request = require('superagent')
const _ = require('lodash')
const fs = require('fs')

const type = 'npm'

go()

async function go() {
  let coordinatesList = []
  let skip = 0
  let top = 1000
  let data = []

  do {
    try {
      const response = await request
        .get(
          `https://<ACCOUNT>.search.windows.net/indexes/definitions/docs?api-version=2017-11-11&search=*&%24filter=type%20eq%20'${type}'&%24select=coordinates&$skip=${skip}&$top=${top}`
        )
        .set('api-key', '<KEY>')
        .send()
      data = _.get(response, 'body.value') || []
      coordinatesList = coordinatesList.concat(data.map(x => x.coordinates))
      skip += top
    } catch (e) {
      console.log(e)
      data = []
    }
  } while (data.length)

  fs.writeFileSync(`coordinates_${type}`, JSON.stringify(coordinatesList))
}
