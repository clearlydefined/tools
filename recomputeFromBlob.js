const azure = require('azure-storage')
const request = require('superagent')
const _ = require('lodash')

const blobService = azure.createBlobService(
  'DefaultEndpointsProtocol=https;AccountName=<ACCOUNT>;AccountKey=<KEY>;'
)

go()

async function go() {
  let continuation = null
  const prefixes = [
    'npm/npmjs/-/a',
    'npm/npmjs/-/b',
    'npm/npmjs/-/c',
    'npm/npmjs/-/d',
    'npm/npmjs/-/e',
    'npm/npmjs/-/f',
    'npm/npmjs/-/g',
    'npm/npmjs/-/h',
    'npm/npmjs/-/i',
    'npm/npmjs/-/j',
    'npm/npmjs/-/k',
    'npm/npmjs/-/l',
    'npm/npmjs/-/m',
    'npm/npmjs/-/n',
    'npm/npmjs/-/o',
    'npm/npmjs/-/p',
    'npm/npmjs/-/q',
    'npm/npmjs/-/r',
    'npm/npmjs/-/s',
    'npm/npmjs/-/t',
    'npm/npmjs/-/u',
    'npm/npmjs/-/v',
    'npm/npmjs/-/w',
    'npm/npmjs/-/x',
    'npm/npmjs/-/y',
    'npm/npmjs/-/z'
  ]
  for (let prefix of prefixes) {
    do {
      await new Promise(resolve => {
        blobService.listBlobsSegmentedWithPrefix(
          'production',
          prefix,
          continuation,
          {maxResults: 500},
          async (error, result) => {
            const coordinatesList = _.uniq(
              result.entries.map(x => _toCoordinates(x.name)).filter(x => x)
            )
            await sendGetDefinitionRequest(coordinatesList)
            continuation = result.continuationToken
            console.log('next')
            console.log(coordinatesList[0])
            resolve()
          }
        )
      })
    } while (continuation !== null)
  }
}

function _toCoordinates(name) {
  if (name.startsWith('attachment/') || name.startsWith('deadletter'))
    return null
  ;[a, b, c, d, e, f] = name.split('/')
  return (coordinates = [a, b, c, d, f].join('/'))
}

async function sendGetDefinitionRequest(coordinatesList) {
  try {
    const response = await request
      .post('https://api.clearlydefined.io/definitions?expand=-files')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(coordinatesList))
    console.log(response.status)
  } catch (e) {
    console.log(JSON.stringify(coordinatesList))
    throw e
  }
}
