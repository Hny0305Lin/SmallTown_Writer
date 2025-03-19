import { useContext, useEffect } from 'react';
import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Switch, 
  FormControlLabel, 
  Divider, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Grid,
  Snackbar,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
  Paper,
  useTheme,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  TextField,
  Slider
} from '@mui/material';
import { 
  Save as SaveIcon, 
  ColorLens as ColorLensIcon, 
  Brightness4 as Brightness4Icon, 
  Brightness7 as Brightness7Icon,
  Code as CodeIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatListBulleted as FormatListBulletedIcon,
  AutoAwesome as AutoAwesomeIcon,
  TextFields as TextFieldsIcon
} from '@mui/icons-material';
import { ThemeContext } from '../../App';
import { useSettingsStore } from '../../store/settingsStore';
import { useNovelStore } from '../../store/novelStore';
import FontSettings from './FontSettings';

// 主题选项
const themeOptions = [
  { name: '默认粉', primary: '#EC407A', secondary: '#F48FB1' },
  { name: '清新绿', primary: '#66BB6A', secondary: '#81C784' },
  { name: '沉稳蓝', primary: '#42A5F5', secondary: '#64B5F6' },
  { name: '典雅紫', primary: '#AB47BC', secondary: '#BA68C8' },
];

export default function SettingsPage() {
  const theme = useTheme();
  const themeContext = useContext(ThemeContext);
  const { currentNovel } = useNovelStore();
  const { appSettings, novelSettings, updateAppSettings, getNovelSettings, updateNovelSettings } = useSettingsStore();
  
  // 全局设置状态
  const [globalAutoSave, setGlobalAutoSave] = useState(appSettings.defaultAutoSave);
  const [globalAutoSaveInterval, setGlobalAutoSaveInterval] = useState(appSettings.defaultAutoSaveInterval / 1000); // 转换为秒
  const [globalUseMarkdown, setGlobalUseMarkdown] = useState(appSettings.defaultUseMarkdown);
  
  // 当前小说设置状态
  const [novelAutoSave, setNovelAutoSave] = useState(true);
  const [novelAutoSaveInterval, setNovelAutoSaveInterval] = useState(5);
  const [novelUseMarkdown, setNovelUseMarkdown] = useState(false);
  const [hasNovelSpecificSettings, setHasNovelSpecificSettings] = useState(false);
  
  // 添加锁定状态
  const [autoSaveIntervalLocked, setAutoSaveIntervalLocked] = useState(false);
  
  const [openThemeDialog, setOpenThemeDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [selectedThemeTab, setSelectedThemeTab] = useState(themeContext.mode === 'dark' ? 1 : 0);

  // 初始化设置
  useEffect(() => {
    // 设置全局默认设置
    setGlobalAutoSave(appSettings.defaultAutoSave);
    setGlobalAutoSaveInterval(appSettings.defaultAutoSaveInterval / 1000);
    setGlobalUseMarkdown(appSettings.defaultUseMarkdown);
    
    // 如果有当前选择的小说，获取其设置
    if (currentNovel) {
      const settings = getNovelSettings(currentNovel.id);
      setNovelAutoSave(settings.autoSave);
      setNovelAutoSaveInterval(settings.autoSaveInterval / 1000);
      setNovelUseMarkdown(settings.useMarkdown);
      
      // 检查是否有特定于当前小说的设置
      const specificSettings = novelSettings.find(s => s.id === currentNovel.id);
      setHasNovelSpecificSettings(!!specificSettings);
      
      // 如果当前有打开的小说并且自动保存开启，则锁定自动保存时间设置
      setAutoSaveIntervalLocked(settings.autoSave);
    } else {
      // 如果没有当前小说，禁用小说特定设置
      setHasNovelSpecificSettings(false);
      // 没有打开文章，解除锁定
      setAutoSaveIntervalLocked(false);
    }
  }, [appSettings, currentNovel, getNovelSettings, novelSettings]);

  const handleThemeDialogOpen = () => {
    setOpenThemeDialog(true);
    setSelectedThemeTab(themeContext.mode === 'dark' ? 1 : 0);
  };

  const handleThemeDialogClose = () => {
    setOpenThemeDialog(false);
  };

  const handleSaveSettings = () => {
    // 保存全局设置
    updateAppSettings({
      defaultAutoSave: globalAutoSave,
      defaultAutoSaveInterval: globalAutoSaveInterval * 1000, // 转换为毫秒
      defaultUseMarkdown: globalUseMarkdown
    });
    
    // 如果有当前小说，保存小说特定设置
    if (currentNovel) {
      updateNovelSettings(currentNovel.id, {
        autoSave: novelAutoSave,
        autoSaveInterval: novelAutoSaveInterval * 1000, // 转换为毫秒
        useMarkdown: novelUseMarkdown
      });
    }
    
    setSnackbar({
      open: true,
      message: '设置已保存',
      severity: 'success'
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleThemeTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedThemeTab(newValue);
  };

  const applyTheme = (colorName: string, colors: { primary: string, secondary: string }) => {
    updateAppSettings({
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
    });
    setSnackbar({
      open: true,
      message: `已应用${colorName}主题`,
      severity: 'success'
    });
  };

  const resetNovelSettings = () => {
    if (currentNovel) {
      updateNovelSettings(currentNovel.id, {
        autoSave: appSettings.defaultAutoSave,
        autoSaveInterval: appSettings.defaultAutoSaveInterval,
        useMarkdown: appSettings.defaultUseMarkdown,
        fontSize: appSettings.defaultFontSize,
        fontFamily: appSettings.defaultFontFamily,
      });
    }
  };

  // 当全局设置变更时，联动更新当前小说设置
  const handleGlobalAutoSaveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setGlobalAutoSave(newValue);
    
    // 如果有当前小说，同步更新小说设置
    if (currentNovel) {
      setNovelAutoSave(newValue);
      
      // 如果开启了自动保存，则锁定自动保存时间设置
      setAutoSaveIntervalLocked(newValue);
    }
  };
  
  // 当全局自动保存间隔变更时，联动更新当前小说设置
  const handleGlobalAutoSaveIntervalChange = (e: any) => {
    const newValue = Number(e.target.value);
    setGlobalAutoSaveInterval(newValue);
    
    // 如果有当前小说，同步更新小说设置
    if (currentNovel) {
      setNovelAutoSaveInterval(newValue);
    }
  };
  
  // 当全局使用沉浸式编辑设置变更时，联动更新当前小说设置
  const handleGlobalUseMarkdownChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setGlobalUseMarkdown(newValue);
    
    // 如果有当前小说，同步更新小说设置
    if (currentNovel) {
      setNovelUseMarkdown(newValue);
    }
  };
  
  // 当小说自动保存设置变更时，更新锁定状态
  const handleNovelAutoSaveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setNovelAutoSave(newValue);
    
    // 如果开启了自动保存，则锁定自动保存时间设置
    setAutoSaveIntervalLocked(newValue);
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AutoAwesomeIcon sx={{ mr: 1 }} />
                <Typography variant="h6">主题设置</Typography>
              </Box>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={themeContext.mode === 'dark'}
                    onChange={themeContext.toggleTheme}
                  />
                }
                label="深色模式"
              />
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  主题颜色
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {themeOptions.map((option) => (
                    <Button
                      key={option.name}
                      variant="outlined"
                      onClick={() => applyTheme(option.name, {
                        primary: option.primary,
                        secondary: option.secondary,
                      })}
                      sx={{
                        minWidth: 100,
                        borderColor: option.primary,
                        color: option.primary,
                        '&:hover': {
                          borderColor: option.primary,
                          backgroundColor: `${option.primary}10`,
                        },
                      }}
                    >
                      {option.name}
                    </Button>
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TextFieldsIcon sx={{ mr: 1 }} />
                <Typography variant="h6">字体设置</Typography>
              </Box>
              <FontSettings />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AutoAwesomeIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">全局默认设置</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={globalAutoSave}
                      onChange={handleGlobalAutoSaveChange}
                      color="primary"
                    />
                  }
                  label="默认自动保存"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  启用后，所有小说将默认开启自动保存功能
                </Typography>
              </Box>
              
              {globalAutoSave && (
                <Box sx={{ mb: 3 }}>
                  <FormControl fullWidth variant="outlined" size="small" sx={{ mb: 1 }}>
                    <InputLabel id="global-autosave-interval-label">默认自动保存间隔</InputLabel>
                    <Select
                      labelId="global-autosave-interval-label"
                      value={globalAutoSaveInterval}
                      onChange={handleGlobalAutoSaveIntervalChange}
                      label="默认自动保存间隔"
                    >
                      <MenuItem value={2}>2 秒</MenuItem>
                      <MenuItem value={5}>5 秒</MenuItem>
                      <MenuItem value={10}>10 秒</MenuItem>
                      <MenuItem value={30}>30 秒</MenuItem>
                      <MenuItem value={60}>1 分钟</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="body2" color="text.secondary">
                    设置新小说的默认自动保存时间间隔
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={globalUseMarkdown}
                      onChange={handleGlobalUseMarkdownChange}
                      color="primary"
                    />
                  }
                  label="默认使用小说沉浸式编辑"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  启用后，所有新小说将默认使用沉浸式编辑模式
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {currentNovel && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Brightness4Icon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">当前小说 "{currentNovel.title}" 设置</Typography>
                  </Box>
                  {hasNovelSpecificSettings && (
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={resetNovelSettings}
                      sx={{ ml: 2 }}
                    >
                      重置为默认值
                    </Button>
                  )}
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={novelAutoSave}
                        onChange={handleNovelAutoSaveChange}
                        color="primary"
                      />
                    }
                    label="为此小说启用自动保存"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {novelAutoSave ? 
                      "系统将会自动保存此小说的编辑内容" : 
                      "禁用后，将不会自动保存此小说的内容"}
                  </Typography>
                </Box>
                
                {novelAutoSave && (
                  <Box sx={{ mb: 3 }}>
                    <FormControl fullWidth variant="outlined" size="small" sx={{ mb: 1 }}>
                      <InputLabel id="novel-autosave-interval-label">此小说自动保存间隔</InputLabel>
                      <Select
                        labelId="novel-autosave-interval-label"
                        value={novelAutoSaveInterval}
                        onChange={(e) => setNovelAutoSaveInterval(Number(e.target.value))}
                        label="此小说自动保存间隔"
                        disabled={autoSaveIntervalLocked}
                      >
                        <MenuItem value={2}>2 秒</MenuItem>
                        <MenuItem value={5}>5 秒</MenuItem>
                        <MenuItem value={10}>10 秒</MenuItem>
                        <MenuItem value={30}>30 秒</MenuItem>
                        <MenuItem value={60}>1 分钟</MenuItem>
                      </Select>
                    </FormControl>
                    <Typography variant="body2" color="text.secondary">
                      {autoSaveIntervalLocked ? 
                        "由于文章已打开，自动保存间隔已锁定" : 
                        (novelAutoSaveInterval === 2 ? 
                          "非常快的保存频率，适合协作模式" : 
                          (novelAutoSaveInterval <= 10 ? 
                            "中等保存频率，平衡性能和数据安全" : 
                            "较低的保存频率，减少系统资源占用"))}
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={novelUseMarkdown}
                        onChange={(e) => setNovelUseMarkdown(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="为此小说启用沉浸式编辑"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    启用后，此小说将使用沉浸式编辑体验，提供更专注的写作环境
                  </Typography>
                </Box>
                
                {novelUseMarkdown && (
                  <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                    
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button 
          variant="contained" 
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
          sx={{ 
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }}
        >
          保存全部设置
        </Button>
      </Box>

      <Dialog 
        open={openThemeDialog} 
        onClose={handleThemeDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>选择主题</DialogTitle>
        <DialogContent>
          <Tabs value={selectedThemeTab} onChange={handleThemeTabChange} sx={{ mb: 2 }}>
            <Tab 
              label="浅色主题" 
              icon={<Brightness7Icon />} 
              iconPosition="start"
              sx={{ color: selectedThemeTab === 0 ? 'primary.main' : 'text.secondary' }}
            />
            <Tab 
              label="深色主题" 
              icon={<Brightness4Icon />} 
              iconPosition="start"
              sx={{ color: selectedThemeTab === 1 ? 'primary.main' : 'text.secondary' }}
            />
          </Tabs>
          
          <Grid container spacing={2}>
            {themeOptions.map((color) => (
              <Grid item xs={6} sm={4} key={color.name}>
                <Card 
                  onClick={() => applyTheme(color.name, { primary: color.primary, secondary: color.secondary })}
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'scale(1.05)'
                    }
                  }}
                >
                  <Box sx={{ height: 100, bgcolor: color.primary }} />
                  <CardContent>
                    <Typography variant="subtitle1" align="center">
                      {color.name}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleThemeDialogClose}>取消</Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
} 