import { useState } from 'react';
import { Box, Grid, Card, CardContent, CardMedia, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Fab, Avatar } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNovelStore, Character } from '../../store/novelStore';

export default function CharactersPage() {
  const { novels, characters, addCharacter, updateCharacter, deleteCharacter } = useNovelStore();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [characterData, setCharacterData] = useState({
    name: '',
    description: '',
    novelId: '',
  });

  const handleOpenDialog = (character?: Character) => {
    if (character) {
      setEditingCharacter(character);
      setCharacterData({
        name: character.name,
        description: character.description,
        novelId: character.novelId,
      });
    } else {
      setEditingCharacter(null);
      setCharacterData({
        name: '',
        description: '',
        novelId: novels.length > 0 ? novels[0].id : '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCharacter(null);
    setCharacterData({
      name: '',
      description: '',
      novelId: novels.length > 0 ? novels[0].id : '',
    });
  };

  const handleSaveCharacter = () => {
    if (characterData.name.trim() === '' || characterData.novelId === '') return;
    
    if (editingCharacter) {
      updateCharacter(editingCharacter.id, characterData);
    } else {
      addCharacter(characterData);
    }
    
    handleCloseDialog();
  };

  const handleDeleteCharacter = (id: string) => {
    deleteCharacter(id);
  };

  const getNovelTitle = (novelId: string) => {
    const novel = novels.find(n => n.id === novelId);
    return novel ? novel.title : '未知小说';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={novels.length === 0}
        >
          创建新角色
        </Button>
      </Box>

      {novels.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Typography variant="h6" color="text.secondary">
            请先创建一部小说，然后再添加角色
          </Typography>
        </Box>
      ) : characters.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Typography variant="h6" color="text.secondary">
            您还没有创建任何角色，点击"创建新角色"按钮开始设计吧！
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {characters.map((character) => (
            <Grid item xs={12} sm={6} md={4} key={character.id}>
              <Card sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                  <IconButton 
                    size="small" 
                    sx={{ mr: 1, bgcolor: 'background.paper' }}
                    onClick={() => handleOpenDialog(character)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    sx={{ bgcolor: 'background.paper' }}
                    onClick={() => handleDeleteCharacter(character.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', p: 2 }}>
                  <Avatar
                    sx={{ width: 80, height: 80, mr: 2 }}
                    src={character.avatar || undefined}
                  >
                    {character.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h5" component="div">
                      {character.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      所属小说: {getNovelTitle(character.novelId)}
                    </Typography>
                    <Typography variant="body2">
                      {character.description}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCharacter ? '编辑角色' : '创建新角色'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="角色名称"
            type="text"
            fullWidth
            variant="outlined"
            value={characterData.name}
            onChange={(e) => setCharacterData({ ...characterData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            margin="dense"
            label="所属小说"
            fullWidth
            variant="outlined"
            value={characterData.novelId}
            onChange={(e) => setCharacterData({ ...characterData, novelId: e.target.value })}
            sx={{ mb: 2 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="" disabled>选择小说</option>
            {novels.map((novel) => (
              <option key={novel.id} value={novel.id}>
                {novel.title}
              </option>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="角色描述"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={characterData.description}
            onChange={(e) => setCharacterData({ ...characterData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSaveCharacter} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      <Fab 
        color="primary" 
        aria-label="add" 
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => handleOpenDialog()}
        disabled={novels.length === 0}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
} 