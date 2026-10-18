import { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Box, Paper, Stack, Chip, Typography, CircularProgress } from '@mui/material';
import WheelOfNames from '../components/WheelOfNames';
import ErrorAlert from '../components/ErrorAlert';
import { useReconnectingWebSocket } from '../hooks/useReconnectingWebSocket';

const SessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const { displayName, token } = (location.state || {}) as { displayName: string; token: string };
  const [names, setNames] = useState<string[]>([]);
  const [participants, setParticipants] = useState<{ connectionId: string; displayName: string }[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);
  const handleMessage = (event: MessageEvent) => {
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

  const { status: connection, reconnect } = useReconnectingWebSocket({
    enabled: !!sessionId && !!displayName,
    connectionKey: sessionId ?? '',
    buildUrl: () =>
      `${import.meta.env.VITE_WS_URL}?sessionId=${sessionId}&displayName=${encodeURIComponent(displayName)}&token=${token}&role=participant`,
    onOpen: (socket) => {
      // Spin results missed whilst disconnected would leave the wheel stuck spinning;
      // participants are kept (the server doesn't replay them) and de-duplicated.
      setIsSpinning(false);
      setWinner(null);
      socket.send(JSON.stringify({ type: 'join', displayName }));
    },
    onMessage: handleMessage,
  });

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
        {displayName && (connection === 'connecting' || connection === 'reconnecting') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              {connection === 'connecting' ? 'Connecting to session…' : 'Connection lost, reconnecting…'}
            </Typography>
          </Box>
        )}
        {displayName && connection === 'failed' && (
          <ErrorAlert
            message="Connection lost, reload to rejoin."
            onRetry={reconnect}
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
