import { Upload, Check } from 'lucide-react';
import { BUILTIN_MODELS } from '../constants/models';
import type { BuiltinModel } from '../constants/models';

type ModelSelectorProps = {
  selectedModelId: string;
  isLoading?: boolean;
  onSelect: (model: BuiltinModel) => void;
  onUploadClick?: () => void;
  variant?: 'compact' | 'full';
};

const ModelSelector = ({
  selectedModelId,
  isLoading,
  onSelect,
  onUploadClick,
  variant = 'compact'
}: ModelSelectorProps) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className={`grid ${variant === 'full' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
        {BUILTIN_MODELS.map(model => (
          <button
            key={model.id}
            disabled={isLoading}
            onClick={() => onSelect(model)}
            className={`text-left text-[10px] px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between group ${
              selectedModelId === model.id
                ? 'bg-cyan-500/30 border-cyan-400/50 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <span className="truncate pr-2">{model.label}</span>
            {selectedModelId === model.id && <Check size={10} className="text-cyan-400 shrink-0" />}
          </button>
        ))}

        {onUploadClick && (
          <button
            onClick={onUploadClick}
            disabled={isLoading}
            className={`text-left text-[10px] px-3 py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2 ${variant === 'full' ? 'col-span-2' : ''}`}
          >
            <Upload size={10} />
            <span>カスタムVRMをアップロード</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;
