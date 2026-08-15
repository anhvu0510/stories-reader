import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Tag, RotateCcw } from 'lucide-react';
import { TagCategory } from '../../../shared/constants/tags';
import { TagRepository } from '../../../repositories/TagRepository';

interface TagFilterSheetProps {
  isOpen: boolean;
  selectedTags: string[];
  onApply: (tags: string[]) => void;
  onClose: () => void;
}

export function TagFilterSheet({
  isOpen,
  selectedTags,
  onApply,
  onClose,
}: TagFilterSheetProps) {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>(selectedTags);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch latest categories from backend when component mounts or opens
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    TagRepository.getTags()
      .then((res) => {
        if (res && Array.isArray(res.categories)) {
          setCategories(res.categories);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  // Sync draftTags whenever the sheet opens or external selectedTags changes
  useEffect(() => {
    if (isOpen) {
      setDraftTags(selectedTags);
      setSearchQuery('');
    }
  }, [isOpen, selectedTags]);

  const toggleTag = (tag: string) => {
    setDraftTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearAll = () => {
    setDraftTags([]);
  };

  const handleApply = () => {
    onApply(draftTags);
    onClose();
  };

  // Filter categories and tags based on search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;

    return categories
      .map((category) => ({
        ...category,
        tags: category.tags.filter((t) => t.toLowerCase().includes(q)),
      }))
      .filter((category) => category.tags.length > 0);
  }, [categories, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      {/* Click outside backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        data-testid="tag-filter-backdrop"
      />

      {/* Sheet Modal Container */}
      <div className="relative w-full max-w-md bg-surface text-on-surface rounded-t-3xl sm:rounded-3xl border-t sm:border border-outline-variant/30 shadow-2xl flex flex-col max-h-[85vh] z-10 overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Handle Bar on Mobile */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-outline-variant/40" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Tag size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Bộ lọc Thể loại & Tags</h2>
              <p className="text-[10px] text-on-surface-variant/70">
                Chọn một hoặc nhiều tags (điều kiện HOẶC)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-95 transition-all"
            aria-label="Đóng bộ lọc"
            data-testid="tag-filter-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tag Search Box */}
        <div className="p-3 border-b border-outline-variant/15 bg-surface-container/30">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60"
            />
            <input
              type="text"
              placeholder="Tìm nhanh tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 transition-all"
              data-testid="tag-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-on-surface-variant/60 hover:text-on-surface"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Selected Tags Preview Bar */}
        {draftTags.length > 0 && (
          <div className="px-3.5 py-2 border-b border-outline-variant/15 bg-primary/5 flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-1.5 flex-nowrap">
              <span className="text-[11px] font-semibold text-primary shrink-0">
                Đã chọn ({draftTags.length}):
              </span>
              {draftTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-medium bg-primary text-on-primary shrink-0 shadow-xs"
                >
                  {tag}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="hover:opacity-80 active:scale-90"
                    aria-label={`Bỏ chọn ${tag}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            <button
              onClick={handleClearAll}
              className="text-[10.5px] font-bold text-error hover:underline shrink-0 flex items-center gap-0.5 ml-1"
            >
              <RotateCcw size={10} />
              Xóa hết
            </button>
          </div>
        )}

        {/* Categories and Tag List (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0 hide-scrollbar">
          {isLoading && categories.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant/60 animate-pulse">
              Đang tải danh mục tags từ hệ thống...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant/60">
              {searchQuery ? `Không tìm thấy tag phù hợp với từ khóa "${searchQuery}"` : 'Chưa có dữ liệu tags'}
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div key={category.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {category.name}
                  </h3>
                  <span className="text-[10px] text-on-surface-variant/50">
                    {category.tags.length} tags
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {category.tags.map((tag) => {
                    const isSelected = draftTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-primary text-on-primary border-primary shadow-xs font-semibold'
                            : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/60'
                        }`}
                        data-testid={`tag-chip-${tag}`}
                      >
                        {isSelected && <Check size={12} className="shrink-0 stroke-[2.5]" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-outline-variant/20 bg-surface/95 backdrop-blur-xs flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClearAll}
            disabled={draftTags.length === 0}
            className="px-3.5 py-2 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95"
            data-testid="tag-filter-reset-btn"
          >
            Đặt lại
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-1.5"
            data-testid="tag-filter-apply-btn"
          >
            <span>Áp dụng bộ lọc</span>
            {draftTags.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-on-primary/20 text-[10px] font-mono">
                {draftTags.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
