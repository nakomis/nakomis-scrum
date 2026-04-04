import { useEffect, useState } from 'react';
import { Box, TextField, Button, Typography, Paper } from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface TokenPayload {
  sessionId: string;
}

const JoinSessionPage = () => {
  const [displayName, setDisplayName] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
            .join(''),
        );
        const payload: TokenPayload = JSON.parse(jsonPayload);
        setSessionId(payload.sessionId);
      } catch (error) {
        console.error('Invalid token');
      }
    }
  }, [searchParams]);

  const handleSubmit = () => {
    if (displayName && sessionId) {
      navigate(`/session/${sessionId}`, { state: { displayName, token: searchParams.get('token') } });
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#282c34',
        color: '#ffffff',
      }}
    >
      <Paper elevation={3} style={{ padding: 20, borderRadius: 8 }}>
        <Typography variant="h5" gutterBottom>
          Join Session
        </Typography>
        <TextField
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          margin="normal"
          required
        />
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Join Session
        </Button>
      </Paper>
    </Box>
  );
};

export default JoinSessionPage;
