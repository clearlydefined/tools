const MongoClient = require('mongodb').MongoClient
const fs = require('fs')

const url = `mongodb://<ACCOUNT>:${encodeURIComponent(
  '<KEY>'
)}@<URL>:10255/?ssl=true&replicaSet=globaldb`
const dbName = 'clearlydefined'

MongoClient.connect(url, async (err, client) => {
  const col = client.db(dbName).collection('definitions-paged')
  let cursor = col
    .find({
      '_mongo.page': 1,
      'coordinates.type': 'nuget',
      'licensed.declared': 'NOASSERTION',
      'files.token': {$exists: true}
    })
    .project({'files.token': 1})
    .limit(20000)

  const tokens = new Set()
  await cursor.forEach(x => {
    if (x.files) {
      for (let i = 0; i < x.files.length; i++) {
        if (x.files[i].token) {
          tokens.add(x.files[i].token)
        }
      }
    }
  })
  console.log(JSON.stringify(Array.from(tokens)))
})
