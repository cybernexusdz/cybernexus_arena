export default function ConnectionBadge({ status, latency, compact }) {
  const label = status === 'connected' ? (latency ? `${latency} ms` : 'Online') : status === 'connecting' ? 'Reconnecting…' : 'Offline';
  const quality = status !== 'connected' ? status : latency > 200 ? 'poor' : latency > 100 ? 'fair' : 'good';
  return <span className={`conn conn-${quality}`} title={`Connection: ${status}`}><i />{!compact && label}</span>;
}
