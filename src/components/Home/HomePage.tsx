import { Box, Grid } from '@mui/material';
import { useEffect, useState } from 'react';
import NovelList from './NovelList';
import NovelEditor from './NovelEditor';
import { useNovelStore } from '../../store/novelStore';

interface HomePageProps {
  isLargeScreen: boolean;
}

export default function HomePage({ isLargeScreen }: HomePageProps) {
  const { currentNovel, novels } = useNovelStore();
  const [showSidebar, setShowSidebar] = useState(true);
  
  // 自动选择上次编辑的小说（如果有）
  useEffect(() => {
    if (!currentNovel && novels.length > 0) {
      // 如果有协作模式活跃的小说，优先选择它
      const activeNovel = novels.find(novel => novel.collaborationActive);
      if (activeNovel) {
        useNovelStore.getState().selectNovel(activeNovel.id);
        return;
      }
      
      // 否则选择上次编辑的小说
      const sortedNovels = [...novels].sort((a, b) => {
        return new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime();
      });
      
      if (sortedNovels[0]) {
        useNovelStore.getState().selectNovel(sortedNovels[0].id);
      }
    }
  }, [currentNovel, novels]);

  // 确保日期对象正确加载
  useEffect(() => {
    // 检查novels数组中的lastEdited是否是Date对象
    novels.forEach(novel => {
      if (!(novel.lastEdited instanceof Date)) {
        console.log("修复小说日期:", novel.title);
        // 通过重新设置lastEdited来修复日期类型
        const fixedDate = new Date(novel.lastEdited);
        useNovelStore.getState().updateNovel(novel.id, {
          lastEdited: fixedDate
        });
      }
    });
  }, [novels]);

  // 根据屏幕大小设置初始状态
  useEffect(() => {
    setShowSidebar(isLargeScreen);
  }, [isLargeScreen]);

  // 切换侧边栏的函数
  const toggleSidebar = () => {
    if (!isLargeScreen) {
      setShowSidebar(prev => !prev);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={3}>
        {(!currentNovel || showSidebar) && (
          <Grid item xs={12} md={currentNovel ? 4 : 12}>
            <NovelList />
          </Grid>
        )}
        {currentNovel && (
          <Grid item xs={12} md={showSidebar ? 8 : 12}>
            <NovelEditor 
              toggleSidebar={!isLargeScreen ? toggleSidebar : undefined} 
              sidebarVisible={showSidebar}
              autoCollaboration={currentNovel.collaborationActive || false}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
} 