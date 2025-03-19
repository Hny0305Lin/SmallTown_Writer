import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 字体选项
export type FontFamily = 'MiSans' | 'Roboto' | 'Quicksand' | 'system-ui' | 'LXGWNeoXiHei';

// 每个小说的设置
export interface NovelSettings {
  id: string;
  autoSave: boolean;
  autoSaveInterval: number; // 单位：毫秒
  useMarkdown: boolean;
  fontSize?: number;
  fontFamily?: FontFamily;
}

// 全局设置
export interface AppSettings {
  theme: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
  defaultAutoSave: boolean;
  defaultAutoSaveInterval: number; // 单位：毫秒
  defaultUseMarkdown: boolean;
  fontSize: number;
  defaultFontSize?: number;
  fontFamily: FontFamily;
  defaultFontFamily: FontFamily;
}

// 设置存储的状态
interface SettingsState {
  // 全局设置
  appSettings: AppSettings;
  
  // 每个小说的特定设置
  novelSettings: NovelSettings[];
  
  // 更新全局设置
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  
  // 获取特定小说的设置
  getNovelSettings: (novelId: string) => NovelSettings;
  
  // 更新特定小说的设置
  updateNovelSettings: (novelId: string, settings: Partial<Omit<NovelSettings, 'id'>>) => void;
}

// 默认设置
const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  primaryColor: '#6750A4',
  secondaryColor: '#CCC2DC',
  defaultAutoSave: true,
  defaultAutoSaveInterval: 10000, // 10秒
  defaultUseMarkdown: false,
  fontSize: 16,
  defaultFontSize: 16,
  fontFamily: 'system-ui',
  defaultFontFamily: 'system-ui',
};

// 使用Zustand创建设置存储
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // 初始全局设置
      appSettings: DEFAULT_APP_SETTINGS,
      
      // 初始小说设置列表
      novelSettings: [],
      
      // 更新全局设置
      updateAppSettings: (settings) => {
        set((state) => ({
          appSettings: {
            ...state.appSettings,
            ...settings
          }
        }));
      },
      
      // 获取特定小说的设置，如果不存在则使用默认设置
      getNovelSettings: (novelId) => {
        const { novelSettings, appSettings } = get();
        const existingSettings = novelSettings.find(s => s.id === novelId);
        
        if (existingSettings) {
          return existingSettings;
        }
        
        // 如果不存在，创建默认设置
        const defaultNovelSettings: NovelSettings = {
          id: novelId,
          autoSave: appSettings.defaultAutoSave,
          autoSaveInterval: appSettings.defaultAutoSaveInterval,
          useMarkdown: appSettings.defaultUseMarkdown,
          fontSize: appSettings.defaultFontSize || appSettings.fontSize,
          fontFamily: appSettings.defaultFontFamily,
        };
        
        // 保存新设置
        set((state) => ({
          novelSettings: [...state.novelSettings, defaultNovelSettings]
        }));
        
        return defaultNovelSettings;
      },
      
      // 更新特定小说的设置
      updateNovelSettings: (novelId, settings) => {
        set((state) => {
          const existingSettingsIndex = state.novelSettings.findIndex(s => s.id === novelId);
          
          if (existingSettingsIndex >= 0) {
            // 更新现有设置
            const updatedSettings = [...state.novelSettings];
            updatedSettings[existingSettingsIndex] = {
              ...updatedSettings[existingSettingsIndex],
              ...settings
            };
            
            return { novelSettings: updatedSettings };
          } else {
            // 创建新设置
            const newSettings: NovelSettings = {
              id: novelId,
              autoSave: state.appSettings.defaultAutoSave,
              autoSaveInterval: state.appSettings.defaultAutoSaveInterval,
              useMarkdown: state.appSettings.defaultUseMarkdown,
              fontSize: state.appSettings.defaultFontSize || state.appSettings.fontSize,
              fontFamily: state.appSettings.defaultFontFamily,
              ...settings
            };
            
            return {
              novelSettings: [...state.novelSettings, newSettings]
            };
          }
        });
      }
    }),
    {
      name: 'smalltown-writer-settings',
      partialize: (state) => ({
        appSettings: state.appSettings,
        novelSettings: state.novelSettings,
      }),
    }
  )
); 