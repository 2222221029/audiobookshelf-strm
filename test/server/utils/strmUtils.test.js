const assert = require('assert')
const fs = require('fs')
const os = require('os')
const Path = require('path')

const strmUtils = require('../../../server/utils/strmUtils')

const ENV_KEYS = [
  'STRM_SCAN_PROBE',
  'STRM_SCAN_TARGET_SIZE',
  'STRM_SCAN_SKIP_PROBE_PATHS',
  'STRM_DIRECT_URL_MAP',
  'STRM_LOG_FULL_REDIRECT_URL'
]

describe('strmUtils persistent settings', () => {
  let configPath
  let originalConfigPath
  let originalEnv

  beforeEach(() => {
    configPath = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-strm-settings-'))
    originalConfigPath = global.ConfigPath
    originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
    global.ConfigPath = configPath
  })

  afterEach(() => {
    global.ConfigPath = originalConfigPath
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
    fs.rmSync(configPath, { recursive: true, force: true })
  })

  it('saves settings and applies them immediately', async () => {
    const settings = await strmUtils.saveStrmSettings({
      scanProbe: false,
      scanTargetSize: true,
      scanSkipProbePaths: '/CloudNAS,/Remote',
      directUrlMap: '/CloudNAS=https://cloud.example/dav',
      logFullRedirectUrl: true
    })

    assert.strictEqual(settings.scanTargetSize, true)
    assert.strictEqual(process.env.STRM_SCAN_TARGET_SIZE, '1')
    assert.strictEqual(process.env.STRM_LOG_FULL_REDIRECT_URL, '1')
    assert.deepStrictEqual(strmUtils.parseDirectUrlMap(), [{
      localPrefix: '/CloudNAS',
      urlPrefix: 'https://cloud.example/dav'
    }])

    const saved = JSON.parse(fs.readFileSync(Path.join(configPath, 'strm-settings.json'), 'utf8'))
    assert.strictEqual(saved.scanTargetSize, true)
  })

  it('loads saved settings from the active config directory', () => {
    fs.writeFileSync(Path.join(configPath, 'strm-settings.json'), JSON.stringify({
      scanProbe: true,
      scanTargetSize: false,
      scanSkipProbePaths: '/CloudNAS',
      directUrlMap: '',
      logFullRedirectUrl: false
    }))

    const settings = strmUtils.loadStrmSettings()

    assert.strictEqual(settings.scanProbe, true)
    assert.strictEqual(process.env.STRM_SCAN_PROBE, '1')
  })
})
