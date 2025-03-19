import { FormControl, InputLabel, Select, MenuItem, Typography, Box } from '@mui/material';
import { useNovelStore } from '../../store/novelStore';
import { useSettingsStore, FontFamily } from '../../store/settingsStore';

const fontOptions: { value: FontFamily; label: string }[] = [
  { value: 'system-ui', label: '系统默认字体' },
  { value: 'LXGWNeoXiHei', label: '霞鹜新晰黑体' },
  { value: 'MiSans', label: 'MiSans' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Quicksand', label: 'Quicksand' },
];

export default function FontSettings() {
  const { currentNovel } = useNovelStore();
  const { getNovelSettings, updateNovelSettings, appSettings, updateAppSettings } = useSettingsStore();
  
  // 获取当前小说的设置
  const novelSettings = currentNovel ? getNovelSettings(currentNovel.id) : null;
  
  // 处理全局字体变更
  const handleGlobalFontChange = (value: FontFamily) => {
    updateAppSettings({
      fontFamily: value,
      defaultFontFamily: value,
    });
  };
  
  // 处理当前小说字体变更
  const handleNovelFontChange = (value: FontFamily) => {
    if (currentNovel) {
      updateNovelSettings(currentNovel.id, {
        fontFamily: value,
      });
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        字体设置
      </Typography>
      
      {/* 全局默认字体 */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="global-font-label">默认字体</InputLabel>
        <Select
          labelId="global-font-label"
          value={appSettings.fontFamily}
          label="默认字体"
          onChange={(e) => handleGlobalFontChange(e.target.value as FontFamily)}
        >
          {fontOptions.map((option) => (
            <MenuItem 
              key={option.value} 
              value={option.value}
              sx={{ fontFamily: option.value }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* 当前小说字体 */}
      {currentNovel && (
        <FormControl fullWidth>
          <InputLabel id="novel-font-label">当前小说字体</InputLabel>
          <Select
            labelId="novel-font-label"
            value={novelSettings?.fontFamily || appSettings.fontFamily}
            label="当前小说字体"
            onChange={(e) => handleNovelFontChange(e.target.value as FontFamily)}
          >
            {fontOptions.map((option) => (
              <MenuItem 
                key={option.value} 
                value={option.value}
                sx={{ fontFamily: option.value }}
              >
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      
      {/* 预览文本 */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="body1" sx={{ 
          fontFamily: novelSettings?.fontFamily || appSettings.fontFamily,
          mb: 1
        }}>
          预览文本 / Preview Text / 123
        </Typography>
        <Typography variant="body2" color="text.secondary">
          当前字体：{novelSettings?.fontFamily || appSettings.fontFamily}
        </Typography>
      </Box>
    </Box>
  );
} 