import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, AppBar, Box, Button, CircularProgress, IconButton, List, ListItem,
  Skeleton, Stack, TextField, Toolbar, Typography,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import ErrorAlert from '../components/ErrorAlert';

interface NameList {
  listId: string;
  name: string;
  names: string[];
}

// Each row carries a stable key so text fields keep focus and state when rows move.
interface Row {
  key: number;
  value: string;
}

// Returns an error per row (or null), checking blanks and exact duplicates after trimming.
const validateNames = (values: string[]): (string | null)[] => {
  const trimmed = values.map((v) => v.trim());
  return trimmed.map((name, i) => {
    if (!name) return 'Name cannot be blank';
    if (trimmed.indexOf(name) !== i) return 'Duplicate name';
    return null;
  });
};

const NameListEditorPage: React.FC = () => {
  const { orgId, listId } = useParams<{ orgId: string; listId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const accessToken = auth.user?.access_token;
  // Read the token through a ref so a silent renewal doesn't trigger a refetch.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const isSignedIn = !!accessToken;
  const nextKey = useRef(0);

  const [list, setList] = useState<NameList | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toRows = (names: string[]): Row[] => names.map((value) => ({ key: nextKey.current++, value }));

  const fetchList = useCallback(async () => {
    if (!orgId || !listId || !isSignedIn) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/orgs/${orgId}/name-lists`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const lists: NameList[] = await response.json();
      const found = lists.find((l) => l.listId === listId);
      if (!found) {
        setLoadError('Name list not found.');
        return;
      }
      setList(found);
      setRows(toRows(found.names ?? []));
    } catch (error) {
      console.error('Failed to fetch name list:', error);
      setLoadError('Could not load the name list.');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, orgId, listId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const values = rows.map((r) => r.value);
  const errors = validateNames(values);
  const hasErrors = errors.some(Boolean);
  const trimmedValues = values.map((v) => v.trim());
  const isDirty = !!list && JSON.stringify(trimmedValues) !== JSON.stringify(list.names ?? []);
  const newNameTrimmed = newName.trim();
  const canAdd = !!newNameTrimmed && !trimmedValues.includes(newNameTrimmed);

  const edit = (changes: Row[]) => {
    setRows(changes);
    setSaved(false);
    setSaveError(null);
  };

  const updateRow = (key: number, value: string) =>
    edit(rows.map((r) => (r.key === key ? { ...r, value } : r)));

  const removeRow = (key: number) => edit(rows.filter((r) => r.key !== key));

  const moveRow = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    edit(reordered);
  };

  const addName = () => {
    if (!canAdd) return;
    edit([...rows, { key: nextKey.current++, value: newNameTrimmed }]);
    setNewName('');
  };

  const reset = () => {
    if (!list) return;
    edit(toRows(list.names ?? []));
    setNewName('');
  };

  const save = async () => {
    if (!list || hasErrors) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/orgs/${orgId}/name-lists/${listId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ names: trimmedValues }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setList({ ...list, names: trimmedValues });
      setRows(toRows(trimmedValues));
      setSaved(true);
    } catch (error) {
      console.error('Failed to save name list:', error);
      setSaveError('Could not save the name list.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {list ? `Edit: ${list.name}` : 'Edit name list'}
          </Typography>
          <Button color="inherit" onClick={() => navigate('/admin', { state: { orgId } })}>
            Back to dashboard
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 3, maxWidth: 600 }}>
        {!isSignedIn && !auth.isLoading && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={(
              <Button color="inherit" size="small" onClick={() => void auth.signinRedirect()}>
                Sign in
              </Button>
            )}
          >
            You are signed out. Sign in to edit this name list.
          </Alert>
        )}
        {loadError && <ErrorAlert message={loadError} onRetry={fetchList} />}
        {loading && !list ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={56} />)
        ) : list && (
          <>
            <List>
              {rows.map((row, index) => (
                <ListItem key={row.key} disableGutters>
                  <TextField
                    fullWidth
                    size="small"
                    value={row.value}
                    onChange={(e) => updateRow(row.key, e.target.value)}
                    error={!!errors[index]}
                    helperText={errors[index] ?? undefined}
                    slotProps={{ htmlInput: { 'aria-label': `Name ${index + 1}` } }}
                  />
                  <IconButton aria-label="Move up" onClick={() => moveRow(index, -1)} disabled={index === 0}>
                    <ArrowUpwardIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Move down"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === rows.length - 1}
                  >
                    <ArrowDownwardIcon />
                  </IconButton>
                  <IconButton aria-label="Remove" onClick={() => removeRow(row.key)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Add a name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addName();
                }}
                error={!!newNameTrimmed && !canAdd}
                helperText={newNameTrimmed && !canAdd ? 'Duplicate name' : undefined}
              />
              <Button variant="outlined" onClick={addName} disabled={!canAdd}>
                Add
              </Button>
            </Stack>
            {saveError && <ErrorAlert message={saveError} onRetry={save} />}
            {saved && !isDirty && <Alert severity="success" sx={{ mb: 2 }}>Saved.</Alert>}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={save}
                disabled={!isDirty || hasErrors || saving || !isSignedIn}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                Save
              </Button>
              <Button onClick={reset} disabled={!isDirty || saving}>
                Cancel
              </Button>
            </Stack>
          </>
        )}
      </Box>
    </Box>
  );
};

export default NameListEditorPage;
