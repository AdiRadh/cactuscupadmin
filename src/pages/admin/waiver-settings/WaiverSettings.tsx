import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { FileSignature, Save, Plus, Trash2, ToggleLeft, Link, FileText, GripVertical, ExternalLink, Pencil, X } from 'lucide-react';
import { supabase } from '@/lib/api/supabase';

interface WaiverTemplate {
  id: string;
  name: string;
  slug: string;
  boldsign_template_id: string | null;
  title: string;
  description: string | null;
  pdf_url: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  validity_days: number;
  event_year: number | null;
  created_at: string;
  updated_at: string;
}

interface WaiverFormData {
  name: string;
  slug: string;
  boldsign_template_id: string;
  title: string;
  description: string;
  pdf_url: string;
  is_required: boolean;
  is_active: boolean;
  validity_days: number;
  event_year: number | null;
}

const defaultFormData: WaiverFormData = {
  name: '',
  slug: '',
  boldsign_template_id: '',
  title: '',
  description: '',
  pdf_url: '',
  is_required: true,
  is_active: true,
  validity_days: 365,
  event_year: 2026,
};

export const WaiverSettings: FC = () => {
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<WaiverFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch waiver templates
  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('waiver_templates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching waiver templates:', err);
      setError('Failed to load waiver templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Handle name change and auto-generate slug
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
      title: prev.title || name,
    }));
  };

  // Start editing a template
  const startEditing = (template: WaiverTemplate) => {
    setEditingId(template.id);
    setIsCreating(false);
    setFormData({
      name: template.name,
      slug: template.slug,
      boldsign_template_id: template.boldsign_template_id || '',
      title: template.title,
      description: template.description || '',
      pdf_url: template.pdf_url || '',
      is_required: template.is_required,
      is_active: template.is_active,
      validity_days: template.validity_days,
      event_year: template.event_year,
    });
    setError(null);
  };

  // Start creating a new template
  const startCreating = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData(defaultFormData);
    setError(null);
  };

  // Cancel editing/creating
  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData(defaultFormData);
    setError(null);
  };

  // Save template (create or update)
  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.title) {
      setError('Name, slug, and title are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const templateData = {
        name: formData.name,
        slug: formData.slug,
        boldsign_template_id: formData.boldsign_template_id || null,
        title: formData.title,
        description: formData.description || null,
        pdf_url: formData.pdf_url || null,
        is_required: formData.is_required,
        is_active: formData.is_active,
        validity_days: formData.validity_days,
        event_year: formData.event_year,
      };

      if (editingId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('waiver_templates')
          .update(templateData)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: createError } = await supabase
          .from('waiver_templates')
          .insert({
            ...templateData,
            sort_order: templates.length,
          });

        if (createError) throw createError;
      }

      await fetchTemplates();
      cancelEdit();
    } catch (err: any) {
      console.error('Error saving waiver template:', err);
      setError(err.message || 'Failed to save waiver template');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this waiver template?')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('waiver_templates')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      await fetchTemplates();
    } catch (err: any) {
      console.error('Error deleting waiver template:', err);
      setError(err.message || 'Failed to delete waiver template');
    }
  };

  // Toggle active status
  const toggleActive = async (template: WaiverTemplate) => {
    try {
      const { error: updateError } = await supabase
        .from('waiver_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (updateError) throw updateError;
      await fetchTemplates();
    } catch (err: any) {
      console.error('Error toggling waiver template:', err);
      setError(err.message || 'Failed to update waiver template');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-white">Loading waiver templates...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Waiver Settings</h1>
          <p className="text-white/80 mt-2">Configure waivers that users must sign during registration</p>
        </div>
        {!isCreating && !editingId && (
          <Button onClick={startCreating} variant="secondary">
            <Plus className="h-4 w-4 mr-2" />
            Add Waiver
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="py-4">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              {editingId ? 'Edit Waiver Template' : 'Create Waiver Template'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Liability Waiver"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Internal name for this waiver</p>
              </div>

              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="e.g., liability-waiver"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">URL-friendly identifier</p>
              </div>
            </div>

            <div>
              <Label htmlFor="title">Display Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Liability Waiver and Release"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Title shown to users</p>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Please review and sign this waiver..."
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="boldsign_template_id" className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  BoldSign Template ID
                </Label>
                <Input
                  id="boldsign_template_id"
                  value={formData.boldsign_template_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, boldsign_template_id: e.target.value }))}
                  placeholder="e.g., abc123-def456-..."
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">From your BoldSign account</p>
              </div>

              <div>
                <Label htmlFor="pdf_url" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  PDF URL (Fallback)
                </Label>
                <Input
                  id="pdf_url"
                  type="url"
                  value={formData.pdf_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, pdf_url: e.target.value }))}
                  placeholder="https://example.com/waiver.pdf"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Used when BoldSign is unavailable</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="validity_days">Validity Period (days)</Label>
                <Input
                  id="validity_days"
                  type="number"
                  min="1"
                  max="3650"
                  value={formData.validity_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, validity_days: parseInt(e.target.value) || 365 }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="event_year">Event Year</Label>
                <Input
                  id="event_year"
                  type="number"
                  min="2020"
                  max="2100"
                  value={formData.event_year || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, event_year: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Leave empty for all years"
                  className="mt-1"
                />
              </div>

              <div className="space-y-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500"
                  />
                  <span className="text-sm text-gray-700">Required</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Waiver Templates ({templates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileSignature className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No waiver templates configured</p>
              <p className="text-sm mt-1">Click "Add Waiver" to create your first template</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    template.is_active
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">{template.name}</h3>
                      {template.is_required && (
                        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                          Required
                        </span>
                      )}
                      {!template.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                          Inactive
                        </span>
                      )}
                      {template.boldsign_template_id && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          BoldSign
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{template.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>Valid for {template.validity_days} days</span>
                      {template.event_year && <span>Year: {template.event_year}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {template.pdf_url && (
                      <a
                        href={template.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title="View PDF"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => toggleActive(template)}
                      className={`p-2 rounded ${
                        template.is_active
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={template.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <ToggleLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => startEditing(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Multiple Waivers:</strong> Users must sign all active, required waivers before completing registration.
          </p>
          <p>
            <strong>BoldSign Integration:</strong> If a BoldSign Template ID is configured, users sign digitally via embedded signing.
            Otherwise, they acknowledge via checkbox with a link to the PDF.
          </p>
          <p>
            <strong>Tracking:</strong> Signed waivers are tracked per user. If a user has already signed a waiver that's still valid,
            they won't be asked to sign again.
          </p>
          <p>
            <strong>Validity:</strong> Waivers expire after the configured validity period. Users will need to re-sign for future events.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
