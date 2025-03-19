import { useState, createContext } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from './theme';
import Layout from './components/Layout';
import { useSettingsStore } from './store/settingsStore';
import './App.css';
import FontLoader from './components/FontLoader';

// 创建主题上下文
export const ThemeContext = createContext<{
  toggleTheme: () => void;
  mode: 'light' | 'dark';
}>({
  toggleTheme: () => {},
  mode: 'light',
});

function App() {
  const { appSettings, updateAppSettings } = useSettingsStore();
  const [mode, setMode] = useState<'light' | 'dark'>(appSettings.theme);

  // 切换主题
  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    updateAppSettings({ theme: newMode });
  };

  // 创建主题
  const theme = createAppTheme(mode, {
    primary: appSettings.primaryColor,
    secondary: appSettings.secondaryColor,
  }, appSettings.fontFamily);

  return (
    <>
      <FontLoader />
      <ThemeContext.Provider value={{ toggleTheme, mode }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Layout />
          </Router>
        </ThemeProvider>
      </ThemeContext.Provider>
    </>
  );
}

export default App;
