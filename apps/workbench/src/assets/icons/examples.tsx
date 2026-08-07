/**
 * Icon 使用示例
 * 
 * 本文件展示如何使用图标系统
 */

import React from 'react';
import Icon from '@/components/Icon';
import { iconPaths, iconCategories } from '@/assets/icons';

// 示例 1: 使用 Icon 组件 (推荐)
export const IconExamples: React.FC = () => {
  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      {/* 基础用法 */}
      <Icon name="legacy-edit" size={20} />
      <Icon name="legacy-delete" size={24} />
      <Icon name="legacy-search" size={16} />
      
      {/* 自定义颜色 */}
      <Icon name="status-success" size={20} color="var(--color-chart-2)" />
      <Icon name="status-fail" size={20} color="var(--color-chart-4)" />
      <Icon name="status-warn" size={20} color="var(--color-chart-3)" />

      {/* 点击事件 */}
      <Icon
        name="system-settings"
        size={24}
        onClick={() => console.log('settings clicked')}
      />
    </div>
  );
};

// 示例 2: 直接使用路径
export const DirectPathExample: React.FC = () => {
  return (
    <div>
      <img src={iconPaths.legacy.edit} alt="edit" />
      <img src={iconPaths.status.success} alt="success" />
      <img src={iconPaths.system.settings} alt="settings" />
    </div>
  );
};

// 示例 3: 获取图标分类
export const CategoryExample: React.FC = () => {
  return (
    <ul>
      {Object.entries(iconCategories).map(([key, value]) => (
        <li key={key}>
          <strong>{value.label}</strong>: {value.description}
        </li>
      ))}
    </ul>
  );
};

// 常用图标速查表
export const iconCheatSheet = {
  // 操作
  '添加': 'legacy-add',
  '编辑': 'legacy-edit',
  '删除': 'legacy-delete',
  '搜索': 'legacy-search',
  '筛选': 'legacy-filter',
  '排序': 'legacy-sort',
  '刷新': 'legacy-refresh',
  '同步': 'legacy-sync',
  '下载': 'legacy-download',
  '上传': 'legacy-upload',
  '保存': 'legacy-save',
  '关闭': 'legacy-close',
  '设置': 'legacy-setting',
  '帮助': 'legacy-help',
  '更多': 'legacy-more',
  
  // 状态
  '成功': 'status-success',
  '失败': 'status-fail',
  '警告': 'status-warn',
  '信息': 'status-info',
  '提示': 'status-notice',
  '疑问': 'status-question',
  
  // 系统
  '主题': 'system-theme',
  '语言': 'system-lang',
  '锁定': 'system-lock',
  '解锁': 'system-unlock',
  
  // 导航
  '首页': 'navigation-home',
  '返回': 'navigation-back',
  '前进': 'navigation-forward',
  '菜单': 'navigation-menu',
  
  // 人物
  '用户': 'people-user',
  '团队': 'people-team',
  '任务': 'people-task',
  
  // 媒体
  '图片': 'media-image',
  '视频': 'media-video',
  '文件': 'media-file',
  '文件夹': 'media-folder',
};
