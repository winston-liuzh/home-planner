import { usePlannerStore } from '../store/plannerStore';
import type { ToolMode, ViewMode } from '../types';

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
  const { toolMode, viewMode, setToolMode, setViewMode } = usePlannerStore();

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <span className="toolbar-title">Home Planner</span>
      </div>
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
    </div>
  );
}
