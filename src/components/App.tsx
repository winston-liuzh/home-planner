import { useEffect } from 'react';
import Toolbar from './Toolbar';
import Editor2D from './Editor2D';
import Editor3D from './Editor3D';
import FurniturePanel from './FurniturePanel';
import PropertyPanel from './PropertyPanel';
import { usePlannerStore } from '../store/plannerStore';

export default function App() {
  const viewMode = usePlannerStore((s) => s.viewMode);
  const projectName = usePlannerStore((s) => s.project.name);
  const furnitureCount = usePlannerStore((s) => s.project.furniture.length);
  const wallCount = usePlannerStore((s) => s.project.rooms.reduce((n, r) => n + r.walls.length, 0));
  const dirty = usePlannerStore((s) => s.dirty);

  // 退出前提示保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

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
        {dirty && <span style={{ color: '#FF6B35' }}>● 未保存</span>}
      </div>
    </div>
  );
}
