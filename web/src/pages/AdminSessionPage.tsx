import { useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useParams } from 'react-router-dom';
import {
  AppBar,
  Box,
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WheelOfNames from '../components/WheelOfNames';
import ErrorAlert from '../components/ErrorAlert';
import { currentReturnTo, type SigninState } from '../auth/returnTo';
import { useReconnectingWebSocket } from '../hooks/useReconnectingWebSocket';

const AdminSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const auth = useAuth();
  const { user } = auth;
  // Read the token through a ref so a silent renewal doesn't tear down the WebSocket;
  // the token is only checked when the socket (re)connects.
  const tokenRef = useRef<string | undefined>(user?.access_token);
  tokenRef.current = user?.access_token;
  const isSignedIn = !!user?.access_token;
  const [participants, setParticipants] = useState<
    { connectionId: string; displayName: string }[]
  >([]);
  const [names, setNames] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [magicLink, setMagicLink] = useState<string>('');
  const [addNameInput, setAddNameInput] = useState<string>('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleMessage = (event: MessageEvent) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      console.error('Malformed WebSocket message:', event.data);
      return;
    }
    switch (data.type) {
      case 'participant_joined':
        setParticipants((prev) =>
          prev.some((p) => p.connectionId === data.connectionId)
            ? prev
            : [...prev, { connectionId: data.connectionId, displayName: data.displayName }]
        );
        break;
      case 'spin_result':
        setWinner(data.winner);
        setIsSpinning(false);
        break;
      case 'names_updated':
        setNames(data.names);
        break;
    }
  };

  const { status: connection, send, reconnect } = useReconnectingWebSocket({
    enabled: isSignedIn && !!sessionId,
    connectionKey: sessionId ?? '',
    buildUrl: () => `${import.meta.env.VITE_WS_URL}?token=${tokenRef.current}&sessionId=${sessionId}&role=admin`,
    onOpen: () => {
      // Spin results missed whilst disconnected would leave the wheel stuck spinning.
      // The server doesn't replay the roster on connect, so participants are kept and
      // de-duplicated by connection ID rather than cleared.
      setIsSpinning(false);
      setWinner(null);
    },
    onMessage: handleMessage,
  });

  const handleSpin = () => {
    if (send({ type: 'spin', names })) setIsSpinning(true);
  };

  const handleAddName = (name: string) => {
    if (name && !names.includes(name)) {
      const updatedNames = [...names, name];
      setNames(updatedNames);
      send({ type: 'update_names', names: updatedNames });
    }
    setAddNameInput('');
  };

  const handleDeleteName = (name: string) => {
    const updatedNames = names.filter((n) => n !== name);
    setNames(updatedNames);
    send({ type: 'update_names', names: updatedNames });
  };

  const generateMagicLink = async () => {
    setLinkLoading(true);
    setLinkError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${sessionId}/magic-link`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user?.access_token}`,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { url } = await response.json();
      setMagicLink(url);
      setOpenDialog(true);
    } catch (error) {
      console.error('Failed to generate share link:', error);
      setLinkError('Could not generate a share link.');
    } finally {
      setLinkLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(magicLink);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#282c34',
      }}
    >
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Session
          </Typography>
          <Button
            color="inherit"
            onClick={generateMagicLink}
            disabled={linkLoading || !isSignedIn}
            startIcon={linkLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Share Link
          </Button>
        </Toolbar>
      </AppBar>
      {!isSignedIn && auth.isLoading && (
        <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ borderRadius: 0 }}>
          Signing in…
        </Alert>
      )}
      {!isSignedIn && !auth.isLoading && (
        <Alert
          severity="warning"
          sx={{ borderRadius: 0 }}
          action={(
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                const state: SigninState = { returnTo: currentReturnTo() };
                void auth.signinRedirect({ state });
              }}
            >
              Sign in
            </Button>
          )}
        >
          You are signed out. Sign in to run this session.
        </Alert>
      )}
      {isSignedIn && (connection === 'connecting' || connection === 'reconnecting') && (
        <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ borderRadius: 0 }}>
          {connection === 'connecting' ? 'Connecting to session…' : 'Connection lost, reconnecting…'}
        </Alert>
      )}
      {isSignedIn && connection === 'failed' && (
        <Box sx={{ px: 2 }}>
          <ErrorAlert
            message="Connection lost, reload to rejoin."
            onRetry={reconnect}
            retryLabel="Reconnect"
          />
        </Box>
      )}
      {linkError && (
        <Box sx={{ px: 2 }}>
          <ErrorAlert message={linkError} onRetry={generateMagicLink} />
        </Box>
      )}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <WheelOfNames names={names} isSpinning={isSpinning} winner={winner} />
        <Box
          component="div"
          sx={{
            width: 300,
            padding: 2,
            overflowY: 'auto',
            backgroundColor: '#1f2329',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Participants
          </Typography>
          <List dense>
            {participants.map((participant) => (
              <ListItem key={participant.connectionId}>
                <ListItemText primary={participant.displayName} />
              </ListItem>
            ))}
          </List>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }} gutterBottom>
            Names
          </Typography>
          <TextField
            label="Add Name"
            value={addNameInput}
            onChange={(e) => setAddNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddName(addNameInput)}
            variant="outlined"
            size="small"
          />
          <Button
            variant="contained"
            onClick={() => handleAddName(addNameInput)}
            disabled={!addNameInput.trim() || names.includes(addNameInput.trim())}
            sx={{ marginTop: 1 }}
          >
            Add
          </Button>
          <List dense>
            {names.map((name) => (
              <ListItem key={name}>
                <ListItemText primary={name} />
                <IconButton edge="end" size="small" onClick={() => handleDeleteName(name)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSpin}
            disabled={isSpinning || names.length === 0 || !isSignedIn || connection !== 'open'}
            sx={{ marginTop: 2 }}
          >
            Spin!
          </Button>
        </Box>
      </Box>
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Share Link</DialogTitle>
        <DialogContent>
          <Typography sx={{ wordBreak: 'break-all', mb: 2 }}>{magicLink}</Typography>
          <Button onClick={copyToClipboard} variant="contained" color="primary">
            Copy to Clipboard
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AdminSessionPage;
