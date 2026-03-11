(function() {
  return new Promise(async (resolve, reject) => {
    try {
      // Step 1: Get a videoId for the addToPlaylist service request
      const playerBar = document.querySelector('ytmusic-app-layout>ytmusic-player-bar');
      let videoId = null;
      try {
        videoId = playerBar?.playerApi?.getPlayerResponse()?.videoDetails?.videoId;
      } catch(e) {}
      // Fallback: use a well-known videoId if nothing is playing
      if (!videoId) videoId = 'dQw4w9WgXcQ';

      // Step 2: Fetch ALL playlists via YouTube Music's addToPlaylist service request
      const returnValue = [];
      const serviceRequestEvent = {
        bubbles: true,
        cancelable: false,
        composed: true,
        detail: {
          actionName: 'yt-service-request',
          args: [
            playerBar || document.querySelector('ytmusic-app'),
            { addToPlaylistEndpoint: { videoId: videoId } }
          ],
          optionalAction: false,
          returnValue: returnValue
        }
      };
      (playerBar || document.querySelector('ytmusic-app')).dispatchEvent(
        new CustomEvent('yt-action', serviceRequestEvent)
      );

      const response = await returnValue[0].ajaxPromise;
      const allPlaylists = response.data.contents[0].addToPlaylistRenderer.playlists;

      // Step 3: Get the playlist guide section (second section in sidebar)
      const guideSection = document.querySelectorAll('ytmusic-guide-section-renderer')[1];
      if (!guideSection || !guideSection.data) {
        resolve({ injected: 0, total: 0, error: 'Guide section not found' });
        return;
      }

      const existingItems = guideSection.data.items || [];
      const existingIds = new Set(
        existingItems.map(item =>
          item.guideEntryRenderer?.navigationEndpoint?.browseEndpoint?.browseId
        )
      );

      // Step 4: Convert playlists to guideEntryRenderer format, skip duplicates
      const newItems = [];
      for (const pl of allPlaylists) {
        const p = pl.playlistAddToOptionRenderer;
        const browseId = 'VL' + p.playlistId;

        // Skip already-present entries and Liked Music (already in sidebar)
        if (existingIds.has(browseId) || p.playlistId === 'LM') continue;

        newItems.push({
          guideEntryRenderer: {
            navigationEndpoint: {
              browseEndpoint: {
                browseId: browseId,
                browseEndpointContextSupportedConfigs: {
                  browseEndpointContextMusicConfig: {
                    pageType: 'MUSIC_PAGE_TYPE_PLAYLIST'
                  }
                }
              }
            },
            formattedTitle: {
              runs: [{ text: p.title.runs.map(r => r.text).join('') }]
            },
            accessibility: {
              accessibilityData: {
                label: p.title.runs.map(r => r.text).join('')
              }
            },
            entryData: {
              guideEntryData: { guideEntryId: browseId }
            }
          }
        });
      }

      // Step 5: Update the guide section via Polymer's set method
      const updatedItems = [...existingItems, ...newItems];
      guideSection.set('data', Object.assign({}, guideSection.data, { items: updatedItems }));

      resolve({
        injected: newItems.length,
        total: updatedItems.length,
        was: existingItems.length
      });
    } catch (e) {
      reject(e);
    }
  });
})
