<template>
  <section class="player-page">
    <div class="player-page-backdrop" :style="{ backgroundImage: 'url(' + coverSrc + ')' }" />

    <div class="player-page-grid">
      <aside class="cover-column">
        <img :src="coverSrc" alt="" class="page-cover" />
        <div class="source-pill" :class="{ strm: isStrm }">
          <span class="material-symbols">{{ isStrm ? 'cloud' : 'hard_drive' }}</span>
          {{ isStrm ? 'STRM 云端音频' : '本地音频' }}
        </div>
      </aside>

      <main class="play-column">
        <header class="media-heading">
          <h1>{{ title }}</h1>
          <p class="media-author"><span class="material-symbols">person</span>{{ author || '未知作者' }}</p>
          <span class="media-type">{{ mediaTypeLabel }}</span>
          <h2>{{ activeItemTitle }}</h2>
          <p class="chapter-caption">音轨 {{ activeItemNumber }} / {{ queueItems.length || 1 }} · {{ remainingLabel }}</p>
          <div class="metadata-row">
            <span v-if="narrator"><span class="material-symbols">headphones</span>{{ narrator }}</span>
            <span v-if="publishedYear"><span class="material-symbols">calendar_month</span>{{ publishedYear }}</span>
            <span v-if="publisher"><span class="material-symbols">radio</span>{{ publisher }}</span>
            <span v-if="language"><span class="material-symbols">language</span>{{ language }}</span>
          </div>
        </header>

        <div class="waveform" role="slider" :aria-valuenow="Math.round(progressPercent)" aria-valuemin="0" aria-valuemax="100" tabindex="0" @click="seekFromWaveform" @keydown.left.prevent="seekRelative(-15)" @keydown.right.prevent="seekRelative(30)">
          <span v-for="(height, index) in waveformBars" :key="index" :class="{ played: index / waveformBars.length <= progressPercent / 100 }" :style="{ height: height + '%' }" />
        </div>
        <div class="waveform-time"><time>{{ currentTimeLabel }}</time><time>{{ durationLabel }}</time></div>

        <div class="main-transport">
          <button type="button" aria-label="上一音轨" @click="previousItem"><span class="material-symbols">skip_previous</span></button>
          <button type="button" aria-label="后退15秒" @click="$emit('jump-backward')"><span class="jump-label">15</span><span class="material-symbols">replay</span></button>
          <button type="button" class="main-play" :aria-label="paused ? '播放' : '暂停'" @click="$emit('play-pause')"><span class="material-symbols fill">{{ loading ? 'autorenew' : paused ? 'play_arrow' : 'pause' }}</span></button>
          <button type="button" aria-label="前进30秒" @click="$emit('jump-forward')"><span class="jump-label">30</span><span class="material-symbols">forward_media</span></button>
          <button type="button" aria-label="下一音轨" @click="nextItem"><span class="material-symbols">skip_next</span></button>
        </div>

        <div class="control-row">
          <button type="button" @click="cycleRate"><strong>{{ playbackRate.toFixed(1) }}x</strong><small>播放速度</small></button>
          <button type="button" @click="$emit('sleep')"><span class="material-symbols">snooze</span><small>睡眠定时</small></button>
          <div class="volume-box"><controls-volume-control v-model="volume" @input="$emit('volume', volume)" /><small>音量</small></div>
          <button type="button" @click="$emit('chapters')"><span class="material-symbols">format_list_bulleted</span><small>章节列表</small></button>
          <label class="output-select">
            <span class="material-symbols">speaker</span>
            <select v-model="selectedOutput" @change="setOutputDevice">
              <option value="">默认输出设备</option>
              <option v-for="device in outputDevices" :key="device.deviceId" :value="device.deviceId">{{ device.label || '扬声器' }}</option>
            </select>
            <small>输出设备</small>
          </label>
        </div>

        <div class="info-grid">
          <article class="info-card">
            <h3>当前章节</h3>
            <strong>{{ activeItemTitle }}</strong>
            <p>{{ description }}</p>
            <button type="button" @click="$emit('details')">查看详情 <span class="material-symbols">chevron_right</span></button>
          </article>
          <article class="info-card stats-card">
            <h3>收听统计</h3>
            <div><span><small>今日收听</small><strong>{{ prettyTime(listeningStats.today) }}</strong></span><span><small>本季已收听</small><strong>{{ prettyTime(seasonListening) }}</strong></span><span><small>完成进度</small><strong class="accent">{{ Math.round(progress * 100) }}%</strong></span><span><small>总收听时长</small><strong>{{ prettyTime(listeningStats.totalTime) }}</strong></span></div>
          </article>
        </div>
      </main>

      <aside class="page-queue">
        <div class="queue-heading"><h2>播放队列</h2><span>{{ queueItems.length }}</span><button type="button" aria-label="队列选项"><span class="material-symbols">format_list_bulleted_add</span></button></div>
        <div class="queue-list">
          <button v-for="(item, index) in queueItems" :key="item.key" type="button" :class="{ active: item.current }" @click="$emit('select-item', item)">
            <span class="queue-number">{{ item.current ? '▮▮' : index + 1 }}</span>
            <span class="queue-title"><strong>{{ item.title }}</strong><small>{{ item.subtitle || '音轨' }}</small></span>
            <time>{{ formatDuration(item.duration) }}</time>
            <span class="material-symbols more">more_horiz</span>
          </button>
        </div>
        <footer>{{ queueItems.length }} 集（{{ queueDurationLabel }}）</footer>
      </aside>
    </div>
  </section>
</template>

<script>
export default {
  props: {
    libraryItem: { type: Object, required: true },
    title: { type: String, default: '' },
    author: { type: String, default: '' },
    coverSrc: { type: String, default: '' },
    currentTime: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    paused: Boolean,
    loading: Boolean,
    isStrm: Boolean,
    playbackRate: { type: Number, default: 1 },
    queueItems: { type: Array, default: () => [] },
    progress: { type: Number, default: 0 }
  },
  data() {
    return { volume: 1, selectedOutput: '', outputDevices: [], listeningStats: { today: 0, totalTime: 0, days: {} } }
  },
  computed: {
    metadata() { return this.libraryItem.media?.metadata || {} },
    narrator() { return this.metadata.narratorName || this.metadata.narrators?.join(', ') || '' },
    publishedYear() { return this.metadata.publishedYear || '' },
    publisher() { return this.metadata.publisher || '' },
    language() { return this.metadata.language || '' },
    mediaTypeLabel() { return this.metadata.genres?.[0] || this.metadata.seriesName || '有声书' },
    description() { return String(this.metadata.description || '暂无章节简介').replace(/<[^>]+>/g, '').slice(0, 125) },
    activeItemIndex() { return Math.max(0, this.queueItems.findIndex((item) => item.current)) },
    activeItem() { return this.queueItems[this.activeItemIndex] || {} },
    activeItemTitle() { return this.activeItem.title || this.title },
    activeItemNumber() { return this.activeItemIndex + 1 },
    progressPercent() { return this.duration ? Math.max(0, Math.min(100, this.currentTime / this.duration * 100)) : 0 },
    remainingLabel() { return '剩余 ' + this.prettyTime(Math.max(0, this.duration - this.currentTime)) },
    currentTimeLabel() { return this.$secondsToTimestamp(this.currentTime) },
    durationLabel() { return this.$secondsToTimestamp(this.duration) },
    waveformBars() { return Array.from({ length: 150 }, (_, index) => 24 + Math.abs(Math.sin(index * .77) * Math.cos(index * .19)) * 74) },
    queueDuration() { return this.queueItems.reduce((total, item) => total + (Number(item.duration) || 0), 0) },
    queueDurationLabel() { return this.prettyTime(this.queueDuration) },
    seasonListening() {
      const now = new Date()
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return Object.entries(this.listeningStats.days || {}).reduce((total, [day, seconds]) => total + (new Date(day) >= quarterStart ? Number(seconds) || 0 : 0), 0)
    }
  },
  mounted() { this.loadStats(); this.loadOutputDevices() },
  methods: {
    formatDuration(seconds) { return this.$secondsToTimestamp(Number(seconds) || 0).replace(/^00:/, '') },
    prettyTime(seconds) { return seconds ? this.$elapsedPrettyExtended(seconds, false) : '0 min' },
    seekFromWaveform(event) { this.$emit('seek', event.offsetX / event.currentTarget.clientWidth * this.duration) },
    seekRelative(amount) { this.$emit('seek', Math.max(0, Math.min(this.duration, this.currentTime + amount))) },
    previousItem() { if (this.activeItemIndex > 0) this.$emit('select-item', this.queueItems[this.activeItemIndex - 1]); else this.$emit('seek', 0) },
    nextItem() { if (this.activeItemIndex < this.queueItems.length - 1) this.$emit('select-item', this.queueItems[this.activeItemIndex + 1]) },
    cycleRate() {
      const rates = [.75, 1, 1.25, 1.5, 1.75, 2]
      const next = rates[(rates.findIndex((rate) => rate >= this.playbackRate) + 1) % rates.length]
      this.$emit('rate', next)
    },
    async loadStats() { this.listeningStats = await this.$axios.$get('/api/me/listening-stats').catch(() => ({ today: 0, totalTime: 0, days: {} })) },
    async loadOutputDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      this.outputDevices = devices.filter((device) => device.kind === 'audiooutput')
    },
    async setOutputDevice() {
      const audio = document.getElementById('audio-player')
      if (!audio?.setSinkId) return this.$toast.info('当前浏览器不支持选择音频输出设备')
      await audio.setSinkId(this.selectedOutput).then(() => this.$toast.success('音频输出设备已切换')).catch(() => this.$toast.error('无法切换音频输出设备'))
    }
  }
}
</script>

<style scoped>
.player-page { position: fixed; z-index: 44; top: 64px; right: 0; bottom: 112px; left: 80px; overflow: hidden; color: #eef7f3; background: #081410; }
.player-page-backdrop { position: absolute; inset: -25%; background-position: 25% 45%; background-size: 45%; background-repeat: no-repeat; filter: blur(90px) saturate(.75); opacity: .22; transform: scale(1.25); }
.player-page::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(7,18,15,.54), rgba(7,18,15,.82) 65%, rgba(5,14,11,.95)); pointer-events: none; }
.player-page-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(310px, 31%) minmax(440px, 1fr) minmax(310px, 29%); gap: clamp(24px, 3vw, 52px); height: 100%; padding: clamp(24px, 4vh, 46px) clamp(24px, 3vw, 48px) 18px; }
.cover-column { align-self: center; min-width: 0; }
.page-cover { width: min(100%, 430px); aspect-ratio: 1; object-fit: cover; border: 1px solid rgba(164,243,216,.3); border-radius: 18px; box-shadow: 0 0 45px rgba(129,235,198,.18), 0 28px 65px rgba(0,0,0,.42); }
.source-pill { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; padding: 7px 12px; color: #b8cbc4; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; font-size: .72rem; }
.source-pill.strm { color: #91e5c7; border-color: rgba(145,229,199,.32); }
.source-pill .material-symbols { font-size: 1rem; }
.play-column { display: flex; min-width: 0; flex-direction: column; justify-content: center; }
.media-heading h1 { font-size: clamp(1.55rem, 2.25vw, 2.5rem); font-weight: 720; letter-spacing: -.035em; }
.media-author { display: flex; align-items: center; gap: 7px; margin-top: 8px; color: #c3d2cd; font-size: .88rem; }
.media-author .material-symbols { font-size: 1rem; }
.media-type { display: inline-flex; margin-top: 15px; padding: 4px 9px; border: 1px solid rgba(255,255,255,.14); border-radius: 7px; color: #b6c7c1; font-size: .68rem; }
.media-heading h2 { margin-top: 13px; font-size: clamp(1.25rem, 1.8vw, 2rem); font-weight: 680; }
.chapter-caption { margin-top: 6px; color: #a7bab3; font-size: .76rem; }
.metadata-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 17px; }
.metadata-row > span { display: inline-flex; align-items: center; gap: 5px; padding: 6px 9px; border: 1px solid rgba(255,255,255,.13); border-radius: 999px; color: #c6d4cf; font-size: .67rem; }
.metadata-row .material-symbols { font-size: .9rem; }
.waveform { display: flex; align-items: center; gap: 1px; width: 100%; height: 48px; margin-top: 20px; cursor: pointer; }
.waveform span { width: 100%; min-width: 1px; max-width: 3px; border-radius: 2px; background: #60716b; opacity: .55; }
.waveform span.played { background: #91e5c7; opacity: 1; }
.waveform-time { display: flex; justify-content: space-between; margin-top: -3px; color: #b7c7c1; font-family: monospace; font-size: .68rem; }
.main-transport { display: flex; align-items: center; justify-content: center; gap: clamp(18px, 2.4vw, 36px); margin-top: 12px; }
.main-transport button { position: relative; display: grid; width: 36px; height: 36px; place-items: center; color: #e9f2ef; }
.main-transport .material-symbols { font-size: 1.65rem; }
.main-transport .main-play { width: 62px; height: 62px; color: #07130f; border-radius: 50%; background: #95e6ca; box-shadow: 0 0 0 8px rgba(149,230,202,.07), 0 10px 32px rgba(149,230,202,.18); }
.main-transport .main-play .material-symbols { font-size: 2rem; }
.jump-label { position: absolute; z-index: 1; top: 13px; font-size: .5rem; font-weight: 700; }
.control-row { display: grid; grid-template-columns: .72fr .82fr .62fr .98fr 1.6fr; gap: 8px; margin-top: 17px; }
.control-row > button, .volume-box, .output-select { position: relative; display: flex; min-width: 0; height: 48px; align-items: center; justify-content: center; gap: 6px; padding: 6px 9px; color: #d7e4df; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: rgba(255,255,255,.025); }
.control-row small { position: absolute; right: 0; bottom: -16px; left: 0; color: #82958e; font-size: .55rem; text-align: center; }
.control-row .material-symbols { font-size: 1.05rem; }
.output-select select { min-width: 0; width: 100%; overflow: hidden; color: #d7e4df; background: transparent; font-size: .67rem; text-overflow: ellipsis; }
.info-grid { display: grid; grid-template-columns: 1fr 1.25fr; gap: 12px; margin-top: 34px; }
.info-card { min-width: 0; min-height: 125px; padding: 14px 17px; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; background: rgba(255,255,255,.025); }
.info-card h3 { margin-bottom: 11px; color: #91e5c7; font-size: .68rem; font-weight: 650; }
.info-card > strong { display: block; overflow: hidden; font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
.info-card > p { display: -webkit-box; overflow: hidden; margin-top: 8px; color: #9cafA8; font-size: .62rem; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.info-card > button { display: flex; align-items: center; margin-top: 8px; color: #91e5c7; font-size: .62rem; }
.info-card > button .material-symbols { font-size: .9rem; }
.stats-card > div { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
.stats-card span, .stats-card small, .stats-card strong { display: block; }
.stats-card small { color: #84968f; font-size: .55rem; }
.stats-card strong { margin-top: 10px; font-size: .75rem; }
.stats-card .accent { color: #91e5c7; }
.page-queue { display: flex; min-width: 0; height: 100%; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: rgba(12,30,24,.7); backdrop-filter: blur(20px); }
.queue-heading { display: flex; height: 68px; align-items: center; gap: 9px; padding: 0 19px; border-bottom: 1px solid rgba(255,255,255,.09); }
.queue-heading h2 { font-size: .95rem; font-weight: 700; }
.queue-heading > span { margin-left: auto; padding: 3px 7px; border-radius: 999px; background: rgba(255,255,255,.08); color: #b7c8c2; font-size: .65rem; }
.queue-heading button { color: #c4d1cd; }
.queue-list { flex: 1; overflow-y: auto; padding: 6px 10px; }
.queue-list > button { display: grid; grid-template-columns: 28px 1fr auto 22px; gap: 7px; width: 100%; min-height: 52px; align-items: center; padding: 6px 8px; color: #9badA6; border-radius: 9px; text-align: left; }
.queue-list > button:hover { background: rgba(145,229,199,.06); }
.queue-list > button.active { color: #eef7f3; background: rgba(145,229,199,.16); }
.queue-number { color: #92dec4; font-family: monospace; font-size: .64rem; text-align: center; }
.queue-title { min-width: 0; }
.queue-title strong, .queue-title small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.queue-title strong { font-size: .68rem; }
.queue-title small { margin-top: 3px; color: #82968f; font-size: .53rem; }
.queue-list time { font-family: monospace; font-size: .58rem; }
.queue-list .more { font-size: .95rem; }
.page-queue footer { height: 35px; padding: 9px 19px; color: #8da098; font-size: .58rem; }
@media (max-width: 1180px) { .player-page-grid { grid-template-columns: minmax(250px,32%) 1fr; } .page-queue { display: none; } }
@media (max-width: 760px) { .player-page { left: 0; bottom: 192px; overflow-y: auto; } .player-page-grid { grid-template-columns: 1fr; height: auto; padding: 22px; } .cover-column { text-align: center; } .page-cover { width: min(60vw,260px); } .play-column { display: block; } .info-grid { grid-template-columns: 1fr; } }
</style>
