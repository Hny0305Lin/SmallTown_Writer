import { createTheme, Theme } from '@mui/material/styles';

type PaletteMode = 'light' | 'dark';

// 浅色模式调色板
const lightPalette = {
  primary: {
    main: '#EC407A',
    light: '#F8BBD0',
    dark: '#C2185B',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#F48FB1',
    light: '#FFDDE5',
    dark: '#BF5F82',
    contrastText: '#1D192B',
  },
  background: {
    default: '#FFFBFE',
    paper: '#FFFBFE',
  },
  text: {
    primary: '#1C1B1F',
    secondary: '#49454F',
  },
};

// 深色模式调色板
const darkPalette = {
  primary: {
    main: '#D81B60',
    light: '#F06292',
    dark: '#AD1457',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#FF80AB',
    light: '#FFABC4',
    dark: '#C51162',
    contrastText: '#121212',
  },
  background: {
    default: '#121212',
    paper: '#1E1E1E',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
  },
};

// 创建主题函数
export const createAppTheme = (
  mode: PaletteMode = 'light', 
  customColors?: { primary?: string, secondary?: string },
  fontFamily?: string
): Theme => {
  // 选择基础调色板
  const basePalette = mode === 'light' ? { ...lightPalette } : { ...darkPalette };
  
  // 应用自定义颜色（如果提供）
  if (customColors) {
    if (customColors.primary) {
      basePalette.primary.main = customColors.primary;
    }
    if (customColors.secondary) {
      basePalette.secondary.main = customColors.secondary;
    }
  }
  
  return createTheme({
    palette: {
      mode,
      ...basePalette,
      error: {
        main: mode === 'light' ? '#B3261E' : '#CF6679',
      },
    },
    typography: {
      fontFamily: fontFamily || '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 500,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 500,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 500,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      button: {
        textTransform: 'none',
        // 不继承全局字体，保持UI一致性
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 100,
            padding: '10px 24px',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: mode === 'light' 
              ? '0px 1px 3px 0px rgba(0,0,0,0.12)'
              : '0px 1px 3px 0px rgba(0,0,0,0.5)',
          },
        },
      },
    },
  });
};

// 默认导出浅色主题
const theme = createAppTheme('light');
export default theme; 