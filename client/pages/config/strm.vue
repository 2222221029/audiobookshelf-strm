<template>
  <div class="strm-settings-page">
    <header class="ui-page-header">
      <div>
        <h1 class="ui-page-title">STRM 管理</h1>
        <p class="ui-page-subtitle">管理云端音频扫描、直链映射、播放日志和重定向缓存。</p>
      </div>
      <button type="button" class="refresh-btn" :disabled="loading" @click="load">
        <span class="material-symbols" :class="{ spinning: loading }">refresh</span>
        刷新状态
      </button>
    </header>

    <div class="ui-stat-grid status-grid">
      <div class="ui-card ui-stat-card status-card">
        <span class="material-symbols ok">check_circle</span>
        <p class="ui-stat-label">STRM 服务</p>
        <p class="ui-stat-value status-value">运行正常</p>
      </div>
      <div class="ui-card ui-stat-card status-card">
        <span class="material-symbols">link</span>
        <p class="ui-stat-label">直链映射</p>
        <p class="ui-stat-value">{{ mappings.length }}</p>
      </div>
      <div class="ui-card ui-stat-card status-card">
        <span class="material-symbols">cached</span>
        <p class="ui-stat-label">重定向缓存</p>
        <p class="ui-stat-value">{{ cache.entries || 0 }}</p>
      </div>
      <div class="ui-card ui-stat-card status-card">
        <span class="material-symbols">storage</span>
        <p class="ui-stat-label">真实大小扫描</p>
        <p class="ui-stat-value status-value">{{ settings.scanTargetSize ? '已启用' : '未启用' }}</p>
      </div>
    </div>

    <div class="settings-grid">
      <section class="ui-card setting-panel">
        <div class="panel-heading">
          <div><h2>STRM 播放设置</h2><p>控制云端文件的探测与日志行为</p></div>
          <span class="ui-chip active">实时生效</span>
        </div>
        <div class="setting-row">
          <div><strong>扫描时探测媒体</strong><small>使用 ffprobe 获取编码、码率和时长，云盘路径建议关闭</small></div>
          <button type="button" class="ui-toggle" :class="{ on: settings.scanProbe }" role="switch" :aria-checked="settings.scanProbe" @click="settings.scanProbe = !settings.scanProbe"><span /></button>
        </div>
        <div class="setting-row">
          <div><strong>获取目标真实大小</strong><small>扫描 STRM 时通过本地挂载或 HTTP Range 获取音频真实容量</small></div>
          <button type="button" class="ui-toggle" :class="{ on: settings.scanTargetSize }" role="switch" :aria-checked="settings.scanTargetSize" @click="settings.scanTargetSize = !settings.scanTargetSize"><span /></button>
        </div>
        <div class="setting-row">
          <div><strong>记录完整重定向链接</strong><small>链接可能包含签名凭据，仅排查问题时临时开启</small></div>
          <button type="button" class="ui-toggle" :class="{ on: settings.logFullRedirectUrl }" role="switch" :aria-checked="settings.logFullRedirectUrl" @click="settings.logFullRedirectUrl = !settings.logFullRedirectUrl"><span /></button>
        </div>
        <label class="field-block">
          <span>跳过媒体探测的路径</span>
          <input v-model.trim="settings.scanSkipProbePaths" type="text" placeholder="/CloudNAS,/OtherMount" />
          <small>多个路径使用英文逗号分隔</small>
        </label>
      </section>

      <section class="ui-card setting-panel mapping-panel">
        <div class="panel-heading">
          <div><h2>直链映射</h2><p>将容器路径映射到支持 Range 的 HTTP/WebDAV 地址</p></div>
          <button type="button" class="add-mapping-btn" @click="addMapping"><span class="material-symbols">add</span>添加映射</button>
        </div>
        <div class="mapping-table">
          <div class="mapping-head"><span>容器路径</span><span>直链地址</span><span>状态</span><span /></div>
          <div v-for="(mapping, index) in mappings" :key="index" class="mapping-row">
            <input v-model.trim="mapping.localPrefix" type="text" placeholder="/CloudNAS" />
            <input v-model.trim="mapping.urlPrefix" type="url" placeholder="http://host:port/dav" />
            <span class="mapping-status" :class="{ valid: isMappingValid(mapping) }">{{ isMappingValid(mapping) ? '格式有效' : '待完善' }}</span>
            <button type="button" class="delete-mapping" aria-label="删除映射" @click="removeMapping(index)"><span class="material-symbols">delete</span></button>
          </div>
          <div v-if="!mappings.length" class="mapping-empty">暂无映射，云盘挂载文件将由服务器直接读取。</div>
        </div>
        <div class="mapping-notice">
          <span class="material-symbols">info</span>
          <p>保存后播放请求会优先通过映射地址访问；目标服务应支持 <code>Range</code> 请求，才能正常秒播和拖动进度。</p>
        </div>
      </section>

      <section class="ui-card setting-panel cache-panel">
        <div class="panel-heading"><div><h2>缓存策略</h2><p>115 等网盘的临时签名链接会自动缓存至自身过期前</p></div></div>
        <div class="cache-summary">
          <span class="material-symbols">speed</span>
          <div><strong>{{ cache.entries || 0 }} 个有效缓存</strong><small>失效链接播放失败时会自动回源重试</small></div>
        </div>
        <div v-if="cache.items && cache.items.length" class="cache-hosts">
          <span v-for="(item, index) in cache.items" :key="index" class="ui-chip">{{ item.host }}</span>
        </div>
        <button type="button" class="purge-btn" :disabled="purging || !cache.entries" @click="purgeCache">
          <span class="material-symbols">delete_sweep</span>
          {{ purging ? '正在清理…' : '清理重定向缓存' }}
        </button>
      </section>

      <section class="ui-card setting-panel log-panel">
        <div class="panel-heading">
          <div><h2>STRM 运行日志</h2><p>最近 {{ recentLogs.length }} 条播放、缓存和扫描记录</p></div>
          <nuxt-link to="/config/log">查看全部日志</nuxt-link>
        </div>
        <div class="strm-log-table">
          <div v-for="(entry, index) in recentLogs" :key="index" class="strm-log-row">
            <time>{{ formatLogTime(entry.timestamp) }}</time>
            <span class="log-level" :class="String(entry.levelName || '').toLowerCase()">{{ entry.levelName || 'INFO' }}</span>
            <p>{{ cleanLogMessage(entry.message) }}</p>
          </div>
          <div v-if="!recentLogs.length" class="mapping-empty">播放一个 STRM 音频后，这里会显示直链、代理、缓存和 Range 状态。</div>
        </div>
      </section>
    </div>

    <footer class="settings-actions">
      <div>
        <span class="material-symbols">save</span>
        <p>设置保存在 <code>{{ configFile || '/config/strm-settings.json' }}</code></p>
      </div>
      <button type="button" class="save-settings-btn" :disabled="saving || loading" @click="save">
        <span class="material-symbols">check</span>
        {{ saving ? '保存中…' : '保存更改' }}
      </button>
    </footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      saving: false,
      purging: false,
      settings: {
        scanProbe: false,
        scanTargetSize: false,
        scanSkipProbePaths: '/CloudNAS',
        directUrlMap: '',
        logFullRedirectUrl: false
      },
      mappings: [],
      cache: { entries: 0, items: [] },
      recentLogs: [],
      configFile: ''
    }
  },
  methods: {
    async load() {
      this.loading = true
      const response = await this.$axios.$get('/api/strm/settings').catch((error) => {
        console.error('Failed to load STRM settings', error)
        this.$toast.error('读取 STRM 设置失败')
        return null
      })
      if (response) {
        this.settings = { ...this.settings, ...response.settings }
        this.mappings = (response.mappings || []).map((mapping) => ({ ...mapping }))
        this.cache = response.cache || { entries: 0, items: [] }
        this.recentLogs = response.recentLogs || []
        this.configFile = response.configFile || ''
      }
      this.loading = false
    },
    addMapping() {
      this.mappings.push({ localPrefix: '', urlPrefix: '' })
    },
    removeMapping(index) {
      this.mappings.splice(index, 1)
    },
    isMappingValid(mapping) {
      return /^\/.+/.test(mapping.localPrefix || '') && /^https?:\/\//i.test(mapping.urlPrefix || '')
    },
    async save() {
      if (this.mappings.some((mapping) => !this.isMappingValid(mapping))) {
        this.$toast.error('请先完善或删除无效的直链映射')
        return
      }
      this.saving = true
      const payload = {
        ...this.settings,
        directUrlMap: this.mappings.map((mapping) => mapping.localPrefix + '=' + mapping.urlPrefix).join(',')
      }
      const response = await this.$axios.$patch('/api/strm/settings', payload).catch((error) => {
        console.error('Failed to save STRM settings', error)
        this.$toast.error(error.response?.data || '保存 STRM 设置失败')
        return null
      })
      if (response) {
        this.settings = { ...this.settings, ...response.settings }
        this.mappings = (response.mappings || []).map((mapping) => ({ ...mapping }))
        this.cache = response.cache || this.cache
        this.$toast.success('STRM 设置已保存并立即生效')
      }
      this.saving = false
    },
    async purgeCache() {
      this.purging = true
      const response = await this.$axios.$post('/api/strm/cache/purge').catch((error) => {
        console.error('Failed to purge STRM cache', error)
        this.$toast.error('缓存清理失败')
        return null
      })
      if (response) {
        this.cache = response.cache
        this.$toast.success('已清理 ' + response.purged + ' 个缓存链接')
      }
      this.purging = false
    },
    formatLogTime(timestamp) {
      if (!timestamp) return '—'
      return String(timestamp).split(' ').pop().slice(0, 8)
    },
    cleanLogMessage(message) {
      return String(message || '').replace(/^\[STRM(?:-PLAY)?\]\s*/, '')
    }
  },
  mounted() {
    this.load()
  }
}
</script>

<style scoped>
.strm-settings-page { padding: 4px 0 44px; }
.refresh-btn, .add-mapping-btn, .purge-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 7px 13px; color: var(--ui-text); border: 1px solid var(--ui-border); border-radius: 10px; background: rgba(255,255,255,.035); }
.refresh-btn:disabled, .purge-btn:disabled { opacity: .45; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status-grid { margin-bottom: 15px; }
.status-card { position: relative; padding-left: 58px; }
.status-card > .material-symbols { position: absolute; left: 18px; top: 20px; color: var(--ui-accent); font-size: 1.7rem; }
.status-card > .ok { color: #76e2b3; }
.status-value { font-size: 1.15rem; }
.settings-grid { display: grid; grid-template-columns: minmax(340px, .9fr) minmax(480px, 1.45fr); gap: 14px; }
.setting-panel { padding: 19px; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
.panel-heading h2 { font-size: 1rem; font-weight: 700; }
.panel-heading p { margin-top: 4px; color: var(--ui-muted); font-size: .72rem; }
.panel-heading a { color: var(--ui-accent); font-size: .76rem; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 15px; min-height: 66px; border-top: 1px solid var(--ui-border); }
.setting-row strong, .setting-row small, .field-block > span, .field-block small { display: block; }
.setting-row strong, .field-block > span { font-size: .82rem; font-weight: 600; }
.setting-row small, .field-block small { margin-top: 4px; color: var(--ui-muted); font-size: .66rem; line-height: 1.4; }
.ui-toggle { position: relative; width: 41px; min-width: 41px; height: 23px; padding: 2px; border-radius: 99px; background: rgba(255,255,255,.12); transition: background .2s ease; }
.ui-toggle span { display: block; width: 19px; height: 19px; border-radius: 50%; background: #d7e2de; transition: transform .2s ease; }
.ui-toggle.on { background: var(--ui-accent-strong); }
.ui-toggle.on span { transform: translateX(18px); background: #fff; }
.field-block { display: block; padding-top: 14px; border-top: 1px solid var(--ui-border); }
.field-block input { width: 100%; height: 40px; margin-top: 8px; padding: 0 11px; }
.mapping-panel { min-width: 0; }
.add-mapping-btn { min-height: 34px; padding: 5px 10px; color: var(--ui-accent); }
.add-mapping-btn .material-symbols { font-size: 1rem; }
.mapping-table { overflow-x: auto; }
.mapping-head, .mapping-row { display: grid; grid-template-columns: minmax(120px,.72fr) minmax(220px,1.55fr) 78px 34px; align-items: center; gap: 9px; }
.mapping-head { padding: 7px 8px; color: var(--ui-muted); font-size: .67rem; }
.mapping-row { min-width: 570px; padding: 8px; border-top: 1px solid var(--ui-border); }
.mapping-row input { width: 100%; height: 36px; padding: 0 9px; font-size: .74rem; }
.mapping-status { padding: 5px 7px; color: var(--ui-warning); border: 1px solid rgba(244,196,108,.2); border-radius: 999px; background: rgba(244,196,108,.07); font-size: .62rem; text-align: center; }
.mapping-status.valid { color: var(--ui-accent); border-color: rgba(var(--ui-accent-rgb),.25); background: rgba(var(--ui-accent-rgb),.08); }
.delete-mapping { color: var(--ui-muted); }
.delete-mapping:hover { color: var(--ui-danger); }
.delete-mapping .material-symbols { font-size: 1.1rem; }
.mapping-empty { padding: 22px 10px; color: var(--ui-muted); font-size: .74rem; text-align: center; }
.mapping-notice { display: flex; gap: 8px; margin-top: 11px; padding: 10px; color: var(--ui-muted); border-radius: 9px; background: rgba(var(--ui-accent-rgb),.055); font-size: .66rem; line-height: 1.5; }
.mapping-notice .material-symbols { color: var(--ui-accent); font-size: 1rem; }
.mapping-notice code, .settings-actions code { color: var(--ui-accent); }
.cache-panel { min-height: 200px; }
.cache-summary { display: flex; align-items: center; gap: 12px; min-height: 65px; padding: 12px; border: 1px solid var(--ui-border); border-radius: 12px; background: rgba(255,255,255,.025); }
.cache-summary > .material-symbols { color: var(--ui-accent); font-size: 1.8rem; }
.cache-summary strong, .cache-summary small { display: block; }
.cache-summary small { margin-top: 3px; color: var(--ui-muted); font-size: .66rem; }
.cache-hosts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.purge-btn { margin-top: 12px; color: var(--ui-muted); }
.log-panel { min-width: 0; }
.strm-log-table { max-height: 260px; overflow-y: auto; border: 1px solid var(--ui-border); border-radius: 11px; background: rgba(4,12,9,.34); }
.strm-log-row { display: grid; grid-template-columns: 66px 48px 1fr; gap: 9px; align-items: center; min-height: 33px; padding: 5px 9px; border-bottom: 1px solid rgba(255,255,255,.045); font-family: monospace; font-size: .65rem; }
.strm-log-row time { color: var(--ui-muted); }
.strm-log-row p { overflow: hidden; color: #c8d7d2; text-overflow: ellipsis; white-space: nowrap; }
.log-level { padding: 2px 4px; color: var(--ui-accent); border-radius: 4px; background: rgba(var(--ui-accent-rgb),.1); text-align: center; font-size: .58rem; }
.log-level.warn { color: var(--ui-warning); }
.log-level.error { color: var(--ui-danger); }
.settings-actions { position: sticky; z-index: 3; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-top: 15px; padding: 12px 14px; border: 1px solid var(--ui-border); border-radius: 14px; background: rgba(7,17,14,.92); backdrop-filter: blur(18px); }
.settings-actions > div { display: flex; align-items: center; gap: 8px; color: var(--ui-muted); font-size: .68rem; }
.settings-actions > div .material-symbols { color: var(--ui-accent); }
.save-settings-btn { display: inline-flex; align-items: center; gap: 5px; min-height: 40px; padding: 8px 17px; color: #07110e; border-radius: 10px; background: var(--ui-accent); font-weight: 700; }
.save-settings-btn:disabled { opacity: .55; }
@media (max-width: 1040px) { .settings-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .status-grid { grid-template-columns: 1fr 1fr; } .status-card { padding-left: 14px; } .status-card > .material-symbols { position: static; display: block; margin-bottom: 5px; } .settings-actions > div { display: none; } .save-settings-btn { width: 100%; justify-content: center; } }
</style>
