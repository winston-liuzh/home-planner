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
      </div>
    </div>
  );
}
