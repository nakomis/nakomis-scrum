import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, AppBar, Toolbar,
  Drawer, List, ListItemText, CircularProgress,
} from '@mui/material';
import ListItemButton from '@mui/material/ListItemButton';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [nameLists, setNameLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
          headers: { Authorization: `Bearer ${auth.user?.access_token}` },
        });
        setSessions(await response.json());
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      }
    };

    const fetchNameLists = async () => {
      try {
        const orgId = location.state?.orgId;
        if (!orgId) return;
        const response = await fetch(`${import.meta.env.VITE_API_URL}/orgs/${orgId}/name-lists`, {
          headers: { Authorization: `Bearer ${auth.user?.access_token}` },
        });
        setNameLists(await response.json());
      } catch (error) {
        console.error('Failed to fetch name lists:', error);
      }
    };

    fetchSessions();
    fetchNameLists();
    setLoading(false);
  }, [auth, location.state]);

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" anchor="left">
        <List>
          {nameLists.map((list) => (
            <ListItemButton key={list.id} onClick={() => navigate(`/admin/name-list/${list.id}`)}>
              <ListItemText primary={list.name} secondary={`Count: ${list.names.length}`} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Button variant="contained" onClick={async () => {
              const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${auth.user?.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: 'New Session' }),
              });
              if (res.ok) {
                const session = await res.json();
                navigate(`/admin/session/${session.sessionId}`);
              }
            }}>
              Create New Session
            </Button>
            <List>
              {sessions.map((session) => (
                <ListItemButton key={session.id} onClick={() => navigate(`/admin/session/${session.sessionId}`)}>
                  <ListItemText primary={`Session ID: ${session.sessionId}`} secondary={`Status: ${session.status}`} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Box>
    </Box>
  );
};

export default AdminDashboard;
