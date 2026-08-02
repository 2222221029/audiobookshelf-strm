<template>
  <div id="page-wrapper" class="w-full h-screen overflow-y-auto">
    <div class="login-ambient login-ambient-one" />
    <div class="login-ambient login-ambient-two" />
    <div class="absolute z-0 top-0 left-0 px-6 py-3">
      <div class="flex items-center">
        <img :src="uiLogoSrc" alt="Audiobookshelf Logo" class="w-10 min-w-10 h-10 app-logo" />
        <h1 class="text-xl ml-4 hidden lg:block hover:underline">audiobookshelf</h1>
      </div>
    </div>

    <div class="login-stage relative z-10 w-full flex h-full items-center justify-center">
      <aside v-if="isInit" class="login-intro">
        <span class="login-kicker">YOUR AUDIO · YOUR SPACE</span>
        <h2>让每一段好故事，<br />都触手可及。</h2>
        <p>统一管理本地与 STRM 云端音频，跨设备同步收听进度。</p>
        <div class="login-feature-list">
          <span><i class="material-symbols">cloud_done</i>云端直链秒播</span>
          <span><i class="material-symbols">sync</i>进度实时同步</span>
          <span><i class="material-symbols">shield_lock</i>数据完全私有</span>
        </div>
      </aside>
      <div v-if="criticalError" class="w-full max-w-md rounded-sm border border-error/25 bg-error/10 p-4">
        <p class="text-center text-lg font-semibold">{{ $strings.MessageServerCouldNotBeReached }}</p>
      </div>
      <div v-else-if="showInitScreen" class="w-full max-w-lg px-4 md:px-8 pb-8 pt-4">
        <p class="text-3xl text-white text-center mb-4">Initial Server Setup</p>
        <div class="w-full h-px bg-white/10 my-4" />

        <form @submit.prevent="submitServerSetup">
          <p class="text-lg font-semibold mb-2 pl-1 text-center">Create Root User</p>
          <ui-text-input-with-label v-model.trim="newRoot.username" label="Username" autocomplete="username" :disabled="processing" class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="newRoot.password" label="Password" type="password" autocomplete="new-password" :disabled="processing" class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="confirmPassword" label="Confirm Password" type="password" autocomplete="new-password" :disabled="processing" class="w-full mb-3 text-sm" />

          <p class="text-lg font-semibold mt-6 mb-2 pl-1 text-center">Directory Paths</p>
          <ui-text-input-with-label v-model="ConfigPath" label="Config Path" disabled class="w-full mb-3 text-sm" />
          <ui-text-input-with-label v-model="MetadataPath" label="Metadata Path" disabled class="w-full mb-3 text-sm" />

          <div class="w-full flex justify-end py-3">
            <ui-btn type="submit" :disabled="processing" color="bg-primary" class="leading-none">{{ processing ? 'Initializing...' : $strings.ButtonSubmit }}</ui-btn>
          </div>
        </form>
      </div>
      <div v-else-if="isInit" class="login-panel w-full max-w-md px-8 pb-8 pt-4">
        <div class="login-card bg-bg rounded-md shadow-lg border border-white/5 p-4">
          <p class="text-2xl font-semibold text-center text-white mb-4">{{ $strings.HeaderLogin }}</p>

          <div class="w-full h-px bg-white/10 my-4" />

          <p v-if="loginCustomMessage" class="py-2 default-style mb-2" v-html="loginCustomMessage"></p>

          <p v-if="error" class="text-error text-center py-2">{{ error }}</p>

          <div v-if="showNewAuthSystemMessage" class="mb-4">
            <widgets-alert type="warning">
              <div>
                <p>{{ $strings.MessageAuthenticationSecurityMessage }}</p>
                <a v-if="showNewAuthSystemAdminMessage" href="https://github.com/advplyr/audiobookshelf/discussions/4460" target="_blank" class="underline">{{ $strings.LabelMoreInfo }}</a>
              </div>
            </widgets-alert>
          </div>

          <form v-show="login_local" @submit.prevent="submitForm">
            <label class="text-xs text-gray-300 uppercase">{{ $strings.LabelUsername }}</label>
            <ui-text-input v-model.trim="username" autocomplete="username" :disabled="processing" class="mb-3 w-full" inputName="username" />

            <label class="text-xs text-gray-300 uppercase">{{ $strings.LabelPassword }}</label>
            <ui-text-input v-model.trim="password" type="password" autocomplete="current-password" :disabled="processing" class="w-full mb-3" inputName="password" />
            <div class="w-full flex justify-end py-3">
              <ui-btn type="submit" :disabled="processing" color="bg-primary" class="leading-none">{{ processing ? 'Checking...' : $strings.ButtonSubmit }}</ui-btn>
            </div>
          </form>

          <div v-if="login_local && login_openid" class="w-full h-px bg-white/10 my-4" />

          <div class="w-full flex py-3">
            <a v-if="login_openid" :href="openidAuthUri" class="w-full abs-btn outline-hidden rounded-md shadow-md relative border border-gray-600 text-center bg-primary text-white px-8 py-2 leading-none">
              {{ openIDButtonText }}
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'blank',
  data() {
    return {
      error: null,
      criticalError: null,
      processing: false,
      username: '',
      password: null,
      showInitScreen: false,
      isInit: false,
      newRoot: {
        username: 'root',
        password: ''
      },
      confirmPassword: '',
      ConfigPath: '',
      MetadataPath: '',
      login_local: true,
      login_openid: false,
      authFormData: null,
      uiLogo: 'classic',
      // New JWT auth system re-login flags
      showNewAuthSystemMessage: false,
      showNewAuthSystemAdminMessage: false
    }
  },
  watch: {
    user(newVal) {
      if (newVal) {
        if (!this.$store.state.libraries.currentLibraryId) {
          // No libraries available to this user
          if (this.$store.getters['user/getIsRoot']) {
            // If root user go to config/libraries
            this.$router.replace('/config/libraries')
          } else {
            this.$router.replace('/oops?message=No libraries available')
          }
        } else {
          if (this.$route.query.redirect) {
            const isAdminUser = this.$store.getters['user/getIsAdminOrUp']
            const redirect = this.$route.query.redirect
            // If not admin user then do not redirect to config pages other than your stats
            if (isAdminUser || !redirect.startsWith('/config/') || redirect === '/config/stats') {
              this.$router.replace(redirect)
              return
            }
          }

          this.$router.replace(`/library/${this.$store.state.libraries.currentLibraryId}`)
        }
      }
    }
  },
  computed: {
    user() {
      return this.$store.state.user.user
    },
    openidAuthUri() {
      return `${process.env.serverUrl}/auth/openid?callback=${location.href.split('?').shift()}`
    },
    openIDButtonText() {
      return this.authFormData?.authOpenIDButtonText || 'Login with OpenId'
    },
    loginCustomMessage() {
      return this.authFormData?.authLoginCustomMessage || null
    },
    uiLogoSrc() {
      return this.$uiLogo.getSrc(this.uiLogo)
    }
  },
  methods: {
    async submitServerSetup() {
      if (!this.newRoot.username || !this.newRoot.username.trim()) {
        this.$toast.error(this.$strings.ToastUserRootRequireName)
        return
      }
      if (this.newRoot.password !== this.confirmPassword) {
        this.$toast.error(this.$strings.ToastUserPasswordMismatch)
        return
      }
      if (!this.newRoot.password) {
        if (!confirm('Are you sure you want to create the root user with no password?')) {
          return
        }
      }
      this.processing = true

      const payload = {
        newRoot: { ...this.newRoot }
      }
      const success = await this.$axios
        .$post('/init', payload)
        .then(() => true)
        .catch((error) => {
          console.error('Failed', error.response)
          const errorMsg = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'
          this.$toast.error(errorMsg)
          return false
        })

      if (!success) {
        this.processing = false
        return
      }

      location.reload()
    },
    setUser({ user, userDefaultLibraryId, serverSettings, Source, ereaderDevices }) {
      this.$store.commit('setServerSettings', serverSettings)
      this.$store.commit('setSource', Source)
      this.$store.commit('libraries/setEReaderDevices', ereaderDevices)
      this.$setServerLanguageCode(serverSettings.language)

      if (serverSettings.chromecastEnabled) {
        console.log('Chromecast enabled import script')
        require('@/plugins/chromecast.js').default(this)
      }

      this.$store.commit('libraries/setLastLoad', 0) // Ensure libraries get loaded again when switching users
      this.$store.commit('libraries/setCurrentLibrary', { id: userDefaultLibraryId })
      this.$store.commit('user/setUser', user)
      // Access token only returned from login, not authorize
      if (user.accessToken) {
        this.$store.commit('user/setAccessToken', user.accessToken)
      }

      this.$store.dispatch('user/loadUserSettings')
    },
    async submitForm() {
      this.error = null
      this.showNewAuthSystemMessage = false
      this.showNewAuthSystemAdminMessage = false
      this.processing = true

      const payload = {
        username: this.username,
        password: this.password || ''
      }
      const authRes = await this.$axios.$post('/login', payload).catch((error) => {
        console.error('Failed', error.response)
        if (error.response) this.error = error.response.data
        else this.error = 'Unknown Error'
        return false
      })

      if (authRes?.error) {
        this.error = authRes.error
      } else if (authRes) {
        this.setUser(authRes)
      }
      this.processing = false
    },
    checkAuth() {
      const token = localStorage.getItem('token')
      if (!token) return false

      this.processing = true

      this.$store.commit('user/setAccessToken', token)

      return this.$axios
        .$post('/api/authorize', null, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        .then((res) => {
          // Force re-login if user is using an old token with no expiration
          if (res.user.isOldToken) {
            this.username = res.user.username
            this.showNewAuthSystemMessage = true
            // Admin user sees link to github discussion
            this.showNewAuthSystemAdminMessage = res.user.type === 'admin' || res.user.type === 'root'
            return false
          }

          this.setUser(res)
          return true
        })
        .catch((error) => {
          console.error('Authorize error', error)
          return false
        })
        .finally(() => {
          this.processing = false
        })
    },
    checkStatus() {
      this.processing = true
      this.$axios
        .$get('/status')
        .then((data) => {
          this.isInit = data.isInit
          this.showInitScreen = !data.isInit
          this.$setServerLanguageCode(data.language)
          if (this.showInitScreen) {
            this.ConfigPath = data.ConfigPath || ''
            this.MetadataPath = data.MetadataPath || ''
          } else {
            this.authFormData = data.authFormData
            this.updateLoginVisibility(data.authMethods || [])
          }
        })
        .catch((error) => {
          console.error('Status check failed', error)
          this.criticalError = 'Status check failed'
        })
        .finally(() => {
          this.processing = false
        })
    },
    updateLoginVisibility(authMethods) {
      if (this.$route.query?.error) {
        this.error = this.$route.query.error

        // Remove error query string
        const newurl = new URL(location.href)
        newurl.searchParams.delete('error')
        window.history.replaceState({ path: newurl.href }, '', newurl.href)
      }

      if (authMethods.includes('local') || !authMethods.length) {
        this.login_local = true
      } else {
        this.login_local = false
      }

      if (authMethods.includes('openid')) {
        // Auto redirect unless query string ?autoLaunch=0 OR when explicity requested through ?autoLaunch=1
        if ((this.authFormData?.authOpenIDAutoLaunch && this.$route.query?.autoLaunch !== '0') || this.$route.query?.autoLaunch == '1') {
          window.location.href = this.openidAuthUri
        }

        this.login_openid = true
      } else {
        this.login_openid = false
      }
    }
  },
  async mounted() {
    this.uiLogo = this.$uiLogo.get()
    // Token passed as query parameter after successful oidc login
    if (this.$route.query?.accessToken) {
      localStorage.setItem('token', this.$route.query.accessToken)
    }
    if (localStorage.getItem('token')) {
      if (await this.checkAuth()) return // if valid user no need to check status
    }

    this.checkStatus()
  }
}
</script>

<style scoped>
#page-wrapper { position: relative; overflow: hidden; background: radial-gradient(circle at 20% 14%, rgba(91,183,151,.18), transparent 36%), linear-gradient(140deg, #14241f, #07100e 70%); }
.login-ambient { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.login-ambient-one { top: -15%; left: -8%; width: 42vw; height: 42vw; background: rgba(85,204,176,.12); }
.login-ambient-two { right: -12%; bottom: -20%; width: 48vw; height: 48vw; background: rgba(87,165,185,.08); }
.login-stage { gap: clamp(45px, 10vw, 170px); padding: 80px 7vw 40px; }
.login-intro { width: min(560px, 46vw); }
.login-kicker { color: var(--ui-accent); font-size: .68rem; font-weight: 700; letter-spacing: .18em; }
.login-intro h2 { margin-top: 18px; font-size: clamp(2.3rem, 4.5vw, 4.6rem); font-weight: 760; line-height: 1.14; letter-spacing: -.045em; }
.login-intro > p { max-width: 430px; margin-top: 22px; color: var(--ui-muted); font-size: 1rem; line-height: 1.8; }
.login-feature-list { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 32px; }
.login-feature-list span { display: inline-flex; align-items: center; gap: 6px; color: #c3d4cf; font-size: .75rem; }
.login-feature-list i { color: var(--ui-accent); font-size: 1.1rem; font-style: normal; }
.login-panel { padding: 0; }
.login-card { padding: 30px !important; border-radius: 20px !important; background: rgba(13,28,23,.76) !important; border-color: var(--ui-border) !important; box-shadow: 0 30px 80px rgba(0,0,0,.36) !important; backdrop-filter: blur(24px); }
.login-card label { display: block; margin: 16px 0 6px; color: var(--ui-muted); text-transform: none; letter-spacing: 0; }
.login-card::v-deep input { min-height: 44px; }
.login-card::v-deep .abs-btn { width: 100%; min-height: 44px; margin-top: 5px; color: #07110e; background: var(--ui-accent) !important; }
@media (max-width: 860px) { .login-stage { padding: 80px 20px 30px; } .login-intro { display: none; } .login-panel { max-width: 430px; } }
</style>
