<template>
  <div class="page discovery-page" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="ui-page-shell">
      <header class="ui-page-header discovery-header">
        <div>
          <h1 class="ui-page-title">搜索与发现</h1>
          <p class="ui-page-subtitle">搜索书籍、作者、系列和演播者，发现值得聆听的内容。</p>
        </div>
        <form class="discovery-search" role="search" @submit.prevent="submitSearch">
          <span class="material-symbols">search</span>
          <input v-model.trim="searchInput" type="search" placeholder="输入书名、作者或演播者…" aria-label="搜索媒体库" />
          <button v-if="searchInput" type="button" aria-label="清空" @click="searchInput = ''">
            <span class="material-symbols">close</span>
          </button>
        </form>
      </header>

      <nav v-if="query" class="discovery-tabs" aria-label="搜索结果分类">
        <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
          <span>{{ tab.count }}</span>
        </button>
      </nav>

      <template v-if="query">
        <section v-if="featuredItem && (activeTab === 'all' || activeTab === 'books')" class="ui-card discovery-featured">
          <img :src="coverSrc(featuredItem)" alt="" />
          <div class="featured-copy">
            <span class="ui-chip active">最佳匹配</span>
            <h2>{{ featuredItem.media.metadata.title }}</h2>
            <p>{{ featuredItem.media.metadata.authorName || featuredItem.media.metadata.author || '未知作者' }}</p>
            <div class="featured-meta">
              <span v-if="featuredItem.media.metadata.narratorName">演播：{{ featuredItem.media.metadata.narratorName }}</span>
              <span v-if="featuredItem.media.duration">{{ $elapsedPrettyExtended(featuredItem.media.duration, false, false) }}</span>
              <span v-if="featuredItem.media.metadata.publishedYear">{{ featuredItem.media.metadata.publishedYear }}</span>
            </div>
            <div class="featured-actions">
              <button type="button" class="featured-play" @click="playFeatured">
                <span class="material-symbols fill">play_arrow</span>
                立即播放
              </button>
              <nuxt-link :to="`/item/${featuredItem.id}`">查看详情</nuxt-link>
            </div>
          </div>
        </section>

        <div class="result-heading">
          <div>
            <h2>搜索结果</h2>
            <p>“{{ query }}” 共找到 {{ totalResults }} 项</p>
          </div>
        </div>

        <app-book-shelf-categorized v-if="hasFilteredResults" ref="bookshelf" search :results="filteredResults" class="discovery-results" />
        <div v-else class="ui-card ui-empty-state">
          <span class="material-symbols empty-icon">search_off</span>
          <p>当前分类中没有匹配结果</p>
          <button type="button" @click="activeTab = 'all'">查看全部结果</button>
        </div>
      </template>

      <template v-else>
        <section v-if="recentSearches.length" class="discovery-section">
          <div class="section-heading">
            <h2>最近搜索</h2>
            <button type="button" @click="clearRecentSearches">清除</button>
          </div>
          <div class="recent-searches">
            <button v-for="term in recentSearches" :key="term" type="button" class="ui-chip" @click="runRecentSearch(term)">
              <span class="material-symbols">history</span>
              {{ term }}
            </button>
          </div>
        </section>

        <section class="discovery-section">
          <div class="section-heading"><h2>热门分类</h2></div>
          <div class="category-grid">
            <button v-for="category in categories" :key="category.name" type="button" class="ui-card category-card" @click="openCategory(category.name)">
              <span class="material-symbols">{{ category.icon }}</span>
              <strong>{{ category.name }}</strong>
              <small>浏览相关内容</small>
            </button>
          </div>
        </section>

        <section v-if="recommendations.length" class="discovery-section">
          <div class="section-heading">
            <div>
              <h2>为你推荐</h2>
              <p>来自你当前媒体库的精选内容</p>
            </div>
            <nuxt-link :to="`/library/${libraryId}/bookshelf`">查看媒体库</nuxt-link>
          </div>
          <div class="recommendation-grid">
            <nuxt-link v-for="item in recommendations" :key="item.id" :to="`/item/${item.id}`" class="recommendation-card">
              <img :src="coverSrc(item)" alt="" />
              <strong>{{ recommendationTitle(item) }}</strong>
              <span>{{ recommendationAuthor(item) }}</span>
            </nuxt-link>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script>
const RECENT_SEARCHES_KEY = 'abs-recent-searches'

function emptyResults() {
  return { podcasts: [], episodes: [], books: [], authors: [], series: [], tags: [], genres: [], narrators: [] }
}

function normalizeResults(results) {
  return {
    podcasts: results?.podcast || [],
    episodes: results?.episodes || [],
    books: results?.book || [],
    authors: results?.authors || [],
    series: results?.series || [],
    tags: results?.tags || [],
    genres: results?.genres || [],
    narrators: results?.narrators || []
  }
}

export default {
  async asyncData({ store, params, redirect, query, app }) {
    const libraryId = params.library
    const library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) return redirect('/oops?message=Library not found')

    const searchQuery = String(query.q || '').trim()
    let results = emptyResults()
    let recommendations = []

    if (searchQuery) {
      const response = await app.$axios.$get(`/api/libraries/${libraryId}/search?q=${encodeURIComponent(searchQuery)}`).catch((error) => {
        console.error('Failed to search library', error)
        return null
      })
      results = normalizeResults(response)
    } else {
      const shelves = await app.$axios.$get(`/api/libraries/${libraryId}/personalized?include=numEpisodesIncomplete`).catch(() => [])
      const seen = new Set()
      for (const shelf of shelves || []) {
        for (const item of shelf.entities || []) {
          if (!item?.id || !item.media || seen.has(item.id)) continue
          seen.add(item.id)
          recommendations.push(item)
          if (recommendations.length >= 10) break
        }
        if (recommendations.length >= 10) break
      }
    }

    return { libraryId, results, query: searchQuery, searchInput: searchQuery, recommendations }
  },
  data() {
    return {
      activeTab: 'all',
      recentSearches: [],
      categories: [
        { name: '武侠仙侠', icon: 'swords' },
        { name: '悬疑', icon: 'search' },
        { name: '历史', icon: 'history_edu' },
        { name: '科幻', icon: 'rocket_launch' },
        { name: '都市', icon: 'location_city' },
        { name: '文学', icon: 'auto_stories' }
      ]
    }
  },
  watch: {
    '$route.query.q'(value) {
      const nextQuery = String(value || '').trim()
      if (nextQuery === this.query) return
      this.query = nextQuery
      this.searchInput = nextQuery
      this.search()
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    featuredItem() {
      return this.results.books?.[0]?.libraryItem || null
    },
    tabs() {
      return [
        { id: 'all', label: '全部', count: this.totalResults },
        { id: 'books', label: '书籍', count: this.results.books.length },
        { id: 'authors', label: '作者', count: this.results.authors.length },
        { id: 'series', label: '系列', count: this.results.series.length },
        { id: 'narrators', label: '演播者', count: this.results.narrators.length }
      ]
    },
    totalResults() {
      return Object.values(this.results).reduce((total, values) => total + (values?.length || 0), 0)
    },
    filteredResults() {
      if (this.activeTab === 'all') return this.results
      const filtered = emptyResults()
      filtered[this.activeTab] = this.results[this.activeTab] || []
      return filtered
    },
    hasFilteredResults() {
      return Object.values(this.filteredResults).some((values) => values?.length)
    }
  },
  methods: {
    coverSrc(item) {
      return this.$store.getters['globals/getLibraryItemCoverSrc'](item)
    },
    recommendationTitle(item) {
      return item && item.media && item.media.metadata ? item.media.metadata.title || '未命名' : '未命名'
    },
    recommendationAuthor(item) {
      const metadata = item && item.media ? item.media.metadata || {} : {}
      return metadata.authorName || metadata.author || ''
    },
    submitSearch() {
      if (!this.searchInput) return
      this.saveRecentSearch(this.searchInput)
      this.$router.push(`/library/${this.libraryId}/search?q=${encodeURIComponent(this.searchInput)}`)
    },
    async search() {
      this.activeTab = 'all'
      if (!this.query) {
        this.results = emptyResults()
        return
      }
      this.saveRecentSearch(this.query)
      const response = await this.$axios.$get(`/api/libraries/${this.libraryId}/search?q=${encodeURIComponent(this.query)}`).catch((error) => {
        console.error('Failed to search library', error)
        return null
      })
      this.results = normalizeResults(response)
      this.$nextTick(() => this.$refs.bookshelf?.setShelvesFromSearch())
    },
    playFeatured() {
      const item = this.featuredItem
      if (!item) return
      this.$eventBus.$emit('play-item', {
        libraryItemId: item.id,
        episodeId: null,
        queueItems: [{
          libraryItemId: item.id,
          libraryId: item.libraryId,
          episodeId: null,
          title: item.media.metadata.title,
          subtitle: item.media.metadata.authorName || '',
          caption: '',
          duration: item.media.duration || null,
          coverPath: item.media.coverPath || null
        }]
      })
    },
    loadRecentSearches() {
      try {
        this.recentSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
      } catch {
        this.recentSearches = []
      }
    },
    saveRecentSearch(term) {
      const normalized = String(term || '').trim()
      if (!normalized) return
      this.recentSearches = [normalized, ...this.recentSearches.filter((item) => item !== normalized)].slice(0, 8)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(this.recentSearches))
    },
    clearRecentSearches() {
      this.recentSearches = []
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    },
    runRecentSearch(term) {
      this.searchInput = term
      this.submitSearch()
    },
    openCategory(name) {
      this.$router.push(`/library/${this.libraryId}/bookshelf?filter=genres.${this.$encode(name)}`)
    }
  },
  mounted() {
    this.loadRecentSearches()
    if (this.query) this.saveRecentSearch(this.query)
  }
}
</script>

<style scoped>
.discovery-header { align-items: center; }
.discovery-search { display: flex; align-items: center; width: min(500px, 46vw); min-height: 46px; padding: 0 13px; border: 1px solid var(--ui-border); border-radius: 13px; background: rgba(5, 14, 11, 0.62); }
.discovery-search > .material-symbols { color: var(--ui-muted); }
.discovery-search input { flex: 1; height: 44px; padding: 0 10px; border: 0 !important; background: transparent !important; box-shadow: none !important; }
.discovery-search button { display: flex; color: var(--ui-muted); }
.discovery-tabs { display: flex; gap: 6px; width: fit-content; margin-bottom: 20px; padding: 5px; border: 1px solid var(--ui-border); border-radius: 13px; background: rgba(5, 14, 11, 0.45); }
.discovery-tabs button { display: inline-flex; align-items: center; gap: 7px; min-width: 92px; min-height: 36px; justify-content: center; padding: 7px 14px; border-radius: 9px; color: var(--ui-muted); }
.discovery-tabs button.active { color: #07110e; background: var(--ui-accent); font-weight: 650; }
.discovery-tabs button span { opacity: .7; font-size: .72rem; }
.discovery-featured { position: relative; display: flex; min-height: 232px; padding: 18px; overflow: hidden; }
.discovery-featured::after { content: ''; position: absolute; inset: 0; z-index: 0; background: linear-gradient(90deg, rgba(11, 25, 21, .96), rgba(11, 25, 21, .58)); }
.discovery-featured img { position: relative; z-index: 1; width: 150px; min-width: 150px; height: 196px; object-fit: cover; border-radius: 13px; box-shadow: var(--ui-shadow); }
.featured-copy { position: relative; z-index: 1; align-self: center; padding: 10px 27px; }
.featured-copy h2 { margin-top: 10px; font-size: 1.75rem; font-weight: 740; }
.featured-copy > p { margin-top: 4px; color: var(--ui-muted); }
.featured-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 13px; color: var(--ui-muted); font-size: .82rem; }
.featured-actions { display: flex; gap: 10px; margin-top: 19px; }
.featured-actions > * { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 39px; padding: 7px 15px; border: 1px solid var(--ui-border); border-radius: 10px; }
.featured-play { color: #07110e; border-color: transparent !important; background: var(--ui-accent); font-weight: 650; }
.result-heading, .section-heading { display: flex; align-items: flex-end; justify-content: space-between; margin: 27px 0 14px; }
.result-heading h2, .section-heading h2 { font-size: 1.15rem; font-weight: 700; }
.result-heading p, .section-heading p { margin-top: 3px; color: var(--ui-muted); font-size: .78rem; }
.section-heading button, .section-heading a { color: var(--ui-accent); font-size: .82rem; }
.discovery-results { height: auto !important; min-height: 340px; overflow: visible !important; background: transparent !important; }
.discovery-results::v-deep #bookshelf { height: auto !important; overflow: visible !important; background: transparent !important; }
.empty-icon { margin-bottom: 10px; color: var(--ui-muted); font-size: 2.5rem; }
.ui-empty-state button { margin-top: 12px; color: var(--ui-accent); }
.recent-searches { display: flex; flex-wrap: wrap; gap: 8px; }
.recent-searches .ui-chip { gap: 5px; cursor: pointer; }
.recent-searches .material-symbols { font-size: 1rem; }
.category-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 11px; }
.category-card { display: flex; min-height: 116px; flex-direction: column; align-items: flex-start; padding: 16px; text-align: left; }
.category-card:hover { border-color: var(--ui-border-active); transform: translateY(-2px); }
.category-card .material-symbols { margin-bottom: 13px; color: var(--ui-accent); font-size: 1.5rem; }
.category-card small { margin-top: 4px; color: var(--ui-muted); font-size: .68rem; }
.recommendation-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 14px; }
.recommendation-card { min-width: 0; }
.recommendation-card img { width: 100%; aspect-ratio: .72; object-fit: cover; border: 1px solid var(--ui-border); border-radius: 13px; box-shadow: var(--ui-shadow-soft); transition: transform .2s ease; }
.recommendation-card:hover img { transform: translateY(-3px); }
.recommendation-card strong, .recommendation-card span { display: block; margin-top: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8rem; }
.recommendation-card span { margin-top: 2px; color: var(--ui-muted); font-size: .7rem; }
@media (max-width: 1100px) { .category-grid { grid-template-columns: repeat(3, 1fr); } .recommendation-grid { grid-template-columns: repeat(5, 1fr); } }
@media (max-width: 700px) { .discovery-header { align-items: stretch; } .discovery-search { width: 100%; } .discovery-tabs { width: 100%; overflow-x: auto; } .discovery-tabs button { min-width: 80px; } .discovery-featured img { width: 108px; min-width: 108px; height: 150px; } .featured-copy { padding: 4px 0 4px 15px; } .featured-copy h2 { font-size: 1.2rem; } .featured-meta { display: none; } .category-grid { grid-template-columns: repeat(2, 1fr); } .recommendation-grid { grid-template-columns: repeat(3, 1fr); } }
</style>
