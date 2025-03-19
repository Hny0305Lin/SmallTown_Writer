import { useState } from 'react';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  Typography, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField,
  IconButton,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  ViewCompact as ViewCompactIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import { useNovelStore, Novel } from '../../store/novelStore';

// 定义列表视图类型
type ViewType = 'vertical' | 'grid' | 'horizontal';

export default function NovelList() {
  const { novels, addNovel, selectNovel, deleteNovel, updateNovel } = useNovelStore();
  const [openDialog, setOpenDialog] = useState(false);
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [viewType, setViewType] = useState<ViewType>('horizontal');
  
  // 小说操作菜单相关状态
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [novelToDelete, setNovelToDelete] = useState<Novel | null>(null);

  // 打开创建小说对话框
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  // 关闭创建小说对话框
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewNovelTitle('');
  };

  // 创建新小说
  const handleCreateNovel = () => {
    if (newNovelTitle.trim() === '') return;
    
    // 生成唯一的etherpadId
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const padId = `novel_${timestamp}_${randomStr}`;
    
    // 使用新的addNovel方法创建小说
    const createdNovel = addNovel(newNovelTitle, '', padId);
    console.log("创建了新小说:", newNovelTitle, "协作ID:", padId);
    
    // 关闭对话框
    handleCloseDialog();
  };

  // 选择小说
  const handleSelectNovel = (novel: Novel) => {
    selectNovel(novel.id);
  };

  // 处理视图类型变更
  const handleViewTypeChange = (event: React.MouseEvent<HTMLElement>, newViewType: ViewType | null) => {
    if (newViewType !== null) {
      setViewType(newViewType);
    }
  };

  // 日期格式化
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 打开小说菜单
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, novelId: string) => {
    event.stopPropagation(); // 防止触发小说选择
    setAnchorEl(event.currentTarget);
    setSelectedNovelId(novelId);
  };
  
  // 关闭小说菜单
  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedNovelId(null);
  };
  
  // 置顶小说
  const handleMoveToTop = () => {
    if (!selectedNovelId) return;
    
    const topNovel = novels.find(n => n.id === selectedNovelId);
    if (!topNovel) return;
    
    // 更新小说的lastEdited字段为最新时间，使其排序在最前面
    updateNovel(selectedNovelId, { lastEdited: new Date() });
    handleCloseMenu();
  };
  
  // 置底小说
  const handleMoveToBottom = () => {
    if (!selectedNovelId) return;
    
    const bottomNovel = novels.find(n => n.id === selectedNovelId);
    if (!bottomNovel) return;
    
    // 查找最早的时间戳，并设置为比它还早
    let earliestTime = new Date();
    novels.forEach(novel => {
      const novelDate = novel.lastEdited instanceof Date ? novel.lastEdited : new Date(novel.lastEdited);
      if (novelDate < earliestTime) {
        earliestTime = novelDate;
      }
    });
    
    // 设置为比最早时间早一天
    const newDate = new Date(earliestTime);
    newDate.setDate(newDate.getDate() - 1);
    
    updateNovel(selectedNovelId, { lastEdited: newDate });
    handleCloseMenu();
  };
  
  // 确认删除小说
  const handleConfirmDeleteNovel = () => {
    if (!selectedNovelId) return;
    
    const novelToDelete = novels.find(n => n.id === selectedNovelId);
    if (!novelToDelete) return;
    
    setNovelToDelete(novelToDelete);
    setDeleteDialogOpen(true);
    handleCloseMenu();
  };
  
  // 执行删除小说
  const handleDeleteNovel = () => {
    if (novelToDelete) {
      deleteNovel(novelToDelete.id);
      setDeleteDialogOpen(false);
      setNovelToDelete(null);
    }
  };
  
  // 取消删除小说
  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setNovelToDelete(null);
  };
  
  // 下载小说为TXT文件
  const handleDownloadAsTxt = () => {
    if (!selectedNovelId) return;
    
    const novel = novels.find(n => n.id === selectedNovelId);
    if (!novel) return;
    
    // 创建TXT内容
    const txtContent = `${novel.title}\n\n${novel.content || ''}`;
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novel.title || '无标题小说'}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    handleCloseMenu();
  };

  // 根据当前视图类型渲染小说列表
  const renderNovelList = () => {
    // 首先过滤掉无效的小说对象
    const validNovels = novels.filter(novel => novel && typeof novel === 'object' && novel.id);
    
    // 如果没有小说，显示提示
    if (validNovels.length === 0) {
      return (
        <Box sx={{ width: '100%', textAlign: 'center', mt: 5 }}>
          <Typography variant="h6" color="text.secondary">
            您还没有创建任何小说，点击"创建新小说"按钮开始创作吧！
          </Typography>
        </Box>
      );
    }
    
    // 根据视图类型渲染
    switch (viewType) {
      case 'vertical':
        return (
          <Box sx={{ width: '100%' }}>
            {validNovels.map((novel) => (
              <Card 
                key={novel.id || `novel-${Math.random()}`}
                sx={{ 
                  mb: 2,
                  display: 'flex',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer'
                  }
                }}
                onClick={() => handleSelectNovel(novel)}
              >
                <CardMedia
                  component="div"
                  sx={{
                    width: 100,
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="none" />
                    <path d="M30,20 L70,20 C75,20 80,25 80,30 L80,70 C80,75 75,80 70,80 L30,80 C25,80 20,75 20,70 L20,30 C20,25 25,20 30,20 Z" stroke="#ccc" strokeWidth="2" fill="none" />
                    <path d="M35,30 L65,30 L65,40 L35,40 Z" fill="#ccc" />
                    <path d="M35,45 L65,45 L65,50 L35,50 Z" fill="#ccc" />
                    <path d="M35,55 L55,55 L55,60 L35,60 Z" fill="#ccc" />
                    <path d="M35,65 L50,65 L50,70 L35,70 Z" fill="#ccc" />
                  </svg>
                </CardMedia>
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <CardContent sx={{ flex: '1 0 auto' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" component="div">
                        {typeof novel.title === 'string' ? novel.title : '无标题'}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={(e) => handleOpenMenu(e, novel.id)}
                        sx={{ ml: 1 }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      上次编辑: {novel.lastEdited instanceof Date ? 
                        formatDate(novel.lastEdited) : 
                        (novel.lastEdited ? formatDate(new Date(novel.lastEdited)) : '未知时间')}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mt: 1,
                        maxHeight: '4.5em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {typeof novel.content === 'string' ? 
                        novel.content : 
                        '无内容'}
                    </Typography>
                  </CardContent>
                </Box>
              </Card>
            ))}
          </Box>
        );
        
      case 'horizontal':
        return (
          <Box sx={{ width: '100%' }}>
            {validNovels.map((novel) => (
              <Card 
                key={novel.id || `novel-${Math.random()}`}
                sx={{ 
                  mb: 2,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer'
                  }
                }}
                onClick={() => handleSelectNovel(novel)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography gutterBottom variant="h5" component="div">
                      {typeof novel.title === 'string' ? novel.title : '无标题'}
                    </Typography>
                    <IconButton 
                      size="small" 
                      onClick={(e) => handleOpenMenu(e, novel.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    上次编辑: {novel.lastEdited instanceof Date ? 
                      formatDate(novel.lastEdited) : 
                      (novel.lastEdited ? formatDate(new Date(novel.lastEdited)) : '未知时间')}
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      mt: 2, 
                      mb: 2,
                      maxHeight: '6em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {typeof novel.content === 'string' ? 
                      (novel.content.length > 0 ? novel.content : '暂无内容') : 
                      '无内容'}
                  </Typography>
                  {novel.collaborationActive && (
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                      协作模式已开启
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        );
        
      case 'grid':
      default:
        return (
          <Grid container spacing={3}>
            {validNovels.map((novel) => (
              <Grid item xs={12} sm={6} md={4} key={novel.id || `novel-${Math.random()}`}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                      cursor: 'pointer'
                    },
                    position: 'relative'
                  }}
                  onClick={() => handleSelectNovel(novel)}
                >
                  <CardMedia
                    component="div"
                    sx={{
                      height: 140,
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <rect width="100" height="100" fill="none" />
                      <path d="M30,20 L70,20 C75,20 80,25 80,30 L80,70 C80,75 75,80 70,80 L30,80 C25,80 20,75 20,70 L20,30 C20,25 25,20 30,20 Z" stroke="#ccc" strokeWidth="2" fill="none" />
                      <path d="M35,30 L65,30 L65,40 L35,40 Z" fill="#ccc" />
                      <path d="M35,45 L65,45 L65,50 L35,50 Z" fill="#ccc" />
                      <path d="M35,55 L55,55 L55,60 L35,60 Z" fill="#ccc" />
                      <path d="M35,65 L50,65 L50,70 L35,70 Z" fill="#ccc" />
                    </svg>
                  </CardMedia>
                  <Box sx={{ position: 'absolute', top: 0, right: 0, p: 1 }}>
                    <IconButton 
                      size="small" 
                      onClick={(e) => handleOpenMenu(e, novel.id)}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.7)', 
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } 
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h5" component="div">
                      {typeof novel.title === 'string' ? novel.title : '无标题'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      上次编辑: {novel.lastEdited instanceof Date ? 
                        formatDate(novel.lastEdited) : 
                        (novel.lastEdited ? formatDate(new Date(novel.lastEdited)) : '未知时间')}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mt: 1,
                        maxHeight: '4.5em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {typeof novel.content === 'string' ? 
                        novel.content : 
                        '无内容'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        );
    }
  };

  return (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3 
      }}>
        <ToggleButtonGroup
          value={viewType}
          exclusive
          onChange={handleViewTypeChange}
          aria-label="文章列表视图"
          size="small"
        >
          <ToggleButton value="horizontal" aria-label="横排详情">
            <Tooltip title="横排详情">
              <ViewCompactIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="vertical" aria-label="竖排列表">
            <Tooltip title="竖排列表">
              <ViewListIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="grid" aria-label="网格视图">
            <Tooltip title="网格视图">
              <ViewModuleIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          创建新小说
        </Button>
      </Box>

      {renderNovelList()}

      {/* 小说菜单 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        <MenuItem onClick={handleMoveToTop}>
          <KeyboardArrowUpIcon fontSize="small" sx={{ mr: 1 }} />
          置顶
        </MenuItem>
        <MenuItem onClick={handleMoveToBottom}>
          <KeyboardArrowDownIcon fontSize="small" sx={{ mr: 1 }} />
          置底
        </MenuItem>
        <MenuItem onClick={handleDownloadAsTxt}>
          <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />
          下载TXT
        </MenuItem>
        <MenuItem onClick={handleConfirmDeleteNovel} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          删除
        </MenuItem>
      </Menu>

      {/* 创建新小说对话框 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>创建新小说</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="小说标题"
            type="text"
            fullWidth
            variant="outlined"
            value={newNovelTitle}
            onChange={(e) => setNewNovelTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleCreateNovel} variant="contained">创建</Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">确认删除小说</DialogTitle>
        <DialogContent>
          <Typography>
            您确定要删除小说 "{novelToDelete?.title}" 吗？此操作不可撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>取消</Button>
          <Button onClick={handleDeleteNovel} color="error" autoFocus>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 