/*
harvest from coordinates list
Reads coordinates list from external file (CSV or JSON)
*/
const fs = require('fs')
const LineByLineReader = require('line-by-line')
const request = require('request-promise-native')

//goSmallOnly()
go()

// !!! flat files only !!!
async function go() {
  const lr = new LineByLineReader('missed.csv')

  let i = 0
  let items = []
  lr.on('line', async coordinates => {
    i++
    const item = {
      tool: 'component',
      coordinates: coordinates.replace(/\"/g, '')
    }
    items.push(item)

    if (i % 50 === 0) {
      lr.pause()
      console.log(`sending ${items.length} items`)
      await sendHarvestRequest(items)
      items = []
      lr.resume()
    }
  }).on('end', async () => {
    console.log(`sending final ${items.length} items`)
    await sendHarvestRequest(items)
    //await sendHarvestRequestAtCrawler(items)
  })
}

// !!! small JSON array files only !!!
async function goSmallOnly() {
  const coordinates = JSON.parse(
    fs
      .readFileSync('coordinates.json')
      .toString()
      .trim()
  )

  const items = []
  for (let i = 0; i < coordinates.length; i++) {
    const item = {
      tool: 'package',
      coordinates: coordinates[i]
    }
    items.push(item)
  }

  const chunkSize = 500
  for (let i = 0; i < items.length; i += chunkSize) {
    console.log('requesting ' + i + ' of ' + items.length)
    await sendHarvestRequest(items.slice(i, i + chunkSize))
  }
}

async function sendHarvestRequest(payload) {
  const response = await request('https://api.clearlydefined.io/harvest', {
    method: 'post',
    json: payload
  })
  console.log(response)
}
