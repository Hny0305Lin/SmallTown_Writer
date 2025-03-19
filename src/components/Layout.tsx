import { useState, useEffect } from 'react';
import { Box, CssBaseline, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon, Home as HomeIcon, FaceRetouchingNatural as FaceRetouchingNaturalIcon, People as PeopleIcon, Settings as SettingsIcon, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import HomePage from './Home/HomePage';
import CharactersPage from './Characters/CharactersPage';
import FriendsPage from './Friends/FriendsPage';
import SettingsPage from './Settings/SettingsPage';
import CollaborationPage from './Collaboration/CollaborationPage';
import { useNovelStore } from '../store/novelStore';

const drawerWidth = 240;
const collapsedDrawerWidth = 64;

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentNovel } = useNovelStore();
  const theme = useTheme();
  
  // 检测是否为大屏PC且横屏
  const isLargeScreen = useMediaQuery('(min-width:1280px) and (orientation: landscape)');

  // 根据屏幕大小设置初始状态
  useEffect(() => {
    setDrawerOpen(isLargeScreen);
  }, [isLargeScreen]);

  const handleDrawerToggle = () => {
    if (!isLargeScreen) {
      setDrawerOpen(!drawerOpen);
    }
  };

  const menuItems = [
    { text: '我的小说', icon: <HomeIcon color="inherit" />, path: '/' },
    { text: '角色系统', icon: <FaceRetouchingNaturalIcon color="inherit" />, path: '/characters' },
    { text: '好友', icon: <PeopleIcon color="inherit" />, path: '/friends' },
    { text: '设置', icon: <SettingsIcon color="inherit" />, path: '/settings' },
  ];

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      <AppBar 
        position="fixed" 
        sx={{ 
          width: { 
            sm: isLargeScreen ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${drawerOpen ? drawerWidth : collapsedDrawerWidth}px)`
          },
          ml: { 
            sm: isLargeScreen ? `${drawerWidth}px` : `${drawerOpen ? drawerWidth : collapsedDrawerWidth}px`
          },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            {location.pathname === '/' ? '我的小说' : 
             location.pathname === '/characters' ? '角色系统' : 
             location.pathname === '/friends' ? '好友' : 
             location.pathname.startsWith('/collaborate/') ? `协作小说：${currentNovel?.title || '未命名小说'}` :
             '设置'}
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="permanent"
        sx={{
          width: isLargeScreen ? drawerWidth : (drawerOpen ? drawerWidth : collapsedDrawerWidth),
          flexShrink: 0,
          '& .MuiDrawer-paper': { 
            width: isLargeScreen ? drawerWidth : (drawerOpen ? drawerWidth : collapsedDrawerWidth),
            boxSizing: 'border-box',
            overflowX: 'hidden',
            transition: theme => !isLargeScreen ? theme.transitions.create('width', {
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.enteringScreen,
            }) : 'none',
            borderRight: 0,
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        }}
        open={drawerOpen}
      >
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: drawerOpen ? 'space-between' : 'center'
          }}>
            {drawerOpen && (
              <Typography variant="h6" noWrap component="div">
                小镇做题家
              </Typography>
            )}
            {!isLargeScreen && (
              <IconButton onClick={handleDrawerToggle}>
                {drawerOpen ? <ChevronLeft /> : <ChevronRight />}
              </IconButton>
            )}
          </Box>
          
          <List sx={{ flexGrow: 1, pt: 2 }}>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                <Tooltip title={!drawerOpen ? item.text : ''} placement="right">
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    selected={location.pathname === item.path}
                    sx={{
                      minHeight: 48,
                      justifyContent: drawerOpen ? 'initial' : 'center',
                      px: 2.5,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                        '& .MuiListItemIcon-root': {
                          color: 'inherit',
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: drawerOpen ? 3 : 'auto',
                        justifyContent: 'center',
                        color: location.pathname === item.path ? 'inherit' : 'primary.main',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text} 
                      sx={{ 
                        opacity: drawerOpen ? 1 : 0,
                        transition: theme => theme.transitions.create(['opacity', 'margin'], {
                          easing: theme.transitions.easing.sharp,
                          duration: theme.transitions.duration.standard,
                        }),
                      }} 
                    />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { 
            sm: isLargeScreen ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${drawerOpen ? drawerWidth : collapsedDrawerWidth}px)`
          },
          transition: theme => !isLargeScreen ? theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }) : 'none',
          ml: 0,
          mt: '64px',
          height: 'calc(100vh - 64px)',
          overflow: 'auto'
        }}
      >
        <Routes>
          <Route path="/" element={<HomePage isLargeScreen={isLargeScreen} />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/collaborate/:id" element={<CollaborationPage />} />
        </Routes>
      </Box>
    </Box>
  );
} 