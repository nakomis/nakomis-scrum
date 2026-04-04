import { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useParams } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
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

const AdminSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const [participants, setParticipants] = useState<
    { connectionId: string; displayName: string }[]
  >([]);
  const [names, setNames] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [magicLink, setMagicLink] = useState<string>('');
  const [addNameInput, setAddNameInput] = useState<string>('');

  useEffect(() => {
    const token = user?.access_token;
    if (token && sessionId) {
      socketRef.current = new WebSocket(
        `${import.meta.env.VITE_WS_URL}/prod?token=${token}&sessionId=${sessionId}&role=admin`
      );

      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'participant_joined':
            setParticipants((prev) => [
              ...prev,
              { connectionId: data.connectionId, displayName: data.displayName },
            ]);
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

      return () => {
        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    }
  }, [user, sessionId]);

  const handleSpin = () => {
    setIsSpinning(true);
    socketRef.current?.send(JSON.stringify({ type: 'spin', names }));
  };

  const handleAddName = (name: string) => {
    if (name && !names.includes(name)) {
      const updatedNames = [...names, name];
      setNames(updatedNames);
      socketRef.current?.send(
        JSON.stringify({ type: 'update_names', names: updatedNames })
      );
    }
    setAddNameInput('');
  };

  const handleDeleteName = (name: string) => {
    const updatedNames = names.filter((n) => n !== name);
    setNames(updatedNames);
    socketRef.current?.send(
      JSON.stringify({ type: 'update_names', names: updatedNames })
    );
  };

  const generateMagicLink = async () => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${sessionId}/magic-link`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${user?.access_token}`,
      },
    });
    if (response.ok) {
      const { url } = await response.json();
      setMagicLink(url);
      setOpenDialog(true);
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
          <Button color="inherit" onClick={generateMagicLink}>
            Share Link
          </Button>
        </Toolbar>
      </AppBar>
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
            disabled={isSpinning || names.length === 0}
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
