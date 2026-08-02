<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden modern-item-page" :class="streamLibraryItem ? 'streaming' : ''">
    <div id="item-page-wrapper" class="w-full h-full overflow-y-auto px-4 py-6 lg:px-10 lg:py-8">
      <main class="modern-item-shell max-w-7xl mx-auto">
        <section class="modern-hero">
          <div class="modern-cover-column">
            <div class="modern-cover-glow" />
            <div class="relative group modern-cover-card" style="height: fit-content">
            <covers-book-cover class="relative group-hover:brightness-75 transition cursor-pointer" expand-on-click :library-item="libraryItem" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />

            <!-- Item Progress Bar -->
            <div v-if="!isPodcast" class="absolute bottom-0 left-0 h-1.5 shadow-xs z-10 modern-cover-progress" :class="userIsFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: progressPercent * 100 + '%' }"></div>

            <!-- Item Cover Overlay -->
            <div class="absolute top-0 left-0 w-full h-full z-10 opacity-0 group-hover:opacity-100 pointer-events-none">
              <div v-show="showPlayButton && !isStreaming" class="h-full flex items-center justify-center pointer-events-none">
                <button class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto cursor-pointer" :aria-label="$strings.ButtonPlay" @click.stop.prevent="playItem">
                  <span class="material-symbols fill text-4xl">play_arrow</span>
                </button>
              </div>

              <button class="absolute bottom-2.5 right-2.5 z-10 material-symbols text-lg cursor-pointer text-white/75 hover:text-white/100 hover:scale-110 transform duration-200 pointer-events-auto" :aria-label="$strings.ButtonEdit" @click="showEditCover">edit</button>
            </div>
            </div>
          </div>

          <div class="modern-hero-content">
            <div class="modern-title-block">
              <h1 class="text-3xl md:text-4xl font-semibold tracking-tight">
                <div class="flex items-center">
                  {{ title }}
                  <widgets-explicit-indicator v-if="isExplicit" />
                  <widgets-abridged-indicator v-if="isAbridged" />
                </div>
              </h1>

              <p v-if="bookSubtitle" class="modern-subtitle">{{ bookSubtitle }}</p>

              <template v-for="(_series, index) in seriesList">
                <nuxt-link :key="_series.id" :to="`/library/${libraryId}/series/${_series.id}`" class="hover:underline font-sans text-gray-300 text-lg leading-7">{{ _series.text }}</nuxt-link
                ><span :key="index" v-if="index < seriesList.length - 1">, </span>
              </template>

              <p v-if="isPodcast" class="modern-author">{{ $getString('LabelByAuthor', [podcastAuthor]) }}</p>
              <p v-else-if="authors.length" class="modern-author max-w-[calc(100vw-2rem)] overflow-hidden text-ellipsis">
                {{ $getString('LabelByAuthor', ['']) }}<nuxt-link v-for="(author, index) in authors" :key="index" :to="`/author/${author.id}`" class="hover:underline">{{ author.name }}<span v-if="index < authors.length - 1">,&nbsp;</span></nuxt-link>
              </p>
              <p v-else class="modern-author">by Unknown</p>

              <div class="modern-meta-chips">
                <span v-if="mediaMetadata.narrators && mediaMetadata.narrators.length" class="modern-chip"><span class="material-symbols">person</span>{{ mediaMetadata.narrators[0] }}</span>
                <span v-if="mediaMetadata.publishedYear" class="modern-chip"><span class="material-symbols">calendar_month</span>{{ mediaMetadata.publishedYear }}</span>
                <span v-if="mediaMetadata.publisher" class="modern-chip"><span class="material-symbols">headphones</span>{{ mediaMetadata.publisher }}</span>
                <span v-if="mediaMetadata.language" class="modern-chip"><span class="material-symbols">language</span>{{ mediaMetadata.language }}</span>
              </div>

              <content-library-item-details :library-item="libraryItem" class="modern-details" />
            </div>

            <!-- Icon buttons -->
            <div class="modern-actions">
              <ui-btn v-if="showPlayButton" :disabled="isStreaming" color="bg-success" :padding-x="5" small class="modern-play-btn" @click="playItem">
                <span v-show="!isStreaming" class="material-symbols fill text-2xl pr-2 text-gray-900">play_arrow</span>
                {{ isStreaming ? $strings.ButtonPlaying : progressPercent > 0 ? $strings.ButtonPlay : $strings.ButtonPlay }}
              </ui-btn>

              <ui-btn v-else-if="isMissing || isInvalid" color="bg-error" :padding-x="4" small class="flex items-center h-12 mr-2">
                <span class="material-symbols text-2xl pr-1 text-white">error</span>
                {{ isMissing ? $strings.LabelMissing : $strings.LabelIncomplete }}
              </ui-btn>

              <ui-btn v-if="showReadButton" color="bg-info" :padding-x="4" small class="flex items-center h-12 mr-2" @click="openEbook">
                <span class="material-symbols text-2xl pr-2 text-white" aria-hidden="true">auto_stories</span>
                {{ $strings.ButtonRead }}
              </ui-btn>

              <ui-tooltip v-if="showQueueBtn" :text="isQueued ? $strings.ButtonQueueRemoveItem : $strings.ButtonQueueAddItem" direction="top">
                <ui-icon-btn :icon="isQueued ? 'playlist_add_check' : 'playlist_play'" :bg-color="isQueued ? 'bg-primary' : 'bg-success/60'" class="modern-icon-btn" :class="isQueued ? 'text-success' : ''" @click="queueBtnClick" />
              </ui-tooltip>

              <ui-tooltip v-if="userCanUpdate" :text="$strings.LabelEdit" direction="top">
                <ui-icon-btn icon="edit" outlined class="modern-icon-btn" :aria-label="$strings.LabelEdit" @click="editClick" />
              </ui-tooltip>

              <ui-tooltip v-if="!isPodcast" :text="userIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="top">
                <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" class="modern-icon-btn" @click="toggleFinished" />
              </ui-tooltip>

              <ui-tooltip v-if="isPodcast && userIsAdminOrUp" :text="$strings.LabelFindEpisodes" direction="top">
                <ui-icon-btn icon="search" class="modern-icon-btn" :aria-label="$strings.LabelFindEpisodes" :loading="fetchingRSSFeed" outlined @click="findEpisodesClick" />
              </ui-tooltip>

              <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="148" @action="contextMenuAction">
                <template #default="{ showMenu, clickShowMenu, disabled }">
                  <button type="button" :disabled="disabled" class="modern-more-btn" aria-haspopup="listbox" :aria-expanded="showMenu" :aria-label="$strings.LabelMore" @click.stop.prevent="clickShowMenu">
                    <span class="material-symbols text-2xl">more_horiz</span>
                  </button>
                </template>
              </ui-context-menu-dropdown>
            </div>
          </div>

          <!-- Progress -->
          <aside v-if="!isPodcast && progressPercent > 0" class="modern-progress-card" :class="resettingProgress ? 'opacity-25' : ''">
            <div class="flex items-center justify-between mb-5">
              <p class="font-semibold text-lg">{{ $strings.LabelYourProgress }}</p>
              <p class="modern-progress-percent">{{ Math.round(progressPercent * 100) }}%</p>
            </div>
            <div class="modern-progress-track"><div :style="{ width: progressPercent * 100 + '%' }" /></div>
            <p v-if="progressPercent < 1 && !useEBookProgress" class="mt-5 text-gray-200">{{ $getString('LabelTimeRemaining', [$elapsedPretty(userTimeRemaining)]) }}</p>
            <p v-if="progressPercent >= 1" class="mt-5 text-gray-200">{{ $strings.LabelFinished }} {{ $formatDate(userProgressFinishedAt, dateFormat) }}</p>
            <p class="text-gray-400 text-sm pt-2">{{ $strings.LabelStarted }} {{ $formatDate(userProgressStartedAt, dateFormat) }}</p>
            <button v-if="!resettingProgress" class="modern-progress-clear" @click.stop="clearProgressClick"><span class="material-symbols text-base">close</span></button>
          </aside>
        </section>

        <div class="modern-content-column">

          <!-- Podcast episode downloads queue -->
          <div v-if="episodeDownloadsQueued.length" class="px-4 py-2 mt-4 bg-info/40 text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0">
            <div class="flex items-center">
              <p class="text-sm py-1">{{ $getString('MessageEpisodesQueuedForDownload', [episodeDownloadsQueued.length]) }}</p>

              <span v-if="userIsAdminOrUp" class="material-symbols hover:text-error text-xl ml-3 cursor-pointer" @click="clearDownloadQueue">close</span>
            </div>
          </div>

          <!-- Podcast episodes currently downloading -->
          <div v-if="episodesDownloading.length" class="px-4 py-2 mt-4 bg-success/20 text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0">
            <div v-for="episode in episodesDownloading" :key="episode.id" class="flex items-center">
              <widgets-loading-spinner />
              <p class="text-sm py-1 pl-4">{{ $strings.MessageDownloadingEpisode }} "{{ episode.episodeDisplayTitle }}"</p>
            </div>
          </div>

          <section v-if="description" class="modern-description-card">
            <p class="modern-section-kicker">{{ $strings.LabelDescription || '简介' }}</p>
            <div ref="description" id="item-description" dir="auto" role="paragraph" class="default-style less-spacing text-base text-gray-100 whitespace-pre-line mb-1" :class="{ 'show-full': showFullDescription }" v-html="description" />

            <button v-if="isDescriptionClamped" class="py-0.5 flex items-center text-slate-300 hover:text-white" @click="showFullDescription = !showFullDescription">{{ showFullDescription ? $strings.ButtonReadLess : $strings.ButtonReadMore }} <span class="material-symbols text-xl pl-1" v-html="showFullDescription ? 'expand_less' : '&#xe313;'" /></button>
          </section>

          <tables-chapters-table v-if="chapters.length" :library-item="libraryItem" class="mt-6" />

          <tables-tracks-table v-if="tracks.length" :title="$strings.LabelStatsAudioTracks" :tracks="tracksWithAudioFile" :is-file="isFile" :library-item-id="libraryItemId" class="mt-6" />

          <tables-podcast-lazy-episodes-table ref="episodesTable" v-if="isPodcast" :library-item="libraryItem" />

          <tables-ebook-files-table v-if="ebookFiles.length" :library-item="libraryItem" class="mt-6" />

          <tables-library-files-table v-if="libraryFiles.length" :library-item="libraryItem" class="mt-6" />
        </div>
      </main>
    </div>

    <modals-podcast-episode-feed v-model="showPodcastEpisodeFeed" :library-item="libraryItem" :episodes="podcastFeedEpisodes" :download-queue="episodeDownloadsQueued" :episodes-downloading="episodesDownloading" />
    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :playback-rate="1" :library-item-id="libraryItemId" hide-create @select="selectBookmark" />
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }

    // Include episode downloads for podcasts
    var item = await app.$axios.$get(`/api/items/${params.id}?expanded=1&include=downloads,rssfeed,share`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!item) {
      console.error('No item...', params.id)
      return redirect('/')
    }
    if (store.state.libraries.currentLibraryId !== item.libraryId || !store.state.libraries.filterData) {
      await store.dispatch('libraries/fetch', item.libraryId)
    }
    return {
      libraryItem: item,
      rssFeed: item.rssFeed || null,
      mediaItemShare: item.mediaItemShare || null
    }
  },
  data() {
    return {
      resettingProgress: false,
      isProcessingReadUpdate: false,
      fetchingRSSFeed: false,
      showPodcastEpisodeFeed: false,
      podcastFeedEpisodes: [],
      episodesDownloading: [],
      episodeDownloadsQueued: [],
      showBookmarksModal: false,
      isDescriptionClamped: false,
      showFullDescription: false
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    downloadUrl() {
      return `${process.env.serverUrl}/api/items/${this.libraryItemId}/download?token=${this.userToken}`
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    bookCoverWidth() {
      return 320
    },
    isDeveloperMode() {
      return this.$store.state.developerMode
    },
    isFile() {
      return this.libraryItem.isFile
    },
    isBook() {
      return this.libraryItem.mediaType === 'book'
    },
    isPodcast() {
      return this.libraryItem.mediaType === 'podcast'
    },
    isMissing() {
      return this.libraryItem.isMissing
    },
    isInvalid() {
      return this.libraryItem.isInvalid
    },
    isExplicit() {
      return !!this.mediaMetadata.explicit
    },
    isAbridged() {
      return !!this.mediaMetadata.abridged
    },
    showPlayButton() {
      if (this.isMissing || this.isInvalid) return false
      if (this.isPodcast) return this.podcastEpisodes.length
      return this.tracks.length
    },
    showReadButton() {
      return this.ebookFile
    },
    libraryId() {
      return this.libraryItem.libraryId
    },
    libraryItemId() {
      return this.libraryItem.id
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    chapters() {
      return this.media.chapters || []
    },
    bookmarks() {
      if (this.isPodcast) return []
      return this.$store.getters['user/getUserBookmarksForItem'](this.libraryItemId)
    },
    tracks() {
      return this.media.tracks || []
    },
    tracksWithAudioFile() {
      return this.tracks.map((track) => {
        track.audioFile = this.media.audioFiles?.find((af) => af.metadata.path === track.metadata.path)
        return track
      })
    },
    podcastEpisodes() {
      return this.media.episodes || []
    },
    title() {
      return this.mediaMetadata.title || 'No Title'
    },
    bookSubtitle() {
      if (this.isPodcast) return null
      return this.mediaMetadata.subtitle
    },
    podcastAuthor() {
      return this.mediaMetadata.author || 'Unknown'
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    series() {
      return this.mediaMetadata.series || []
    },
    seriesList() {
      return this.series.map((se) => {
        let text = se.name
        if (se.sequence) text += ` #${se.sequence}`
        return {
          ...se,
          text
        }
      })
    },
    duration() {
      if (!this.tracks.length) return 0
      return this.media.duration
    },
    libraryFiles() {
      return this.libraryItem.libraryFiles || []
    },
    ebookFiles() {
      return this.libraryFiles.filter((lf) => lf.fileType === 'ebook')
    },
    ebookFile() {
      return this.media.ebookFile
    },
    description() {
      return this.mediaMetadata.description || ''
    },
    userMediaProgress() {
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    userIsFinished() {
      return this.userMediaProgress ? !!this.userMediaProgress.isFinished : false
    },
    userTimeRemaining() {
      if (!this.userMediaProgress) return 0
      const duration = this.userMediaProgress.duration || this.duration
      return duration - this.userMediaProgress.currentTime
    },
    useEBookProgress() {
      if (!this.userMediaProgress || this.userMediaProgress.progress) return false
      return this.userMediaProgress.ebookProgress > 0
    },
    progressPercent() {
      if (this.useEBookProgress) return Math.max(Math.min(1, this.userMediaProgress.ebookProgress), 0)
      return this.userMediaProgress ? Math.max(Math.min(1, this.userMediaProgress.progress), 0) : 0
    },
    userProgressStartedAt() {
      return this.userMediaProgress ? this.userMediaProgress.startedAt : 0
    },
    userProgressFinishedAt() {
      return this.userMediaProgress ? this.userMediaProgress.finishedAt : 0
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    isStreaming() {
      return this.streamLibraryItem && this.streamLibraryItem.id === this.libraryItemId
    },
    isQueued() {
      return this.$store.getters['getIsMediaQueued'](this.libraryItemId)
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    showRssFeedBtn() {
      if (!this.rssFeed && !this.podcastEpisodes.length && !this.tracks.length) return false // Cannot open RSS feed with no episodes/tracks

      // If rss feed is open then show feed url to users otherwise just show to admins
      return this.userIsAdminOrUp || this.rssFeed
    },
    showQueueBtn() {
      if (!this.isBook) return false
      return !this.$store.getters['getIsStreamingFromDifferentLibrary'] && this.streamLibraryItem
    },
    showCollectionsButton() {
      return this.isBook && this.userCanUpdate
    },
    contextMenuItems() {
      const items = []

      if (this.showCollectionsButton) {
        items.push({
          text: this.$strings.LabelCollections,
          action: 'collections'
        })
      }

      if (!this.isPodcast && this.tracks.length) {
        items.push({
          text: this.$strings.LabelYourPlaylists,
          action: 'playlists'
        })
      }

      if (this.bookmarks.length) {
        items.push({
          text: this.$strings.LabelYourBookmarks,
          action: 'bookmarks'
        })
      }

      if (this.showRssFeedBtn) {
        items.push({
          text: this.$strings.LabelOpenRSSFeed,
          action: 'rss-feeds'
        })
      }

      if (this.userCanDownload) {
        items.push({
          text: this.$strings.LabelDownload,
          action: 'download'
        })
      }

      if (this.ebookFile && this.$store.state.libraries.ereaderDevices?.length) {
        items.push({
          text: this.$strings.LabelSendEbookToDevice,
          subitems: this.$store.state.libraries.ereaderDevices.map((d) => {
            return {
              text: d.name,
              action: 'sendToDevice',
              data: d.name
            }
          })
        })
      }

      if (this.userIsAdminOrUp && !this.isPodcast && this.tracks.length) {
        items.push({
          text: this.$strings.LabelShare,
          action: 'share'
        })
      }

      if (this.userCanDelete) {
        items.push({
          text: this.$strings.ButtonDelete,
          action: 'delete'
        })
      }

      return items
    }
  },
  methods: {
    selectBookmark(bookmark) {
      if (!bookmark) return
      if (this.isStreaming) {
        this.$eventBus.$emit('playback-seek', bookmark.time)
      } else if (this.streamLibraryItem) {
        this.showBookmarksModal = false
        console.log('Already streaming library item so ask about it')
        const payload = {
          message: `Start playback for "${this.title}" at ${this.$secondsToTimestamp(bookmark.time)}?`,
          callback: (confirmed) => {
            if (confirmed) {
              this.playItem(bookmark.time)
            }
          },
          type: 'yesNo'
        }
        this.$store.commit('globals/setConfirmPrompt', payload)
      } else {
        this.playItem(bookmark.time)
      }
      this.showBookmarksModal = false
    },
    clearDownloadQueue() {
      if (confirm('Are you sure you want to clear episode download queue?')) {
        this.$axios
          .$get(`/api/podcasts/${this.libraryItemId}/clear-queue`)
          .then(() => {
            this.$toast.success(this.$strings.ToastEpisodeDownloadQueueClearSuccess)
            this.episodeDownloadQueued = []
          })
          .catch((error) => {
            console.error('Failed to clear queue', error)
            this.$toast.error(this.$strings.ToastEpisodeDownloadQueueClearFailed)
          })
      }
    },
    async findEpisodesClick() {
      if (!this.mediaMetadata.feedUrl) {
        return this.$toast.error(this.$strings.ToastNoRSSFeed)
      }
      this.fetchingRSSFeed = true
      var payload = await this.$axios.$post(`/api/podcasts/feed`, { rssFeed: this.mediaMetadata.feedUrl }).catch((error) => {
        console.error('Failed to get feed', error)
        this.$toast.error(this.$strings.ToastPodcastGetFeedFailed)
        return null
      })
      this.fetchingRSSFeed = false
      if (!payload) return

      console.log('Podcast feed', payload)
      const podcastfeed = payload.podcast
      if (!podcastfeed.episodes || !podcastfeed.episodes.length) {
        this.$toast.info(this.$strings.ToastPodcastNoEpisodesInFeed)
        return
      }

      this.podcastFeedEpisodes = podcastfeed.episodes
      this.showPodcastEpisodeFeed = true
    },
    showEditCover() {
      this.$store.commit('setBookshelfBookIds', [])
      this.$store.commit('showEditModalOnTab', { libraryItem: this.libraryItem, tab: 'cover' })
    },
    openEbook() {
      this.$store.commit('showEReader', { libraryItem: this.libraryItem, keepProgress: true })
    },
    toggleFinished(confirmed = false) {
      if (!this.userIsFinished && this.progressPercent > 0 && !confirmed) {
        const payload = {
          message: this.$getString('MessageConfirmMarkItemFinished', [this.title]),
          callback: (confirmed) => {
            if (confirmed) {
              this.toggleFinished(true)
            }
          },
          type: 'yesNo'
        }
        this.$store.commit('globals/setConfirmPrompt', payload)
        return
      }

      var updatePayload = {
        isFinished: !this.userIsFinished
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/me/progress/${this.libraryItemId}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    playItem(startTime = null) {
      let episodeId = null
      const queueItems = []
      if (this.isPodcast) {
        // Uses the sorting and filtering from the episode table component
        const episodesInListeningOrder = this.$refs.episodesTable?.episodesList || []

        // Find the first unplayed episode from the table
        let episodeIndex = episodesInListeningOrder.findIndex((ep) => {
          const podcastProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItemId, ep.id)
          return !podcastProgress || !podcastProgress.isFinished
        })
        // If all episodes are played, use the first episode
        if (episodeIndex < 0) episodeIndex = 0

        episodeId = episodesInListeningOrder[episodeIndex].id

        for (let i = episodeIndex; i < episodesInListeningOrder.length; i++) {
          const episode = episodesInListeningOrder[i]
          const podcastProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItemId, episode.id)
          if (!podcastProgress || !podcastProgress.isFinished) {
            queueItems.push({
              libraryItemId: this.libraryItemId,
              libraryId: this.libraryId,
              episodeId: episode.id,
              title: episode.title,
              subtitle: this.title,
              caption: episode.publishedAt ? this.$getString('LabelPublishedDate', [this.$formatDate(episode.publishedAt, this.dateFormat)]) : this.$strings.LabelUnknownPublishDate,
              duration: episode.audioFile.duration || null,
              coverPath: this.libraryItem.media.coverPath || null
            })
          }
        }
      } else {
        const queueItem = {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: null,
          title: this.title,
          subtitle: this.authors.map((au) => au.name).join(', '),
          caption: '',
          duration: this.duration || null,
          coverPath: this.media.coverPath || null
        }
        queueItems.push(queueItem)
      }

      this.$eventBus.$emit('play-item', {
        libraryItemId: this.libraryItem.id,
        episodeId,
        startTime,
        queueItems
      })
    },
    editClick() {
      this.$store.commit('setBookshelfBookIds', [])
      this.$store.commit('showEditModal', this.libraryItem)
    },
    checkDescriptionClamped() {
      if (!this.$refs.description) return
      this.isDescriptionClamped = this.$refs.description.scrollHeight > this.$refs.description.clientHeight
    },
    libraryItemUpdated(libraryItem) {
      if (libraryItem.id === this.libraryItemId) {
        console.log('Item was updated', libraryItem)
        this.libraryItem = libraryItem
        this.$nextTick(this.checkDescriptionClamped)
      }
    },
    clearProgressClick() {
      if (!this.userMediaProgress) return

      const payload = {
        message: this.$strings.MessageConfirmResetProgress,
        callback: (confirmed) => {
          if (confirmed) {
            this.clearProgress()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    clearProgress() {
      this.resettingProgress = true
      this.$axios
        .$delete(`/api/me/progress/${this.userMediaProgress.id}`)
        .then(() => {
          console.log('Progress reset complete')
        })
        .catch((error) => {
          console.error('Progress reset failed', error)
        })
        .finally(() => {
          this.resettingProgress = false
        })
    },
    clickRSSFeed() {
      this.$store.commit('globals/setRSSFeedOpenCloseModal', {
        id: this.libraryItemId,
        name: this.title,
        type: 'item',
        feed: this.rssFeed,
        hasEpisodesWithoutPubDate: this.podcastEpisodes.some((ep) => !ep.pubDate)
      })
    },
    episodeDownloadQueued(episodeDownload) {
      if (episodeDownload.libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued.push(episodeDownload)
      }
    },
    episodeDownloadStarted(episodeDownload) {
      if (episodeDownload.libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading.push(episodeDownload)
      }
    },
    episodeDownloadFinished(episodeDownload) {
      if (episodeDownload.libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading = this.episodesDownloading.filter((d) => d.id !== episodeDownload.id)
      }
    },
    episodeDownloadQueueCleared(libraryItemId) {
      if (libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued = []
      }
    },
    rssFeedOpen(data) {
      if (data.entityId === this.libraryItemId) {
        this.rssFeed = data
      }
    },
    rssFeedClosed(data) {
      if (data.entityId === this.libraryItemId) {
        this.rssFeed = null
      }
    },
    shareOpen(mediaItemShare) {
      if (mediaItemShare.mediaItemId === this.media.id) {
        this.mediaItemShare = mediaItemShare
      }
    },
    shareClosed(mediaItemShare) {
      if (mediaItemShare.mediaItemId === this.media.id) {
        this.mediaItemShare = null
      }
    },
    queueBtnClick() {
      if (this.isQueued) {
        // Remove from queue
        this.$store.commit('removeItemFromQueue', { libraryItemId: this.libraryItemId })
      } else {
        // Add to queue

        const queueItem = {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: null,
          title: this.title,
          subtitle: this.authors.map((au) => au.name).join(', '),
          caption: '',
          duration: this.duration || null,
          coverPath: this.media.coverPath || null
        }
        this.$store.commit('addItemToQueue', queueItem)
      }
    },
    downloadLibraryItem() {
      this.$downloadFile(this.downloadUrl)
    },
    deleteLibraryItem() {
      const payload = {
        message: this.$strings.MessageConfirmDeleteLibraryItem,
        checkboxLabel: this.$strings.LabelDeleteFromFileSystemCheckbox,
        yesButtonText: this.$strings.ButtonDelete,
        yesButtonColor: 'error',
        checkboxDefaultValue: !Number(localStorage.getItem('softDeleteDefault') || 0),
        callback: (confirmed, hardDelete) => {
          if (confirmed) {
            localStorage.setItem('softDeleteDefault', hardDelete ? 0 : 1)

            this.$axios
              .$delete(`/api/items/${this.libraryItemId}?hard=${hardDelete ? 1 : 0}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastItemDeletedSuccess)
                this.$router.replace(`/library/${this.libraryId}`)
              })
              .catch((error) => {
                console.error('Failed to delete item', error)
                this.$toast.error(this.$strings.ToastItemDeleteFailed)
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    sendToDevice(deviceName) {
      const payload = {
        message: this.$getString('MessageConfirmSendEbookToDevice', [this.ebookFile.ebookFormat, this.title, deviceName]),
        callback: (confirmed) => {
          if (confirmed) {
            const payload = {
              libraryItemId: this.libraryItemId,
              deviceName
            }
            this.processing = true
            this.$axios
              .$post(`/api/emails/send-ebook-to-device`, payload)
              .then(() => {
                this.$toast.success(this.$getString('ToastSendEbookToDeviceSuccess', [deviceName]))
              })
              .catch((error) => {
                console.error('Failed to send ebook to device', error)
                this.$toast.error(this.$strings.ToastSendEbookToDeviceFailed)
              })
              .finally(() => {
                this.processing = false
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    contextMenuAction({ action, data }) {
      if (action === 'collections') {
        this.$store.commit('setSelectedLibraryItem', this.libraryItem)
        this.$store.commit('globals/setShowCollectionsModal', true)
      } else if (action === 'playlists') {
        this.$store.commit('globals/setSelectedPlaylistItems', [{ libraryItem: this.libraryItem }])
        this.$store.commit('globals/setShowPlaylistsModal', true)
      } else if (action === 'bookmarks') {
        this.showBookmarksModal = true
      } else if (action === 'rss-feeds') {
        this.clickRSSFeed()
      } else if (action === 'download') {
        this.downloadLibraryItem()
      } else if (action === 'delete') {
        this.deleteLibraryItem()
      } else if (action === 'sendToDevice') {
        this.sendToDevice(data)
      } else if (action === 'share') {
        this.$store.commit('setSelectedLibraryItem', this.libraryItem)
        this.$store.commit('globals/setShareModal', this.mediaItemShare)
      }
    }
  },
  mounted() {
    this.checkDescriptionClamped()

    this.episodeDownloadsQueued = this.libraryItem.episodeDownloadsQueued || []
    this.episodesDownloading = this.libraryItem.episodesDownloading || []

    this.$eventBus.$on(`${this.libraryItem.id}_updated`, this.libraryItemUpdated)
    this.$root.socket.on('item_updated', this.libraryItemUpdated)
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
    this.$root.socket.on('share_open', this.shareOpen)
    this.$root.socket.on('share_closed', this.shareClosed)
    this.$root.socket.on('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.on('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.on('episode_download_finished', this.episodeDownloadFinished)
    this.$root.socket.on('episode_download_queue_cleared', this.episodeDownloadQueueCleared)
  },
  beforeDestroy() {
    this.$eventBus.$off(`${this.libraryItem.id}_updated`, this.libraryItemUpdated)
    this.$root.socket.off('item_updated', this.libraryItemUpdated)
    this.$root.socket.off('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.off('rss_feed_closed', this.rssFeedClosed)
    this.$root.socket.off('share_open', this.shareOpen)
    this.$root.socket.off('share_closed', this.shareClosed)
    this.$root.socket.off('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.off('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.off('episode_download_finished', this.episodeDownloadFinished)
    this.$root.socket.off('episode_download_queue_cleared', this.episodeDownloadQueueCleared)
  }
}
</script>

<style scoped>
.modern-item-page {
  color: #f4f7f6;
  background:
    radial-gradient(circle at 22% 14%, rgba(99, 211, 178, 0.13), transparent 28rem),
    radial-gradient(circle at 82% 28%, rgba(70, 147, 133, 0.08), transparent 34rem),
    linear-gradient(145deg, #0a1513 0%, #0d1917 46%, #091210 100%);
}

.modern-item-shell {
  position: relative;
  padding-bottom: 4rem;
}

.modern-hero {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 300px;
  gap: 3.5rem;
  align-items: center;
  min-height: 430px;
  padding: 1.5rem 0 2rem;
}

.modern-cover-column {
  position: relative;
  display: flex;
  justify-content: center;
}

.modern-cover-glow {
  position: absolute;
  inset: 12% -8% -5%;
  border-radius: 35%;
  background: rgba(110, 235, 198, 0.28);
  filter: blur(58px);
  opacity: 0.75;
  pointer-events: none;
}

.modern-cover-card {
  overflow: hidden;
  border: 1px solid rgba(162, 255, 226, 0.46);
  border-radius: 1rem;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42), 0 0 30px rgba(91, 221, 181, 0.12);
}

.modern-cover-card >>> img {
  border-radius: 1rem;
}

.modern-cover-progress {
  border-radius: 0 999px 999px 0;
}

.modern-title-block {
  max-width: 650px;
}

.modern-subtitle {
  margin-top: 0.35rem;
  color: rgba(226, 232, 231, 0.72);
  font-size: 1.15rem;
}

.modern-author {
  margin: 0.65rem 0 0;
  color: rgba(243, 247, 246, 0.88);
  font-size: 1.1rem;
}

.modern-meta-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.45rem;
}

.modern-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.15rem;
  padding: 0.35rem 0.75rem;
  color: rgba(236, 246, 243, 0.84);
  font-size: 0.9rem;
  border: 1px solid rgba(187, 230, 217, 0.17);
  border-radius: 999px;
  background: rgba(19, 34, 31, 0.7);
  backdrop-filter: blur(12px);
}

.modern-chip .material-symbols {
  color: #8be8cd;
  font-size: 1.05rem;
}

.modern-details {
  margin-top: 1.25rem;
}

.modern-details >>> > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.15rem 1.75rem;
}

.modern-details >>> .flex {
  min-width: 0;
}

.modern-details >>> .w-34,
.modern-details >>> .min-w-34 {
  width: 6rem;
  min-width: 6rem;
}

.modern-details >>> .uppercase {
  color: rgba(220, 231, 228, 0.52);
  text-transform: none;
}

.modern-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1.5rem;
}

.modern-play-btn {
  min-width: 12.25rem;
  height: 3.1rem !important;
  margin-right: 0.25rem;
  color: #071310 !important;
  font-weight: 700;
  border: 1px solid rgba(198, 255, 238, 0.5);
  border-radius: 0.8rem !important;
  background: linear-gradient(135deg, #83e8cb, #9cf1df) !important;
  box-shadow: 0 10px 30px rgba(75, 211, 172, 0.16);
}

.modern-icon-btn,
.modern-more-btn {
  width: 3.1rem !important;
  height: 3.1rem !important;
  margin: 0 !important;
  color: rgba(238, 246, 244, 0.9);
  border: 1px solid rgba(180, 220, 208, 0.18) !important;
  border-radius: 0.8rem !important;
  background: rgba(14, 28, 25, 0.78) !important;
}

.modern-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.modern-progress-card {
  position: relative;
  min-height: 190px;
  padding: 1.5rem;
  border: 1px solid rgba(186, 224, 213, 0.18);
  border-radius: 1rem;
  background: linear-gradient(145deg, rgba(27, 47, 43, 0.72), rgba(15, 27, 25, 0.7));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
}

.modern-progress-percent {
  color: #8ce7cd;
  font-size: 1.45rem;
  font-weight: 600;
}

.modern-progress-track {
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(225, 239, 235, 0.14);
}

.modern-progress-track > div {
  height: 100%;
  min-width: 0.55rem;
  border-radius: inherit;
  background: linear-gradient(90deg, #73ddbd, #a0f1de);
  box-shadow: 0 0 16px rgba(109, 226, 191, 0.45);
}

.modern-progress-clear {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  display: none;
  width: 1.8rem;
  height: 1.8rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
}

.modern-progress-card:hover .modern-progress-clear {
  display: flex;
}

.modern-content-column {
  max-width: 1220px;
  margin: 0 auto;
}

.modern-description-card {
  margin-top: 1.25rem;
  padding: 1.4rem 1.55rem 1.15rem;
  border: 1px solid rgba(179, 218, 207, 0.15);
  border-radius: 1rem;
  background: linear-gradient(145deg, rgba(23, 42, 38, 0.64), rgba(12, 25, 22, 0.7));
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.12);
}

.modern-section-kicker {
  margin-bottom: 0.8rem;
  color: #8ce7cd;
  font-size: 1.05rem;
  font-weight: 700;
}

.modern-content-column >>> .w-full.my-2 > .bg-primary {
  min-height: 3.6rem;
  border: 1px solid rgba(179, 218, 207, 0.15);
  border-radius: 0.9rem;
  background: linear-gradient(135deg, rgba(24, 43, 39, 0.86), rgba(15, 29, 26, 0.9)) !important;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
}

.modern-content-column >>> .tracksTable {
  overflow: hidden;
  border-radius: 0 0 0.9rem 0.9rem;
  background: rgba(10, 22, 19, 0.82);
}

@media (max-width: 1180px) {
  .modern-hero {
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 2.5rem;
  }

  .modern-progress-card {
    grid-column: 1 / -1;
    min-height: auto;
  }
}

@media (max-width: 760px) {
  .modern-hero {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    align-items: stretch;
    padding-top: 0;
  }

  .modern-cover-card {
    max-width: 320px;
  }

  .modern-title-block {
    text-align: left;
  }

  .modern-details >>> > div {
    grid-template-columns: 1fr;
  }

  .modern-actions {
    align-items: stretch;
  }

  .modern-play-btn {
    flex: 1 1 100%;
  }

  .modern-progress-card {
    width: 100%;
  }
}

#item-description {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  max-height: calc(6 * 1lh);
}

/* Safari-specific fix for the description clamping */
@supports (-webkit-touch-callout: none) {
  #item-description {
    position: relative;
    display: block;
    overflow: hidden;
    max-height: calc(6 * 1lh);
  }
}

#item-description.show-full {
  -webkit-line-clamp: unset;
  max-height: 999rem;
}
</style>
