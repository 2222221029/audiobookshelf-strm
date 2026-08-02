const axios = require('axios')
const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const { filePathToPOSIX } = require('./fileUtils')

const STRM_COMMENT_PREFIXES = ['#', '//']
const DEFAULT_PROBE_SKIP_PREFIXES = ['/CloudNAS']
const remoteUrlCache = new Map()
const STRM_SETTINGS_FILE = 'strm-settings.json'
const STRM_SETTING_ENV_MAP = {
  scanProbe: 'STRM_SCAN_PROBE',
  scanTargetSize: 'STRM_SCAN_TARGET_SIZE',
  scanSkipProbePaths: 'STRM_SCAN_SKIP_PROBE_PATHS',
  directUrlMap: 'STRM_DIRECT_URL_MAP',
  logFullRedirectUrl: 'STRM_LOG_FULL_REDIRECT_URL'
}
let loadedSettingsPath = null

function getStrmSettingsPath() {
  return global.ConfigPath ? Path.join(global.ConfigPath, STRM_SETTINGS_FILE) : null
}

function normalizeStrmSettings(settings = {}) {
  return {
    scanProbe: settings.scanProbe === true || settings.scanProbe === '1',
    scanTargetSize: settings.scanTargetSize === true || settings.scanTargetSize === '1',
    scanSkipProbePaths: String(settings.scanSkipProbePaths || '/CloudNAS'),
    directUrlMap: String(settings.directUrlMap || ''),
    logFullRedirectUrl: settings.logFullRedirectUrl === true || settings.logFullRedirectUrl === '1'
  }
}

function applyStrmSettings(settings = {}) {
  const normalized = normalizeStrmSettings(settings)
  for (const [key, envName] of Object.entries(STRM_SETTING_ENV_MAP)) {
    const value = normalized[key]
    process.env[envName] = typeof value === 'boolean' ? (value ? '1' : '0') : value
  }
  return normalized
}

function getStrmSettings() {
  return normalizeStrmSettings({
    scanProbe: process.env.STRM_SCAN_PROBE,
    scanTargetSize: process.env.STRM_SCAN_TARGET_SIZE || process.env.STRM_SCAN_URL_SIZE,
    scanSkipProbePaths: process.env.STRM_SCAN_SKIP_PROBE_PATHS,
    directUrlMap: process.env.STRM_DIRECT_URL_MAP,
    logFullRedirectUrl: process.env.STRM_LOG_FULL_REDIRECT_URL
  })
}
module.exports.getStrmSettings = getStrmSettings

function loadStrmSettings() {
  const settingsPath = getStrmSettingsPath()
  if (!settingsPath || loadedSettingsPath === settingsPath) return getStrmSettings()
  loadedSettingsPath = settingsPath

  try {
    if (!fs.existsSync(settingsPath)) return getStrmSettings()
    const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    const normalized = applyStrmSettings(savedSettings)
    Logger.info('[STRM] Loaded persistent settings from config')
    return normalized
  } catch (error) {
    Logger.error('[STRM] Failed to load persistent settings: ' + error.message)
    return getStrmSettings()
  }
}
module.exports.loadStrmSettings = loadStrmSettings

async function saveStrmSettings(settings) {
  const settingsPath = getStrmSettingsPath()
  if (!settingsPath) throw new Error('Config path is not available')
  const normalized = applyStrmSettings(settings)
  await fs.writeFile(settingsPath, JSON.stringify(normalized, null, 2), 'utf8')
  loadedSettingsPath = settingsPath
  Logger.info('[STRM] Persistent settings updated')
  return normalized
}
module.exports.saveStrmSettings = saveStrmSettings

function getStrmCacheStatus() {
  const now = Date.now()
  for (const [key, value] of remoteUrlCache.entries()) {
    if (!value || value.expiresAt <= now) remoteUrlCache.delete(key)
  }
  return {
    entries: remoteUrlCache.size,
    items: [...remoteUrlCache.entries()].map(([source, value]) => {
      let host = 'unknown'
      try {
        host = new URL(source).host
      } catch (error) {}
      return { host, expiresAt: value.expiresAt }
    })
  }
}
module.exports.getStrmCacheStatus = getStrmCacheStatus

function clearStrmRemoteUrlCache() {
  const entries = remoteUrlCache.size
  remoteUrlCache.clear()
  Logger.info('[STRM] Cleared ' + entries + ' cached redirect URL(s)')
  return entries
}
module.exports.clearStrmRemoteUrlCache = clearStrmRemoteUrlCache

function getCachedRemoteUrl(remoteUrl) {
  const cached = remoteUrlCache.get(remoteUrl)
  if (!cached || cached.expiresAt <= Date.now()) {
    remoteUrlCache.delete(remoteUrl)
    return null
  }
  return cached.url
}

function cacheRemoteUrl(remoteUrl, resolvedUrl) {
  if (!resolvedUrl || resolvedUrl === remoteUrl) return

  // 115-style signed URLs commonly expose their expiry as `t` (Unix time).
  // Never retain a URL beyond its own expiry; otherwise keep it briefly.
  const parsed = new URL(resolvedUrl)
  const signedExpiry = Number(parsed.searchParams.get('t'))
  const expiresAt = Number.isFinite(signedExpiry) && signedExpiry > 0 ? signedExpiry * 1000 - 30_000 : Date.now() + 5 * 60_000
  if (expiresAt > Date.now()) remoteUrlCache.set(remoteUrl, { url: resolvedUrl, expiresAt })
}

/**
 * Parse STRM_DIRECT_URL_MAP env var.
 * Format: /local/path=http://host:port/url[,/other=http://...]
 * Example: /CloudNAS=http://192.168.1.100:19798/dav
 *
 * @returns {{ localPrefix: string, urlPrefix: string }[]}
 */
function parseDirectUrlMap() {
  loadStrmSettings()
  const raw = process.env.STRM_DIRECT_URL_MAP
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf('=')
      if (sep < 1) return null
      return {
        localPrefix: filePathToPOSIX(entry.slice(0, sep).trim()),
        urlPrefix: entry.slice(sep + 1).trim().replace(/\/+$/, '')
      }
    })
    .filter(Boolean)
}
module.exports.parseDirectUrlMap = parseDirectUrlMap

/**
 * If the given local file path is under a configured cloud mount prefix,
 * return the corresponding direct HTTP URL. Otherwise return null.
 *
 * Set env var STRM_DIRECT_URL_MAP to enable, e.g.:
 *   STRM_DIRECT_URL_MAP=/CloudNAS=http://192.168.1.100:19798/dav
 *
 * @param {string} filePath
 * @returns {string|null}
 */
function getCloudDirectUrl(filePath) {
  if (!filePath) return null
  const posixPath = filePathToPOSIX(filePath)
  for (const { localPrefix, urlPrefix } of parseDirectUrlMap()) {
    if (posixPath === localPrefix || posixPath.startsWith(localPrefix + '/')) {
      const relative = posixPath.slice(localPrefix.length)
      return urlPrefix + relative
    }
  }
  return null
}
module.exports.getCloudDirectUrl = getCloudDirectUrl

/**
 * Check whether a local path falls under any configured cloud mount prefix.
 * Used to force direct-play for cloud files regardless of MIME type.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isCloudMountPath(filePath) {
  return getCloudDirectUrl(filePath) !== null
}
module.exports.isCloudMountPath = isCloudMountPath

function isStrmPath(path) {
  return Path.extname(path || '').toLowerCase() === '.strm'
}
module.exports.isStrmPath = isStrmPath

function isUrl(input) {
  return /^https?:\/\//i.test(input)
}
module.exports.isUrl = isUrl

function parseEnvList(value, fallback = []) {
  if (value === undefined) return fallback
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizePathPrefix(prefix) {
  return prefix.replace(/\\/g, '/').replace(/\/+$/, '')
}

function pathStartsWithPrefix(path, prefix) {
  const normalizedPath = normalizePathPrefix(path || '')
  const normalizedPrefix = normalizePathPrefix(prefix || '')
  return !!normalizedPrefix && (normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`))
}

function isProbeSkippedPath(path) {
  const prefixes = parseEnvList(process.env.STRM_SCAN_SKIP_PROBE_PATHS, DEFAULT_PROBE_SKIP_PREFIXES)
  return prefixes.some((prefix) => pathStartsWithPrefix(path, prefix))
}
module.exports.isProbeSkippedPath = isProbeSkippedPath

function parseContentLength(headers = {}) {
  const contentLength = headers['content-length']
  if (contentLength === undefined || contentLength === null) return null

  const parsed = Number(contentLength)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function parseRemoteFileSize(headers = {}) {
  const contentRange = headers['content-range']
  if (contentRange) {
    const match = String(contentRange).match(/\/(\d+)\s*$/)
    if (match) {
      const totalSize = Number(match[1])
      if (Number.isFinite(totalSize) && totalSize >= 0) return totalSize
    }
  }
  return parseContentLength(headers)
}

function getFirstStrmTargetLine(contents) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !STRM_COMMENT_PREFIXES.some((prefix) => line.startsWith(prefix)))
}

async function readStrmTarget(strmPath) {
  const contents = await fs.readFile(strmPath, 'utf8')
  const target = getFirstStrmTargetLine(contents)
  if (!target) {
    throw new Error('STRM file does not contain a media target')
  }

  if (isUrl(target) || Path.isAbsolute(target)) {
    return target
  }

  return filePathToPOSIX(Path.resolve(Path.dirname(strmPath), target))
}
module.exports.readStrmTarget = readStrmTarget

async function getStrmTargetSize(strmTarget) {
  if (isUrl(strmTarget)) {
    try {
      const response = await axios({
        method: 'head',
        url: strmTarget,
        maxRedirects: 5,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 Audiobookshelf STRM Scanner'
        },
        validateStatus: (status) => status >= 200 && status < 400
      })

      const contentLength = parseRemoteFileSize(response.headers)
      if (contentLength !== null) return contentLength
    } catch (error) {}

    try {
      const response = await axios({
        method: 'get',
        url: strmTarget,
        maxRedirects: 5,
        timeout: 10000,
        responseType: 'stream',
        headers: {
          Range: 'bytes=0-0',
          'User-Agent': 'Mozilla/5.0 Audiobookshelf STRM Scanner'
        },
        validateStatus: (status) => status >= 200 && status < 400
      })

      const contentLength = parseRemoteFileSize(response.headers)
      response.data.destroy()
      if (contentLength !== null) return contentLength
    } catch (error) {}

    return null
  }

  try {
    const stats = await fs.stat(strmTarget)
    if (!Number.isFinite(stats.size) || stats.size < 0) return null
    return stats.size
  } catch (error) {
    return null
  }
}
module.exports.getStrmTargetSize = getStrmTargetSize

/**
 * Proxy a remote URL to the client, forwarding Range requests for seek support.
 * Follows redirects server-side so the client only ever talks to ABS.
 *
 * @param {string} remoteUrl
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function proxyRemoteStream(remoteUrl, req, res) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 Audiobookshelf STRM Relay',
    // Do not let axios negotiate gzip for byte ranges. Audio players need the
    // original byte offsets and the upstream Content-Range header.
    'Accept-Encoding': 'identity'
  }
  const requestHeaderMap = { range: 'Range', 'if-range': 'If-Range', 'if-modified-since': 'If-Modified-Since' }
  for (const [sourceHeader, targetHeader] of Object.entries(requestHeaderMap)) {
    if (req.headers[sourceHeader]) {
      headers[targetHeader] = req.headers[sourceHeader]
    }
  }

  const cachedUrl = getCachedRemoteUrl(remoteUrl)
  const requestRemoteStream = (url) =>
    axios({
      method: 'get',
      url,
      responseType: 'stream',
      maxRedirects: 10,
      timeout: 15000,
      headers,
      validateStatus: (status) => status >= 200 && status < 400
    })

  let remoteRes
  try {
    remoteRes = await requestRemoteStream(cachedUrl || remoteUrl)
  } catch (error) {
    // A cached signed URL may have been invalidated early. Retry once through
    // the original STRM target so playback can recover without rescanning.
    if (cachedUrl && [401, 403, 404].includes(error.response?.status)) {
      remoteUrlCache.delete(remoteUrl)
      try {
        remoteRes = await requestRemoteStream(remoteUrl)
      } catch (retryError) {
        const status = retryError.response?.status || 502
        return res.sendStatus(status)
      }
    } else {
      const status = error.response?.status || 502
      return res.sendStatus(status)
    }
  }

  const resolvedUrl = remoteRes.request?.res?.responseUrl || remoteRes.request?._redirectable?._currentUrl
  if (resolvedUrl) {
    cacheRemoteUrl(remoteUrl, resolvedUrl)
  }

  let sourceHost = 'unknown'
  let resolvedHost = 'unknown'
  try {
    sourceHost = new URL(remoteUrl).host
    resolvedHost = new URL(resolvedUrl || remoteUrl).host
  } catch (error) {}
  const wasRedirected = !!resolvedUrl && resolvedUrl !== remoteUrl
  const shouldLogFullRedirectUrl = process.env.STRM_LOG_FULL_REDIRECT_URL === '1'
  const redirectTarget = shouldLogFullRedirectUrl && resolvedUrl ? resolvedUrl : `${resolvedHost}${wasRedirected ? ' (signed query redacted)' : ''}`
  Logger.info(`[STRM-PLAY] redirect=${wasRedirected ? 'yes' : 'no'} target=${redirectTarget}`)
  Logger.info(
    `[STRM-PLAY] mode=proxy source=${sourceHost} resolved=${resolvedHost} cache=${cachedUrl ? 'hit' : 'miss'} status=${remoteRes.status} range=${req.headers.range ? 'yes' : 'no'}`
  )

  const passthroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag', 'content-disposition']
  for (const header of passthroughHeaders) {
    const value = remoteRes.headers[header]
    if (value != null) res.setHeader(header, value)
  }

  // If no Accept-Ranges was returned, declare byte range support anyway so players can seek
  if (!remoteRes.headers['accept-ranges']) {
    res.setHeader('Accept-Ranges', 'bytes')
  }

  res.status(remoteRes.status)
  remoteRes.data.on('error', (error) => {
    if (!res.headersSent) return res.sendStatus(502)
    res.destroy(error)
  })
  remoteRes.data.pipe(res)

  req.on('close', () => {
    remoteRes.data.destroy()
  })
}
module.exports.proxyRemoteStream = proxyRemoteStream
