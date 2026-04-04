import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Box, Paper, Stack, Chip, Typography } from '@mui/material';
import WheelOfNames from '../components/WheelOfNames';

const SessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const { displayName, token } = (location.state || {}) as { displayName: string; token: string };
  const [names, setNames] = useState<string[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId || !displayName) return;

    const socketUrl = `${import.meta.env.VITE_WS_URL}/prod?sessionId=${sessionId}&displayName=${encodeURIComponent(displayName)}&token=${token}&role=participant`;
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', displayName }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'spin_result':
          setWinner(data.winner);
          setIsSpinning(false);
          break;
        case 'participant_joined':
          setParticipants((prev) => [...prev, data.displayName]);
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

    socket.onclose = () => {
      socketRef.current = null;
    };

    return () => {
      socket.close();
    };
  }, [sessionId]);

  return (
    <Box
      sx={{
        backgroundColor: '#282c34',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <Paper elevation={3} sx={{ width: '100%', maxWidth: '600px', padding: '20px', backgroundColor: '#1f2329' }}>
        <WheelOfNames names={names} isSpinning={isSpinning} winner={winner} />
        <Stack direction="row" flexWrap="wrap" spacing={1} mt={2}>
          {participants.map((participant, index) => (
            <Chip key={index} label={participant} variant="outlined" />
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
