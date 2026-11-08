import { useRoom } from '../context/RoomContext.jsx';
export default function Toasts() {
  const { toasts } = useRoom();
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>)}</div>;
}
