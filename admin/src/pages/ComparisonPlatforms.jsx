import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Loader2, Scale } from 'lucide-react';
import {
  useComparisonPlatforms,
  useCreateComparisonPlatform,
  useUpdateComparisonPlatform,
  useDeleteComparisonPlatform,
} from '../hooks/api/useComparisonPlatforms';

/**
 * Admin-managed reference list of third-party marketplaces (eBay, Chrono24,
 * ...) a product's listing can be compared against — see
 * src/pages/ProductDetail.jsx's "Compare Elsewhere" widget and the seller's
 * optional comparison fields in Account.jsx for where this list is consumed.
 */
function ComparisonPlatforms() {
  const { data: platforms, isLoading } = useComparisonPlatforms();
  const createMutation = useCreateComparisonPlatform();
  const updateMutation = useUpdateComparisonPlatform();
  const deleteMutation = useDeleteComparisonPlatform();

  const [form, setForm] = useState({ name: '', logoUrl: '' });
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  const submitCreate = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim() || undefined,
      });
      setForm({ name: '', logoUrl: '' });
    } catch {
      // Rendered from createMutation.isError below; caught so the rejection is
      // not an unhandled promise and the typed values survive for a retry.
    }
  };

  const startEdit = (platform) => {
    setEditingId(platform.id);
    setDraft({
      name: platform.name,
      logoUrl: platform.logoUrl || '',
      sortOrder: platform.sortOrder,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateMutation.mutateAsync({
        id: editingId,
        name: draft.name.trim(),
        logoUrl: draft.logoUrl.trim() || null,
        sortOrder: Number(draft.sortOrder) || 0,
      });
      setEditingId(null);
      setDraft({});
    } catch {
      // Keep the row in edit mode so the operator can retry or cancel.
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Scale className="text-luxury-gold" size={24} />
        <h1 className="text-2xl font-serif font-bold text-heritage-charcoal">
          Comparison Platforms
        </h1>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        The marketplaces shown on every product page's "Compare Elsewhere" widget and offered to
        sellers when they add competitor pricing to a listing. Add as many as you need — the widget
        grays out any platform a product has no link for.
      </p>

      <div className="bg-white rounded-lg shadow-heritage border border-gray-100 p-6 mb-6">
        <form onSubmit={submitCreate} className="flex flex-col md:flex-row gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Platform name (e.g. eBay)"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold"
          />
          <input
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="Logo URL (optional)"
            className="flex-[2] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center justify-center gap-2 bg-heritage-charcoal text-white text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-md hover:bg-luxury-gold transition-all duration-300 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add Platform
          </button>
        </form>
        {createMutation.isError && (
          <p className="text-xs text-red-500 mt-2">
            {createMutation.error?.response?.data?.error || createMutation.error?.message}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-heritage border border-gray-100 p-6">
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading platforms…</p>
        ) : !platforms || platforms.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No platforms yet — add your first one above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-100">
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Logo URL</th>
                <th className="py-2 px-2 text-center">Sort</th>
                <th className="py-2 px-2 text-center">Active</th>
                <th className="py-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((platform) => {
                const editing = editingId === platform.id;
                return (
                  <tr key={platform.id} className="border-b border-gray-50 align-middle">
                    <td className="py-3 px-2">
                      {editing ? (
                        <input
                          value={draft.name ?? ''}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-luxury-gold"
                        />
                      ) : (
                        <span className="font-medium text-heritage-charcoal">{platform.name}</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {editing ? (
                        <input
                          value={draft.logoUrl ?? ''}
                          onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                          placeholder="Logo URL"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-luxury-gold"
                        />
                      ) : (
                        <span className="text-xs text-gray-400 truncate block max-w-[240px]">
                          {platform.logoUrl || '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {editing ? (
                        <input
                          type="number"
                          value={draft.sortOrder ?? 0}
                          onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-luxury-gold"
                        />
                      ) : (
                        <span className="text-gray-500 tabular-nums">{platform.sortOrder}</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() =>
                          updateMutation.mutate({ id: platform.id, active: !platform.active })
                        }
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          platform.active ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                        aria-label={`Toggle ${platform.name}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                            platform.active ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="inline-flex gap-1">
                        {editing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={updateMutation.isPending}
                              className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                              title="Save"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                              title="Cancel"
                            >
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(platform)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete "${platform.name}"? Existing products keep their link but it will no longer render anywhere.`,
                                  )
                                ) {
                                  deleteMutation.mutate(platform.id);
                                }
                              }}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ComparisonPlatforms;
