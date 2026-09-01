/* CrowRules Unified Core v2.0
   Shared Supabase integration for CrowRules branches.
   TV playback is playlist-first: tv_channel_playlist is the broadcast source.
   Browser-safe public/publishable Supabase key only.
   Fixes:
   - Stable singleton Supabase client
   - Stable realtime channels (no duplicate subscriptions)
   - Playlist refresh no longer restarts the current video unnecessarily
   - Live Events realtime subscription is created only after the Live channel ID is known
   - Live Events countdown survives schedule refreshes without resetting the whole feature
   - Safer YouTube URL parsing and iframe lifecycle
   - Better error handling and branch registry fallback
   - Channel selection is exposed through CrowRulesPlaylistTV
*/
(function () {
  'use strict';

  const SUPABASE_URL = 'https://zauxdqyssratvzmomozf.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_-m6NuVfbrcs84OH7aGPrDw_AuLfXo8J';

  const ADMIN_PRO_URL =
    'https://crowrulesentertainment-oss.github.io/crowrulestv/admin';
  const TV_URL =
    'https://crowrulesentertainment-oss.github.io/crowrulestv/tv';

  const BRANCHES = [
    {
      slug: 'entertainment',
      name: 'CrowRules Entertainment',
      url: 'https://crowrulesentertainment-oss.github.io/crowrulesentertainment/',
      icon: '🏠'
    },
    { slug: 'tv', name: 'CrowRules TV', url: TV_URL, icon: '📺' },
    {
      slug: 'tacoma-nights',
      name: 'Tacoma Nights',
      url: 'https://crowrulesentertainment-oss.github.io/crowrulestv/tacoma-nights',
      icon: '🌃'
    },
    {
      slug: 'backdeckcrew',
      name: 'Back Deck Crew',
      url: 'https://crowrulesentertainment-oss.github.io/crowrulestv/backdeckcrew',
      icon: '🎥'
    },
    {
      slug: 'pnwm',
      name: 'Pacific Northwest Mothers',
      url: 'https://crowrulesentertainment-oss.github.io/crowrulestv/pnwm',
      icon: '👩‍👧‍👦'
    }
  ];

  const isTVPage = () =>
    location.pathname.endsWith('/tv') || location.pathname.endsWith('/tv/');

  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));

  const pick = (obj, keys, fallback = '') => {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return obj[key];
      }
    }
    return fallback;
  };

  const score = (obj) =>
    Number(
      pick(obj, [
        'view_count',
        'views',
        'views_count',
        'total_views',
        'watch_count',
        'plays',
        'play_count'
      ], 0)
    ) || 0;

  /* ---------------------------------------------------------
     Supabase loader / singleton
     --------------------------------------------------------- */

  let supabaseLoadPromise = null;

  function loadSupabase() {
    if (window.supabase?.createClient) {
      return Promise.resolve(window.supabase);
    }

    if (supabaseLoadPromise) return supabaseLoadPromise;

    supabaseLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-crowrules-supabase-loader]'
      );

      if (existing) {
        existing.addEventListener(
          'load',
          () => window.supabase?.createClient
            ? resolve(window.supabase)
            : reject(new Error('Supabase library loaded without createClient')),
          { once: true }
        );
        existing.addEventListener(
          'error',
          () => reject(new Error('Supabase library failed to load')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.dataset.crowrulesSupabaseLoader = '1';

      script.onload = () => {
        if (window.supabase?.createClient) resolve(window.supabase);
        else reject(new Error('Supabase library loaded without createClient'));
      };

      script.onerror = () =>
        reject(new Error('Unable to load Supabase JavaScript client'));

      document.head.appendChild(script);
    });

    return supabaseLoadPromise;
  }

  let clientPromise = null;

  async function client() {
    if (window.__crowrulesSupabase) return window.__crowrulesSupabase;

    if (!clientPromise) {
      clientPromise = loadSupabase().then((supabase) => {
        if (!window.__crowrulesSupabase) {
          window.__crowrulesSupabase = supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storageKey: 'crowrules-unified-session',
                flowType: 'pkce'
              },
              global: {
                headers: {
                  'X-CrowRules-Core': '2.0'
                }
              }
            }
          );
        }
        return window.__crowrulesSupabase;
      });
    }

    return clientPromise;
  }

  async function session() {
    const c = await client();
    return c.auth.getSession();
  }

  async function signOut() {
    const c = await client();
    return c.auth.signOut();
  }

  /* ---------------------------------------------------------
     Network menu
     --------------------------------------------------------- */

  function branchMenu() {
    if (document.getElementById('crowrules-network-menu')) return;

    const wrap = document.createElement('div');
    wrap.id = 'crowrules-network-menu';
    wrap.innerHTML =
      '<button type="button" aria-expanded="false" aria-label="CrowRules Network">☰ CrowRules Network</button>' +
      '<div class="crowrules-network-menu-list"></div>';

    Object.assign(wrap.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '99999',
      fontFamily: 'system-ui,sans-serif'
    });

    const button = wrap.querySelector('button');
    Object.assign(button.style, {
      background: '#10131a',
      color: '#fff',
      border: '1px solid #394151',
      borderRadius: '10px',
      padding: '10px 14px',
      fontWeight: '800',
      cursor: 'pointer'
    });

    const menu = wrap.querySelector('.crowrules-network-menu-list');
    Object.assign(menu.style, {
      display: 'none',
      marginBottom: '7px',
      background: '#0b0e14',
      border: '1px solid #394151',
      borderRadius: '12px',
      padding: '8px',
      boxShadow: '0 15px 40px #0008',
      minWidth: '230px'
    });

    BRANCHES.forEach((branch) => {
      const link = document.createElement('a');
      link.href = branch.url;
      link.textContent = `${branch.icon} ${branch.name}`;
      Object.assign(link.style, {
        display: 'block',
        color: '#fff',
        padding: '9px',
        textDecoration: 'none',
        borderRadius: '7px'
      });

      link.addEventListener('mouseenter', () => {
        link.style.background = '#1b202b';
      });
      link.addEventListener('mouseleave', () => {
        link.style.background = 'transparent';
      });

      menu.appendChild(link);
    });

    button.addEventListener('click', () => {
      const open = menu.style.display !== 'none';
      menu.style.display = open ? 'none' : 'block';
      button.setAttribute('aria-expanded', String(!open));
    });

    document.body.appendChild(wrap);
  }

  async function publishBranchRegistry() {
    try {
      const c = await client();
      const result = await c
        .from('crowrules_branches')
        .select(
          'id,name,slug,description,url,icon,sort_order,is_featured,is_active'
        )
        .eq('is_active', true)
        .order('sort_order');

      if (result.error) {
        return { data: BRANCHES, error: result.error };
      }

      return result;
    } catch (error) {
      return { data: BRANCHES, error };
    }
  }

  /* ---------------------------------------------------------
     TV snapshot
     --------------------------------------------------------- */

  async function getTVSnapshot(channelId = null) {
    const c = await client();

    const channelsPromise = c
      .from('tv_channels')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('channel_number');

    const schedulesPromise = channelId
      ? c
          .from('schedule_items')
          .select('*')
          .eq('channel_id', channelId)
          .limit(500)
      : Promise.resolve({ data: [], error: null });

    const playlistsPromise = channelId
      ? c
          .from('tv_channel_playlist')
          .select('*')
          .eq('channel_id', channelId)
          .eq('enabled', true)
          .order('playlist_position')
      : Promise.resolve({ data: [], error: null });

    const [channels, schedules, playlists] = await Promise.all([
      channelsPromise,
      schedulesPromise,
      playlistsPromise
    ]);

    return {
      channels: channels.data || [],
      schedules: schedules.data || [],
      playlists: playlists.data || [],
      errors: [channels.error, schedules.error, playlists.error].filter(Boolean)
    };
  }

  /* ---------------------------------------------------------
     Realtime singleton
     --------------------------------------------------------- */

  let realtimePromise = null;

  function setupTVRealtime() {
    if (realtimePromise) return realtimePromise;

    realtimePromise = client()
      .then((c) => {
        if (window.__crowrulesTVRealtimeChannel) {
          return window.__crowrulesTVRealtimeChannel;
        }

        const channel = c
          .channel('crowrules-unified-tv-sync-v2')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'schedule_items' },
            (payload) => {
              window.dispatchEvent(
                new CustomEvent('crowrules:tv-sync', {
                  detail: { table: 'schedule_items', payload }
                })
              );
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tv_channel_playlist' },
            (payload) => {
              window.dispatchEvent(
                new CustomEvent('crowrules:tv-sync', {
                  detail: { table: 'tv_channel_playlist', payload }
                })
              );
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tv_channels' },
            (payload) => {
              window.dispatchEvent(
                new CustomEvent('crowrules:tv-sync', {
                  detail: { table: 'tv_channels', payload }
                })
              );
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'episodes' },
            (payload) => {
              window.dispatchEvent(
                new CustomEvent('crowrules:tv-sync', {
                  detail: { table: 'episodes', payload }
                })
              );
            }
          );

        window.__crowrulesTVRealtimeChannel = channel;
        window.__crowrulesTVRealtimeReady = false;

        return channel.subscribe((status) => {
          window.__crowrulesTVRealtimeStatus = status;
          window.__crowrulesTVRealtimeReady =
            status === 'SUBSCRIBED';

          window.dispatchEvent(
            new CustomEvent('crowrules:realtime-status', {
              detail: { status }
            })
          );
        });
      })
      .catch((error) => {
        console.warn('[CrowRules Core] Realtime setup failed:', error);
        realtimePromise = null;
        return null;
      });

    return realtimePromise;
  }

  /* ---------------------------------------------------------
     Legacy cleanup
     --------------------------------------------------------- */

  function cleanupLegacyTVCards() {
    if (!isTVPage()) return;

    const selectors = [
      'body > section.section[id^="crowrules-"]',
      'body > section.section:not([id]) .cards',
      'body > section:not(.page) .cards',
      'body > div.crowrules-community',
      'body > section.crowrules-community',
      '[data-crowrules-legacy-card]'
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    });
  }

  async function loadCommunity() {
    // TV v3+ renders its own community/home sections.
    // The unified core intentionally does not inject duplicate sections.
    return;
  }

  function card(item, index, kind) {
    const title =
      pick(item, ['title', 'name', 'display_name'], 'Untitled');

    const image = pick(item, [
      'thumbnail_url',
      'youtube_thumbnail_url',
      'image_url',
      'cover_url',
      'avatar_url'
    ]);

    const meta =
      kind === 'member'
        ? `${Number(item.points || item.lifetime_points || 0)} points`
        : `${score(item).toLocaleString()} views`;

    return `
      <article class="card" style="position:relative">
        <div class="thumb" style="background:#151515;display:grid;place-items:center">
          ${
            image
              ? `<img src="${esc(image)}" alt="" loading="lazy">`
              : '<span style="font-size:30px">🐦‍⬛</span>'
          }
        </div>
        <div class="body">
          <div class="meta">#${index + 1}</div>
          <strong>${esc(title)}</strong>
          <div class="meta">${esc(meta)}</div>
        </div>
      </article>
    `;
  }

  function section(id, title, sub) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';
    sectionEl.id = id;
    sectionEl.innerHTML = `
      <div class="container">
        <div class="sectionHead">
          <div>
            <h2>${esc(title)}</h2>
            <div class="sub">${esc(sub)}</div>
          </div>
        </div>
        <div class="cards" id="${esc(id)}List">
          <div class="empty">Loading…</div>
        </div>
      </div>
    `;
    return sectionEl;
  }

  /* ---------------------------------------------------------
     Playlist-first TV engine
     --------------------------------------------------------- */

  async function startPlaylistFirstTV() {
    if (!isTVPage()) return;
    if (window.__crowrulesPlaylistTVStarted) {
      return window.__crowrulesPlaylistTV;
    }

    window.__crowrulesPlaylistTVStarted = true;

    const c = await client();

    const state = {
      channelId: null,
      channels: [],
      items: [],
      episodes: [],
      position: 0,
      currentKey: null,
      started: false,
      refreshTimer: null,
      realtimeChannels: []
    };

    const media = (obj) =>
      pick(obj, [
        'video_url',
        'youtube_url',
        'stream_url',
        'play_url',
        'media_url',
        'url'
      ], '');

    const youtubeId = (url) => {
      if (!url) return null;

      try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

        if (host === 'youtu.be') {
          return parsed.pathname.split('/').filter(Boolean)[0] || null;
        }

        if (
          host === 'youtube.com' ||
          host === 'm.youtube.com' ||
          host === 'music.youtube.com'
        ) {
          if (parsed.pathname === '/watch') {
            return parsed.searchParams.get('v');
          }

          const parts = parsed.pathname.split('/').filter(Boolean);

          if (parts[0] === 'embed' || parts[0] === 'shorts') {
            return parts[1] || null;
          }
        }
      } catch (_) {}

      return null;
    };

    const getChannels = async () => {
      const result = await c
        .from('tv_channels')
        .select('id,name,slug,channel_number,is_active,sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .order('channel_number');

      if (result.error) {
        console.warn('[CrowRules TV] Channel load failed:', result.error.message);
        return [];
      }

      return result.data || [];
    };

    const getPlaylist = async () => {
      if (!state.channelId) return [];

      const result = await c
        .from('tv_channel_playlist')
        .select(
          'id,channel_id,episode_id,playlist_position,enabled,live_event_id,schedule_item_id'
        )
        .eq('channel_id', state.channelId)
        .eq('enabled', true)
        .order('playlist_position');

      if (result.error) {
        console.warn('[CrowRules TV] Playlist load failed:', result.error.message);
        return [];
      }

      return result.data || [];
    };

    const getEpisodes = async (ids) => {
      if (!ids.length) return [];

      const result = await c
        .from('episodes')
        .select('*')
        .in('id', ids);

      if (result.error) {
        console.warn('[CrowRules TV] Episode load failed:', result.error.message);
        return [];
      }

      return result.data || [];
    };

    const resolve = async (item) => {
      let episode = null;

      if (item.episode_id) {
        episode =
          state.episodes.find(
            (row) => String(row.id) === String(item.episode_id)
          ) || null;
      }

      let url = media(episode);

      if (!url && item.schedule_item_id) {
        const result = await c
          .from('schedule_items')
          .select('*')
          .eq('id', item.schedule_item_id)
          .maybeSingle();

        if (!result.error) {
          url = media(result.data);
        }
      }

      return { item, episode, url };
    };

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    const setInfo = (resolved) => {
      const episode = resolved?.episode;
      const channel =
        state.channels.find(
          (row) => String(row.id) === String(state.channelId)
        ) || null;

      const title =
        pick(episode, ['title', 'name'], 'CrowRules TV');

      const description =
        pick(
          episode,
          ['description', 'summary'],
          'Continuous programming from the channel playlist.'
        );

      setText('currentTitle', title);
      setText('currentDesc', description);
      setText('heroTitle', title);

      const channelName =
        pick(channel, ['name'], 'CROWRULES TV');

      setText(
        'status',
        `ON AIR • PLAYLIST • ${channelName}`
      );
    };

    const playlistKey = (resolved) => {
      if (!resolved) return null;

      return [
        resolved.item?.id || '',
        resolved.episode?.id || '',
        resolved.url || ''
      ].join('|');
    };

    const renderEmpty = () => {
      const player = document.getElementById('player');
      if (!player) return;

      player.innerHTML = `
        <div class="msg">
          No enabled videos are in this channel playlist.
          <br><br>
          Add episodes to <b>tv_channel_playlist</b> in Admin Pro.
        </div>
      `;

      setText('status', 'PLAYLIST EMPTY');
      setText('currentTitle', 'CrowRules TV');
      setText(
        'currentDesc',
        'No enabled programming is currently available.'
      );
    };

    const attachYouTube = (iframe, id) => {
      const startPlayer = () => {
        if (!window.YT?.Player || !document.getElementById(iframe.id)) {
          return;
        }

        try {
          new window.YT.Player(iframe.id, {
            events: {
              onStateChange: (event) => {
                if (event.data === 0) {
                  next();
                }
              },
              onError: () => {
                setTimeout(() => next(), 1200);
              }
            }
          });
        } catch (error) {
          console.warn('[CrowRules TV] YouTube player error:', error);
        }
      };

      if (window.YT?.Player) {
        startPlayer();
        return;
      }

      if (!document.getElementById('cr-yt-api')) {
        const script = document.createElement('script');
        script.id = 'cr-yt-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }

      const previousReady = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === 'function') {
          try {
            previousReady();
          } catch (_) {}
        }
        startPlayer();
      };
    };

    const play = async (requestedPosition, force = false) => {
      if (!state.items.length) {
        renderEmpty();
        return;
      }

      state.position =
        ((requestedPosition % state.items.length) + state.items.length) %
        state.items.length;

      const resolved = await resolve(state.items[state.position]);

      if (!resolved.url) {
        console.warn(
          '[CrowRules TV] Playlist item has no playable media:',
          resolved.item
        );

        if (state.items.length > 1) {
          return next();
        }

        renderEmpty();
        return;
      }

      const key = playlistKey(resolved);

      // Realtime refreshes can happen while a video is playing.
      // Do not restart the same item unless explicitly requested.
      if (!force && state.started && state.currentKey === key) {
        setInfo(resolved);
        return;
      }

      state.currentKey = key;
      state.started = true;
      setInfo(resolved);

      const player = document.getElementById('player');
      if (!player) return;

      const id = youtubeId(resolved.url);

      if (id) {
        const iframeId =
          'playlistYT-' + Date.now().toString(36);

        player.innerHTML = `
          <iframe
            id="${esc(iframeId)}"
            src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&enablejsapi=1&playsinline=1&rel=0"
            title="${esc(
              pick(resolved.episode, ['title', 'name'], 'CrowRules TV')
            )}"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen
          ></iframe>
        `;

        attachYouTube(document.getElementById(iframeId), id);
        return;
      }

      player.innerHTML = `
        <video
          id="playlistVideo"
          controls
          autoplay
          muted
          playsinline
          preload="auto"
        ></video>
      `;

      const video = document.getElementById('playlistVideo');
      video.src = resolved.url;

      video.addEventListener('ended', next, { once: true });
      video.addEventListener(
        'error',
        () => setTimeout(() => next(), 1200),
        { once: true }
      );

      try {
        await video.play();
      } catch (_) {
        // Browser autoplay policy may require a user gesture.
      }
    };

    async function next() {
      if (!state.items.length) {
        await refresh(true);
        return;
      }

      state.position =
        (state.position + 1) % state.items.length;

      await play(state.position, true);
    }

    async function refresh(forceRebuild = false) {
      cleanupLegacyTVCards();

      const previousChannelId = state.channelId;
      const previousKey = state.currentKey;

      state.channels = await getChannels();

      if (!state.channels.length) {
        state.items = [];
        renderEmpty();
        return;
      }

      if (
        !state.channelId ||
        !state.channels.some(
          (channel) => String(channel.id) === String(state.channelId)
        )
      ) {
        state.channelId = state.channels[0].id;
      }

      const channelChanged =
        String(previousChannelId) !== String(state.channelId);

      const newItems = await getPlaylist();
      const episodeIds = newItems
        .map((item) => item.episode_id)
        .filter(Boolean);

      const newEpisodes = await getEpisodes(episodeIds);

      const oldSignature = state.items
        .map((item) => `${item.id}:${item.playlist_position}:${item.enabled}`)
        .join(',');

      const newSignature = newItems
        .map((item) => `${item.id}:${item.playlist_position}:${item.enabled}`)
        .join(',');

      state.items = newItems;
      state.episodes = newEpisodes;

      if (!state.items.length) {
        state.position = 0;
        state.currentKey = null;
        state.started = false;
        renderEmpty();
        return;
      }

      if (state.position >= state.items.length) {
        state.position = 0;
      }

      const playlistChanged =
        oldSignature !== newSignature ||
        channelChanged ||
        forceRebuild;

      if (!state.started || playlistChanged) {
        // Keep the currently playing item when it still exists.
        let desiredPosition = state.position;

        if (previousKey) {
          const matchingIndex = await (async () => {
            for (let i = 0; i < state.items.length; i++) {
              const resolved = await resolve(state.items[i]);
              if (playlistKey(resolved) === previousKey) return i;
            }
            return -1;
          })();

          if (matchingIndex >= 0) {
            desiredPosition = matchingIndex;
          }
        }

        await play(desiredPosition, !previousKey || channelChanged);
      } else {
        // Metadata-only refresh: update text but never restart playback.
        const resolved = await resolve(state.items[state.position]);
        setInfo(resolved);
      }
    }

    async function setChannel(id) {
      state.channelId = id;
      state.position = 0;
      state.currentKey = null;
      state.started = false;
      await refresh(true);
    }

    const subscribeTable = (table) => {
      const channelName =
        `crowrules-playlist-first-${table}-v2`;

      const realtimeChannel = c
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => {
            // Debounced refresh avoids multiple simultaneous DB events
            // causing repeated queries/player work.
            clearTimeout(state.refreshTimer);
            state.refreshTimer = setTimeout(() => {
              refresh(false).catch((error) =>
                console.warn('[CrowRules TV] Realtime refresh failed:', error)
              );
            }, 350);
          }
        );

      state.realtimeChannels.push(realtimeChannel);
      realtimeChannel.subscribe();
    };

    subscribeTable('tv_channel_playlist');
    subscribeTable('tv_channels');
    subscribeTable('episodes');

    window.CrowRulesPlaylistTV = {
      refresh: () => refresh(true),
      next,
      setChannel,
      getState: () => ({
        channelId: state.channelId,
        channels: [...state.channels],
        items: [...state.items],
        position: state.position,
        currentKey: state.currentKey
      })
    };

    await refresh(false);

    window.__crowrulesPlaylistTV = window.CrowRulesPlaylistTV;
    return window.CrowRulesPlaylistTV;
  }

  /* ---------------------------------------------------------
     Live Events schedule/countdown
     --------------------------------------------------------- */

  function liveEventsCountdown() {
    if (!isTVPage()) return;
    if (window.__crowrulesLiveEventsCountdown) {
      return window.__crowrulesLiveEventsCountdown;
    }

    const state = {
      liveChannelId: null,
      rows: [],
      timer: null,
      refreshTimer: null,
      realtimeChannel: null,
      initialized: false
    };

    const getLiveChannel = async () => {
      const c = await client();

      const result = await c
        .from('tv_channels')
        .select('id,name,slug,is_active')
        .eq('slug', 'live')
        .eq('is_active', true)
        .maybeSingle();

      if (result.error) {
        console.warn(
          '[CrowRules TV] Live channel lookup failed:',
          result.error.message
        );
        return null;
      }

      state.liveChannelId = result.data?.id || null;
      return result.data || null;
    };

    const getRows = async () => {
      if (!state.liveChannelId) {
        await getLiveChannel();
      }

      if (!state.liveChannelId) return [];

      const c = await client();

      const result = await c
        .from('schedule_items')
        .select(
          [
            'id',
            'title',
            'description',
            'starts_at',
            'ends_at',
            'start_time',
            'end_time',
            'item_type',
            'status',
            'is_active',
            'channel_id',
            'thumbnail_url',
            'video_url',
            'video_type',
            'youtube_url',
            'episode_id',
            'show_id'
          ].join(',')
        )
        .eq('channel_id', state.liveChannelId)
        .order('starts_at', { ascending: true })
        .limit(200);

      if (result.error) {
        console.warn(
          '[CrowRules TV] Live Events schedule load failed:',
          result.error.message
        );
        return [];
      }

      const now = Date.now();

      return (result.data || [])
        .filter(
          (row) =>
            row.is_active === undefined ||
            row.is_active === null ||
            row.is_active === true
        )
        .filter(
          (row) =>
            row.status === undefined ||
            row.status === null ||
            ['scheduled', 'published', 'active', 'live'].includes(
              String(row.status).toLowerCase()
            )
        )
        .filter((row) => {
          const start = new Date(
            row.starts_at || row.start_time
          ).getTime();

          const end = new Date(
            row.ends_at || row.end_time
          ).getTime();

          return (
            Number.isFinite(start) &&
            Number.isFinite(end) &&
            end >= now - 3600000
          );
        })
        .sort(
          (a, b) =>
            new Date(a.starts_at || a.start_time).getTime() -
            new Date(b.starts_at || b.start_time).getTime()
        );
    };

    const formatCountdown = (milliseconds) => {
      let seconds = Math.max(
        0,
        Math.floor(milliseconds / 1000)
      );

      const days = Math.floor(seconds / 86400);
      seconds %= 86400;

      const hours = Math.floor(seconds / 3600);
      seconds %= 3600;

      const minutes = Math.floor(seconds / 60);
      seconds %= 60;

      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');

      return days
        ? `${days}d ${hh}:${mm}:${ss}`
        : `${hh}:${mm}:${ss}`;
    };

    const ensureHost = () => {
      let host = document.getElementById('liveEventCountdown');
      if (host) return host;

      const panel = document.querySelector('.schedule-panel');
      if (!panel) return null;

      host = document.createElement('div');
      host.id = 'liveEventCountdown';

      host.style.cssText =
        'padding:14px 16px;border-bottom:1px solid #252525;' +
        'background:linear-gradient(180deg,#151515,#0d0d0d);';

      const list = panel.querySelector('.schedule-list');
      if (list) panel.insertBefore(host, list);
      else panel.appendChild(host);

      return host;
    };

    const render = () => {
      const host = ensureHost();
      if (!host) return;

      const now = Date.now();

      const current = state.rows.find((row) => {
        const start = new Date(
          row.starts_at || row.start_time
        ).getTime();

        const end = new Date(
          row.ends_at || row.end_time
        ).getTime();

        return start <= now && end > now;
      });

      const next = state.rows.find((row) => {
        const start = new Date(
          row.starts_at || row.start_time
        ).getTime();

        return start > now;
      });

      const item = current || next;

      if (!item) {
        host.innerHTML = `
          <div style="font-family:Orbitron,sans-serif;font-size:11px;color:#777">
            LIVE EVENTS
          </div>
          <div style="margin-top:6px;color:#aaa;font-size:11px">
            No upcoming live events scheduled.
          </div>
        `;
        return;
      }

      const start = new Date(
        item.starts_at || item.start_time
      ).getTime();

      const end = new Date(
        item.ends_at || item.end_time
      ).getTime();

      const isLive = Boolean(current);
      const remaining = isLive ? end - now : start - now;

      const when = new Date(
        isLive ? end : start
      ).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      host.innerHTML = `
        <div style="
          font-family:Orbitron,sans-serif;
          font-size:10px;
          letter-spacing:1px;
          color:${isLive ? '#ff6666' : '#aaa'}
        ">
          ${isLive ? '● LIVE EVENT' : 'NEXT LIVE EVENT'}
        </div>

        <div style="
          font-weight:800;
          font-size:13px;
          margin-top:5px;
          overflow-wrap:anywhere
        ">
          ${esc(item.title || 'Live Event')}
        </div>

        <div style="
          font-family:Orbitron,sans-serif;
          font-size:24px;
          font-weight:800;
          margin-top:8px
        ">
          ${formatCountdown(remaining)}
        </div>

        <div style="
          color:#777;
          font-size:9px;
          margin-top:4px
        ">
          ${isLive ? 'TIME REMAINING' : 'COUNTDOWN TO START'} · ${esc(when)}
        </div>
      `;
    };

    const refresh = async () => {
      try {
        state.rows = await getRows();
        render();
      } catch (error) {
        console.warn(
          '[CrowRules TV] Live Events refresh failed:',
          error
        );
      }
    };

    const debouncedRefresh = () => {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = setTimeout(refresh, 250);
    };

    const subscribeRealtime = async () => {
      if (state.realtimeChannel || !state.liveChannelId) return;

      const c = await client();

      // IMPORTANT: liveChannelId is now known, so this filter is valid.
      state.realtimeChannel = c
        .channel('crowrules-live-events-schedule-v2')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedule_items',
            filter: `channel_id=eq.${state.liveChannelId}`
          },
          debouncedRefresh
        );

      state.realtimeChannel.subscribe();
    };

    const watchLiveChannelButton = () => {
      const buttons = document.querySelectorAll(
        '.channel-pill, .channel'
      );

      buttons.forEach((button) => {
        if (button.dataset.crowrulesLiveBound === '1') return;
        if (!/live events/i.test(button.textContent || '')) return;

        button.dataset.crowrulesLiveBound = '1';
        button.addEventListener('click', () => {
          setTimeout(refresh, 100);
        });
      });
    };

    const start = async () => {
      if (state.initialized) return;

      state.initialized = true;

      await getLiveChannel();
      await subscribeRealtime();
      await refresh();

      clearInterval(state.timer);
      state.timer = setInterval(render, 1000);

      // Re-read schedule every 30 seconds as a fallback even if
      // Realtime is unavailable or the page reconnects.
      setInterval(refresh, 30000);

      watchLiveChannelButton();
      setInterval(watchLiveChannelButton, 2000);
    };

    const api = {
      refresh,
      render,
      getState: () => ({
        liveChannelId: state.liveChannelId,
        rows: [...state.rows]
      })
    };

    window.__crowrulesLiveEventsCountdown = api;
    start();

    return api;
  }

  /* ---------------------------------------------------------
     Bootstrap
     --------------------------------------------------------- */

  ready(() => {
    document.documentElement.dataset.crowrulesCore = '2.0';

    branchMenu();
    setupTVRealtime();
    cleanupLegacyTVCards();
    loadCommunity();

    window.addEventListener('crowrules:tv-sync', (event) => {
      if (!isTVPage()) return;

      const table = event.detail?.table;

      if (
        table === 'schedule_items' &&
        window.__crowrulesLiveEventsCountdown
      ) {
        window.__crowrulesLiveEventsCountdown.refresh();
      }

      if (
        table === 'tv_channel_playlist' ||
        table === 'tv_channels' ||
        table === 'episodes'
      ) {
        startPlaylistFirstTV().catch((error) =>
          console.warn(
            '[CrowRules TV] Playlist sync failed:',
            error
          )
        );
      }
    });

    if (isTVPage()) {
      setTimeout(() => {
        startPlaylistFirstTV().catch((error) =>
          console.warn('[CrowRules TV] Startup failed:', error)
        );
      }, 400);

      setTimeout(() => {
        liveEventsCountdown();
      }, 700);
    }
  });

  window.CrowRulesCore = {
    version: '2.0.0',
    supabaseUrl: SUPABASE_URL,
    adminUrl: ADMIN_PRO_URL,
    tvUrl: TV_URL,
    branches: BRANCHES,
    client,
    session,
    signOut,
    publishBranchRegistry,
    getTVSnapshot,
    setupTVRealtime,
    branchMenu,
    cleanupLegacyTVCards
  };
})();
