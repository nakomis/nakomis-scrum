import { useCallback, useEffect, useRef, useState } from 'react';
import { List, ListItem, ListItemText, Skeleton, Typography } from '@mui/material';
import ErrorAlert from './ErrorAlert';

interface Spin {
  'timestamp#spinId': string;
  winner: string;
  timestamp: number;
}

interface SpinHistoryProps {
  sessionId: string;
  getToken: () => string | undefined;
  // Bump to refetch, e.g. when a spin_result arrives
  refreshKey: number;
}

const SpinHistory: React.FC<SpinHistoryProps> = ({ sessionId, getToken, refreshKey }) => {
  // null until the first successful load, so a refetch keeps showing what it has
  const [spins, setSpins] = useState<Spin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Overlapping fetches can resolve out of order; only the latest request may update state
  const requestIdRef = useRef(0);

  const fetchHistory = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const requestId = ++requestIdRef.current;
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${sessionId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: Spin[] = await response.json();
      if (requestId === requestIdRef.current) setSpins(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to fetch spin history:', err);
      setError('Could not load spin history.');
    }
  }, [sessionId, getToken]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  // Discard any in-flight response once unmounted or the session changes
  useEffect(() => () => {
    requestIdRef.current++;
  }, [sessionId]);

  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }} gutterBottom>
        Recent spins
      </Typography>
      {error && <ErrorAlert message={error} onRetry={fetchHistory} />}
      {spins === null && !error && (
        <>
          <Skeleton height={32} />
          <Skeleton height={32} />
        </>
      )}
      {spins?.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No spins yet.
        </Typography>
      )}
      {spins && spins.length > 0 && (
        <List dense>
          {spins.map((spin) => (
            <ListItem key={spin['timestamp#spinId']} disableGutters>
              <ListItemText
                primary={spin.winner}
                secondary={new Date(Number(spin.timestamp)).toLocaleString()}
              />
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
};

export default SpinHistory;
