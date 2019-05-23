const parse = require('csv-parse')
const async = require('async')
const fs = require('fs')
const request = require('superagent')
const inputFile = 'data.csv'
const {promisify} = require('util')
const child_process = require('child_process')
const execFile = promisify(child_process.execFile)
const uuidv1 = require('uuid/v1')
const Bottleneck = require('bottleneck').default
const limiter = new Bottleneck({maxConcurrent: 10})

const results = []
const parser = parse({delimiter: ','}, function(err, data) {
  async.eachSeries(data, function(line, callback) {
    process(line[0], line[1])
      .then(function(result) {
        if (result) console.log(result)
      })
      .catch(e => {
        // ignore
      })
    callback()
  })
})
fs.createReadStream(inputFile).pipe(parser)

function process(name, revision) {
  return limiter.wrap(async () => {
    // https://api.nuget.org/v3/catalog0/data/2018.10.29.04.23.22/xunit.core.2.4.1.json
    const registry = await request(
      `https://api.nuget.org/v3/registration3/${name.toLowerCase()}/${revision.toLowerCase()}.json`
    )
    if (!registry || !registry.body.catalogEntry) return
    const catalogEntry = await request(registry.body.catalogEntry)
    if (!catalogEntry || !catalogEntry.body.licenseUrl) return

    let licenseUrl = catalogEntry.body.licenseUrl
    if (licenseUrl.indexOf('github.com') > 0)
      licenseUrl = licenseUrl.replace('/blob/', '/raw/')

    const licensePayload = await request(licenseUrl)
    if (!licensePayload || !licensePayload.body) return

    const folder = `/users/dan/licenseehold/${uuidv1()}`
    const file = `${folder}/LICENSE`
    fs.mkdirSync(folder)
    fs.writeFileSync(file, licensePayload.text)
    try {
      const {stdout} = await execFile(
        'licensee',
        ['detect', '--json', '--no-readme', folder],
        {
          maxBuffer: 5000 * 1024
        }
      )
      if (!stdout.trim()) return
      const result = JSON.parse(stdout)
      const matched_license = result.matched_files[0].matched_license
      if (!matched_license || matched_license === 'NOASSERTION') return
      return `${name},${revision},${licenseUrl},${
        registry.body.catalogEntry
      },${matched_license}`
    } catch (error) {
      return
    }
  })()
}
