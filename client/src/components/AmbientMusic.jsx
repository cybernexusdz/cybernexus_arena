import { useEffect, useRef, useState } from 'react';
import { useRoom } from '../context/RoomContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

const TRACK_URL = '/assets/music/menu.mp3';

export default function AmbientMusic() {
  const audio = useRef(null);
  const [available, setAvailable] = useState(false);
  const { room } = useRoom();
  const { settings } = useSettings();
  const inMatch = room?.phase === 'match' || room?.phase === 'results';

  useEffect(() => {
    const controller = new AbortController();
    fetch(TRACK_URL, { method: 'HEAD', signal: controller.signal }).then((response) => {
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
        console.warn(`Site music is unavailable. Add the audio track at client/public${TRACK_URL}.`);
        return;
      }
      setAvailable(true);
    }).catch((error) => {
      if (error.name !== 'AbortError') console.error('Could not check the site music track:', error);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.volume = settings.volume / 100;
  }, [settings.volume, available]);

  useEffect(() => {
    const player = audio.current;
    if (!available || !settings.musicEnabled || inMatch || !player) {
      player?.pause();
      return undefined;
    }

    let active = true;
    const removeGestureListeners = () => {
      document.removeEventListener('pointerdown', tryPlay);
      document.removeEventListener('keydown', tryPlay);
    };
    const tryPlay = () => {
      player.play().then(removeGestureListeners).catch((error) => {
        if (!active) return;
        if (error.name === 'NotAllowedError') {
          document.addEventListener('pointerdown', tryPlay, { once: true });
          document.addEventListener('keydown', tryPlay, { once: true });
        } else {
          console.error('Could not play the site music track:', error);
        }
      });
    };

    tryPlay();
    return () => {
      active = false;
      removeGestureListeners();
      player.pause();
    };
  }, [available, settings.musicEnabled, inMatch]);

  return <audio ref={audio} src={available ? TRACK_URL : undefined} loop preload="none" />;
}
