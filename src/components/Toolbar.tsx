import { usePlannerStore } from '../store/plannerStore';
import type { ToolMode, ViewMode } from '../types';
import { version } from '../../package.json';

const tools: { mode: ToolMode; icon: string; label: string }[] = [
  { mode: 'select', icon: '⬚', label: '选择' },
  { mode: 'wall', icon: '▬', label: '画墙' },
  { mode: 'furniture', icon: '⊞', label: '家具' },
];

const views: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: '2d', icon: '⊟', label: '2D' },
  { mode: '3d', icon: '⊡', label: '3D' },
];

export default function Toolbar() {
  const toolMode = usePlannerStore((s) => s.toolMode);
  const viewMode = usePlannerStore((s) => s.viewMode);
  const setToolMode = usePlannerStore((s) => s.setToolMode);
  const setViewMode = usePlannerStore((s) => s.setViewMode);
  const newProject = usePlannerStore((s) => s.newProject);

  const handleNewProject = () => {
    if (window.confirm('确定要新建项目吗？当前项目已自动保存。')) {
      newProject();
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <span className="toolbar-title">🏠 Home Planner <small style={{ fontSize: 9, opacity: 0.5, fontWeight: 400 }}>v{version}</small></span>
      </div>
      <div className="toolbar-section">
        <span className="section-label">文件</span>
        <button className="tool-btn" onClick={handleNewProject} title="新建项目">
          📄
          <span className="btn-label">新建</span>
        </button>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-section">
        <span className="section-label">视图</span>
        {views.map((v) => (
          <button
            key={v.mode}
            className={`tool-btn ${viewMode === v.mode ? 'active' : ''}`}
            onClick={() => setViewMode(v.mode)}
            title={v.label}
          >
            {v.icon}
            <span className="btn-label">{v.label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-section">
        <span className="section-label">工具</span>
        {tools.map((t) => (
          <button
            key={t.mode}
            className={`tool-btn ${toolMode === t.mode ? 'active' : ''}`}
            onClick={() => setToolMode(t.mode)}
            title={t.label}
          >
            {t.icon}
            <span className="btn-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-section toolbar-hints">
        <span>滚轮缩放</span>
        <span>中键平移</span>
        <span>R旋转</span>
        <span>Del删除</span>
      </div>
    </div>
  );
}
