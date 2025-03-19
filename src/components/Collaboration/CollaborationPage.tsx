import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNovelStore } from '../../store/novelStore';
import NovelEditor from '../Home/NovelEditor';

export default function CollaborationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { novels, currentNovel, selectNovel } = useNovelStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 处理日期对象
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

  useEffect(() => {
    if (!id) {
      setError('无效的协作链接');
      setLoading(false);
      return;
    }

    console.log("尝试查找小说，ID:", id);
    console.log("当前小说列表:", novels.map(n => ({ 
      id: n.id, 
      title: n.title,
      etherpadId: n.etherpadId 
    })));

    // 不再尝试提取小说ID，直接用完整的ID去匹配
    // 在小说列表中查找匹配的小说 - 检查etherpadId
    const novel = novels.find(n => n.etherpadId === id);

    if (novel) {
      console.log("找到匹配的小说:", novel.title);
      // 设置当前小说
      selectNovel(novel.id);
      setLoading(false);
    } else {
      console.log("找不到匹配的小说，协作ID:", id);
      console.log("现有小说:", novels.map(n => ({ 
        id: n.id, 
        title: n.title,
        etherpadId: n.etherpadId
      })));
      
      // 延迟一下再次尝试，可能数据还在加载中
      setTimeout(() => {
        const novelAgain = useNovelStore.getState().novels.find(n => n.etherpadId === id);
        if (novelAgain) {
          console.log("第二次尝试找到匹配的小说:", novelAgain.title);
          useNovelStore.getState().selectNovel(novelAgain.id);
          setLoading(false);
        } else {
          setError('找不到对应的小说');
          setLoading(false);
        }
      }, 1000);
    }
  }, [id, novels, selectNovel]);

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Typography variant="h5" color="error" gutterBottom>
          {error}
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          返回首页
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* 使用NovelEditor组件，携带自动开启协作模式的标识 */}
      <NovelEditor autoCollaboration={true} />
    </Box>
  );
} 