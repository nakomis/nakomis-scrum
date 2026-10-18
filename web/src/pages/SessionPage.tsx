import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Box, Paper, Stack, Chip, Typography, CircularProgress } from '@mui/material';
import WheelOfNames from '../components/WheelOfNames';
import ErrorAlert from '../components/ErrorAlert';

const SessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const { displayName, token } = (location.state || {}) as { displayName: string; token: string };
  const [names, setNames] = useState<string[]>([]);
  const [participants, setParticipants] = useState<{ connectionId: string; displayName: string }[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'open' | 'error'>('connecting');
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    if (!sessionId || !displayName) return;

    const socketUrl = `${import.meta.env.VITE_WS_URL}?sessionId=${sessionId}&displayName=${encodeURIComponent(displayName)}&token=${token}&role=participant`;
    setConnection('connecting');
    // Spin results missed whilst disconnected would leave the wheel stuck spinning;
    // participants are kept (the server doesn't replay them) and de-duplicated.
    setIsSpinning(false);
    setWinner(null);
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnection('open');
      socket.send(JSON.stringify({ type: 'join', displayName }));
    };

    socket.onerror = () => setConnection('error');

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        console.error('Malformed WebSocket message:', event.data);
        return;
      }
      switch (data.type) {
        case 'spin_result':
          setWinner(data.winner);
          setIsSpinning(false);
          break;
        case 'participant_joined':
          setParticipants((prev) =>
            prev.some((p) => p.connectionId === data.connectionId)
              ? prev
              : [...prev, { connectionId: data.connectionId, displayName: data.displayName }]
          );
          break;
        case 'names_updated':
          setNames(data.names as string[]);
          break;
        case 'spin_started':
          setIsSpinning(true);
          setWinner(null);
          break;
      }
    };

    // Ignore close events from a socket that has already been replaced or torn down
    socket.onclose = () => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      setConnection('error');
    };

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [sessionId, reconnectKey]);

  return (
    <Box
      sx={{
        backgroundColor: '#282c34',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { xs: '8px', sm: '20px' },
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <Paper elevation={3} sx={{ width: '100%', maxWidth: '600px', padding: { xs: '12px', sm: '20px' }, backgroundColor: '#1f2329', boxSizing: 'border-box' }}>
        {!displayName && (
          <ErrorAlert message="No display name provided. Please join the session again using your invite link." />
        )}
        {displayName && connection === 'connecting' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Connecting to session…</Typography>
          </Box>
        )}
        {displayName && connection === 'error' && (
          <ErrorAlert
            message="Lost connection to the session."
            onRetry={() => setReconnectKey((k) => k + 1)}
            retryLabel="Reconnect"
          />
        )}
        <WheelOfNames names={names} isSpinning={isSpinning} winner={winner} />
        <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap mt={2}>
          {participants.map((participant) => (
            <Chip key={participant.connectionId} label={participant.displayName} variant="outlined" sx={{ maxWidth: '100%' }} />
          ))}
        </Stack>
        {!isSpinning && !winner && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Waiting for the spin...
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default SessionPage;
