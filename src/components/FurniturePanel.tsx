import { useState } from 'react';
import { usePlannerStore, FURNITURE_LIBRARY } from '../store/plannerStore';
import type { FurnitureModel } from '../types';

const categories = [...new Set(FURNITURE_LIBRARY.map((f) => f.category))];

export default function FurniturePanel() {
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const setPendingFurnitureModelId = usePlannerStore((s) => s.setPendingFurnitureModelId);
  const pendingFurnitureModelId = usePlannerStore((s) => s.pendingFurnitureModelId);
  const filtered = FURNITURE_LIBRARY.filter((f) => f.category === activeCategory);

  const handleDragStart = (e: React.DragEvent, model: FurnitureModel) => {
    e.dataTransfer.setData('furniture-model-id', model.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSelect = (modelId: string) => {
    if (pendingFurnitureModelId === modelId) {
      // Deselect if clicking the same
      setPendingFurnitureModelId(null);
    } else {
      setPendingFurnitureModelId(modelId);
    }
  };

  return (
    <div className="furniture-panel">
      <div className="panel-header">家具库</div>
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="furniture-list">
        {filtered.map((model) => (
          <div
            key={model.id}
            className={`furniture-item ${pendingFurnitureModelId === model.id ? 'selected' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, model)}
            onClick={() => handleSelect(model.id)}
          >
            <div
              className="furniture-preview"
              style={{ backgroundColor: model.color }}
            />
            <div className="furniture-info">
              <span className="furniture-name">{model.name}</span>
              <span className="furniture-size">{model.width}×{model.depth} cm</span>
            </div>
          </div>
        ))}
      </div>
      {pendingFurnitureModelId && (
        <div className="placement-hint">
          点击画布放置 · Esc取消
        </div>
      )}
    </div>
  );
}
