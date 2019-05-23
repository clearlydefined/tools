// harvest from coordinates query

const request = require('request-promise-native')
const MongoClient = require('mongodb').MongoClient
const url = `mongodb://<ACCOUNT>:${encodeURIComponent(
  '<KEY>'
)}@<URL>:10255/?ssl=true&replicaSet=globaldb`
const dbName = 'clearlydefined'
const collectionName = 'definitions'
const pageSize = 1000

go()

async function go() {
  MongoClient.connect(url, async (err, client) => {
    if (err) throw err
    const col = client.db(dbName).collection(collectionName)
    let results = []
    let page = 0 // RESET TO CURRENT PAGE
    do {
      results = await col
        .find()
        //.find({'described.tools': {$nin: ['clearlydefined/1.1.3']}}, {_id: 1})
        .skip(page * pageSize)
        .limit(pageSize)
        .toArray()
      await sendHarvestRequest(
        results.map(x => {
          return {tool: 'component', coordinates: x._id}
        })
      )
      page++
      console.log(page)
    } while (results.length > 0)
    client.close()
  })
}

async function sendHarvestRequest(payload) {
  const response = await request('https://api.clearlydefined.io/harvest', {
    method: 'post',
    json: payload
  })
  console.log(response)
}
