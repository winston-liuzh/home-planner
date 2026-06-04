import { useEffect } from 'react';
import Toolbar from './Toolbar';
import Editor2D from './Editor2D';
import Editor3D from './Editor3D';
import FurniturePanel from './FurniturePanel';
import PropertyPanel from './PropertyPanel';
import { usePlannerStore } from '../store/plannerStore';

function SaveStatusIndicator() {
  const saveStatus = usePlannerStore((s) => s.saveStatus);
  const lastSavedAt = usePlannerStore((s) => s.lastSavedAt);
  const projectName = usePlannerStore((s) => s.project.name);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="save-status">
      <span className="save-status-file">{projectName}</span>
      {saveStatus === 'saving' && (
        <span className="save-status-saving">存储中...</span>
      )}
      {saveStatus === 'saved' && lastSavedAt && (
        <span className="save-status-saved">已保存 {formatTime(lastSavedAt)}</span>
      )}
      {saveStatus === 'idle' && !lastSavedAt && (
        <span className="save-status-idle">自动保存</span>
      )}
    </div>
  );
}

export default function App() {
  const viewMode = usePlannerStore((s) => s.viewMode);
  const projectName = usePlannerStore((s) => s.project.name);
  const furnitureCount = usePlannerStore((s) => s.project.furniture.length);
  const wallCount = usePlannerStore((s) => s.project.rooms.reduce((n, r) => n + r.walls.length, 0));

  // 退出前提示：项目有内容时拦截浏览器关闭
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = usePlannerStore.getState();
      const hasContent = state.project.furniture.length > 0 ||
        state.project.rooms.some(r => r.walls.length > 0);
      if (hasContent) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="main-area">
        <FurniturePanel />
        <div className="editor-container">
          {viewMode === '2d' ? <Editor2D /> : <Editor3D />}
        </div>
        <PropertyPanel />
      </div>
      <div className="status-bar">
        <span>项目: {projectName}</span>
        <span>🪑 {furnitureCount} 件家具</span>
        <span>🧱 {wallCount} 面墙</span>
        <span>坐标单位: cm</span>
        <span style={{ flex: 1 }} />
        <SaveStatusIndicator />
      </div>
    </div>
  );
}
