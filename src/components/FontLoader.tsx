import { useEffect } from 'react';
import { Global } from '@emotion/react';

// 字体文件路径配置
const fontFiles = {
  'LXGWNeoXiHei': [
    {
      path: '/fonts/LXGWNeoXiHei.ttf',
      weight: 400,
      style: 'normal',
    }
  ],
  'MiSans': [
    {
      path: '/fonts/MiSans-Regular.ttf',
      weight: 400,
      style: 'normal',
    },
    {
      path: '/fonts/MiSans-Medium.ttf',
      weight: 500,
      style: 'normal',
    },
    {
      path: '/fonts/MiSans-Bold.ttf',
      weight: 700,
      style: 'normal',
    },
  ],
  'Roboto': [
    {
      path: '/fonts/Roboto-Regular.ttf',
      weight: 400,
      style: 'normal',
    },
    {
      path: '/fonts/Roboto-Medium.ttf',
      weight: 500,
      style: 'normal',
    },
    {
      path: '/fonts/Roboto-Bold.ttf',
      weight: 700,
      style: 'normal',
    },
  ],
  'Quicksand': [
    {
      path: '/fonts/Quicksand-Regular.ttf',
      weight: 400,
      style: 'normal',
    },
    {
      path: '/fonts/Quicksand-Medium.ttf',
      weight: 500,
      style: 'normal',
    },
    {
      path: '/fonts/Quicksand-Bold.ttf',
      weight: 700,
      style: 'normal',
    },
  ],
};

// 生成@font-face CSS
const generateFontFaces = () => {
  return Object.entries(fontFiles).map(([fontFamily, files]) =>
    files.map(({ path, weight, style }) => `
      @font-face {
        font-family: '${fontFamily}';
        src: url('${path}') format('truetype');
        font-weight: ${weight};
        font-style: ${style};
        font-display: swap;
      }
    `).join('\n')
  ).join('\n');
};

export default function FontLoader() {
  useEffect(() => {
    // 预加载字体文件
    Object.values(fontFiles).flat().forEach(({ path }) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/ttf';
      link.href = path;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }, []);

  return (
    <Global
      styles={`
        ${generateFontFaces()}
      `}
    />
  );
} 