import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Novel {
  id: string;
  title: string;
  coverImage?: string;
  createdAt: Date;
  lastEdited: Date;
  content: string;
  etherpadId?: string;
  collaborationActive?: boolean;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  novelId: string;
  avatar?: string;
}

export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  online: boolean;
}

interface NovelState {
  novels: Novel[];
  characters: Character[];
  friends: Friend[];
  currentNovel: Novel | null;
  
  // 小说操作
  addNovel: (title: string, content?: string, etherpadId?: string) => Novel;
  updateNovel: (id: string, updates: Partial<Novel>) => void;
  deleteNovel: (id: string) => void;
  selectNovel: (id: string) => void;
  deselectNovel: () => void;
  setCollaborationActive: (id: string, active: boolean) => void;
  
  // 角色操作
  addCharacter: (character: Omit<Character, 'id'>) => void;
  updateCharacter: (id: string, characterData: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  
  // 好友操作
  addFriend: (friend: Omit<Friend, 'id'>) => void;
  updateFriend: (id: string, friendData: Partial<Friend>) => void;
  deleteFriend: (id: string) => void;
}

// 生成唯一ID的辅助函数
const generateId = () => Math.random().toString(36).substring(2, 9);

// 日期序列化和反序列化
const dateReviver = (key: string, value: any) => {
  if (key === 'lastEdited' && typeof value === 'string') {
    return new Date(value);
  }
  return value;
};

// 初始化空数组，实际使用时会从localStorage加载
const getInitialNovels = (): Novel[] => {
  try {
    const storedNovels = localStorage.getItem('novels');
    if (storedNovels) {
      // 转换日期字符串为Date对象
      const parsedNovels = JSON.parse(storedNovels);
      return parsedNovels.map((novel: any) => ({
        ...novel,
        createdAt: new Date(novel.createdAt),
        lastEdited: new Date(novel.lastEdited)
      }));
    }
  } catch (error) {
    console.error('加载小说数据出错:', error);
  }
  return [];
};

export const useNovelStore = create<NovelState>()(
  persist(
    (set, get) => ({
      novels: getInitialNovels(),
      characters: [],
      friends: [],
      currentNovel: null,
      
      // 小说操作
      addNovel: (title, content = '', etherpadId) => {
        const newNovel: Novel = {
          id: uuidv4(),
          title,
          content,
          createdAt: new Date(),
          lastEdited: new Date(),
          etherpadId
        };
        
        set(state => {
          const updatedNovels = [...state.novels, newNovel];
          // 保存到localStorage
          localStorage.setItem('novels', JSON.stringify(updatedNovels));
          return { novels: updatedNovels, currentNovel: newNovel };
        });
        
        return newNovel;
      },
      
      updateNovel: (id, updates) => {
        set(state => {
          const updatedNovels = state.novels.map(novel => 
            novel.id === id ? { ...novel, ...updates, lastEdited: new Date() } : novel
          );
          
          // 如果正在更新的小说是当前选中的小说，也更新currentNovel
          const updatedCurrentNovel = state.currentNovel && state.currentNovel.id === id
            ? { ...state.currentNovel, ...updates, lastEdited: new Date() }
            : state.currentNovel;
          
          // 保存到localStorage
          localStorage.setItem('novels', JSON.stringify(updatedNovels));
          
          return { 
            novels: updatedNovels,
            currentNovel: updatedCurrentNovel
          };
        });
      },
      
      deleteNovel: (id) => {
        set(state => {
          const updatedNovels = state.novels.filter(novel => novel.id !== id);
          // 保存到localStorage
          localStorage.setItem('novels', JSON.stringify(updatedNovels));
          // 如果删除的是当前选中的小说，取消选中
          return { 
            novels: updatedNovels,
            currentNovel: state.currentNovel && state.currentNovel.id === id ? null : state.currentNovel
          };
        });
      },
      
      selectNovel: (id) => {
        set(state => {
          const selectedNovel = state.novels.find(novel => novel.id === id) || null;
          return { currentNovel: selectedNovel };
        });
      },
      
      deselectNovel: () => {
        set({ currentNovel: null });
      },
      
      // 添加设置协作状态的方法
      setCollaborationActive: (id, active) => {
        set(state => {
          const updatedNovels = state.novels.map(novel => 
            novel.id === id ? { ...novel, collaborationActive: active } : novel
          );
          
          // 如果正在更新的小说是当前选中的小说，也更新currentNovel
          const updatedCurrentNovel = state.currentNovel && state.currentNovel.id === id
            ? { ...state.currentNovel, collaborationActive: active }
            : state.currentNovel;
          
          // 保存到localStorage
          localStorage.setItem('novels', JSON.stringify(updatedNovels));
          
          return { 
            novels: updatedNovels,
            currentNovel: updatedCurrentNovel
          };
        });
      },
      
      // 角色操作
      addCharacter: (characterData) => set((state) => ({
        characters: [...state.characters, { ...characterData, id: generateId() }]
      })),
      
      updateCharacter: (id, characterData) => set((state) => ({
        characters: state.characters.map(character => 
          character.id === id ? { ...character, ...characterData } : character
        )
      })),
      
      deleteCharacter: (id) => set((state) => ({
        characters: state.characters.filter(character => character.id !== id)
      })),
      
      // 好友操作
      addFriend: (friendData) => set((state) => ({
        friends: [...state.friends, { ...friendData, id: generateId() }]
      })),
      
      updateFriend: (id, friendData) => set((state) => ({
        friends: state.friends.map(friend => 
          friend.id === id ? { ...friend, ...friendData } : friend
        )
      })),
      
      deleteFriend: (id) => set((state) => ({
        friends: state.friends.filter(friend => friend.id !== id)
      })),
    }),
    {
      name: 'smalltown-writer-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        novels: state.novels,
        characters: state.characters,
        friends: state.friends,
        // 不需要持久化currentNovel
      }),
    }
  )
); 