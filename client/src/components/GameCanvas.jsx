import { useEffect, useRef } from 'react';
import { createGame } from '../game/createGame.js';

/** Mounts one Phaser game into a div and tears it down (scenes, listeners, WebGL context) on unmount. */
export default function GameCanvas({ bridge }) {
  const host = useRef(null);
  useEffect(() => {
    const game = createGame(host.current, bridge);
    return () => game.destroy(true);
  }, [bridge]);
  return <div ref={host} className="game-canvas" />;
}
