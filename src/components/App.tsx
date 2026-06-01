import Toolbar from './Toolbar';
import Editor2D from './Editor2D';
import Editor3D from './Editor3D';
import FurniturePanel from './FurniturePanel';
import PropertyPanel from './PropertyPanel';
import { usePlannerStore } from '../store/plannerStore';

export default function App() {
  const { viewMode, project } = usePlannerStore();

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
        <span>项目: {project.name}</span>
        <span>家具: {project.furniture.length} 件</span>
        <span>墙体: {project.rooms.reduce((n, r) => n + r.walls.length, 0)} 面</span>
      </div>
    </div>
  );
}
