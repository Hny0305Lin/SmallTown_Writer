import { useState } from 'react';
import { Box, List, ListItem, ListItemAvatar, ListItemText, Avatar, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Divider, Chip, Badge } from '@mui/material';
import { Add as AddIcon, PersonAdd as PersonAddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNovelStore, Friend } from '../../store/novelStore';

export default function FriendsPage() {
  const { friends, addFriend, updateFriend, deleteFriend } = useNovelStore();
  const [openDialog, setOpenDialog] = useState(false);
  const [friendData, setFriendData] = useState({
    name: '',
    online: false,
  });

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFriendData({
      name: '',
      online: false,
    });
  };

  const handleAddFriend = () => {
    if (friendData.name.trim() === '') return;
    
    addFriend({
      name: friendData.name,
      online: false,
    });
    
    handleCloseDialog();
  };

  const handleDeleteFriend = (id: string) => {
    deleteFriend(id);
  };

  const toggleOnlineStatus = (id: string, currentStatus: boolean) => {
    updateFriend(id, { online: !currentStatus });
  };

  const onlineFriends = friends.filter(friend => friend.online);
  const offlineFriends = friends.filter(friend => !friend.online);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Button 
          variant="contained" 
          startIcon={<PersonAddIcon />}
          onClick={handleOpenDialog}
        >
          添加好友
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          在线好友
          <Chip 
            label={onlineFriends.length} 
            color="success" 
            size="small" 
            sx={{ ml: 1 }} 
          />
        </Typography>
        {onlineFriends.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
            暂无在线好友
          </Typography>
        ) : (
          <List>
            {onlineFriends.map((friend) => (
              <ListItem
                key={friend.id}
                secondaryAction={
                  <Box>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleDeleteFriend(friend.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemAvatar>
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    color="success"
                  >
                    <Avatar 
                      src={friend.avatar || undefined}
                      onClick={() => toggleOnlineStatus(friend.id, friend.online)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {friend.name.charAt(0)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText 
                  primary={friend.name} 
                  secondary="在线" 
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          离线好友
          <Chip 
            label={offlineFriends.length} 
            color="default" 
            size="small" 
            sx={{ ml: 1 }} 
          />
        </Typography>
        {offlineFriends.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
            暂无离线好友
          </Typography>
        ) : (
          <List>
            {offlineFriends.map((friend) => (
              <ListItem
                key={friend.id}
                secondaryAction={
                  <Box>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleDeleteFriend(friend.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemAvatar>
                  <Avatar 
                    src={friend.avatar || undefined}
                    onClick={() => toggleOnlineStatus(friend.id, friend.online)}
                    sx={{ 
                      cursor: 'pointer',
                      filter: 'grayscale(100%)',
                    }}
                  >
                    {friend.name.charAt(0)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={friend.name} 
                  secondary="离线" 
                  primaryTypographyProps={{ 
                    sx: { color: 'text.secondary' } 
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>添加好友</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="好友名称"
            type="text"
            fullWidth
            variant="outlined"
            value={friendData.name}
            onChange={(e) => setFriendData({ ...friendData, name: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleAddFriend} variant="contained">添加</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 