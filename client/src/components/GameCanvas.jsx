import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { createGame } from '../game/createGame.js';

let pendingGameDestroy = Promise.resolve();

/** Mounts one Phaser game into a div and tears it down (scenes, listeners, WebGL context) on unmount. */
export default function GameCanvas({ bridge }) {
  const host = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let game = null;
    const mount = async () => {
      await pendingGameDestroy;
      if (cancelled || !host.current) return;
      game = createGame(host.current, bridge);
    };
    mount();
    return () => {
      cancelled = true;
      if (game) {
        const retiring = game;
        pendingGameDestroy = new Promise((resolve) => {
          retiring.events.once(Phaser.Core.Events.DESTROY, resolve);
          retiring.destroy(true);
        });
      }
    };
  }, [bridge]);
  return <div ref={host} className="game-canvas" />;
}
