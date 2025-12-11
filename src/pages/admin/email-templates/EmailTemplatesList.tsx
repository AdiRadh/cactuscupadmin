import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui';
import { Mail, Info, Save, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/api/supabase';

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject: string;
  html_content: string;
  text_content: string;
  available_variables: string[];
  description: string;
}

/**
 * Email Templates management page
 * Allows admins to customize email templates with variable substitution
 */
export const EmailTemplatesList: FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showVariables, setShowVariables] = useState(true);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_name');

      if (error) throw error;

      setTemplates(data || []);
      if (data && data.length > 0 && !selectedTemplate) {
        selectTemplate(data[0]);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      setMessage({ type: 'error', text: 'Failed to load email templates' });
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setHtmlContent(template.html_content);
    setTextContent(template.text_content);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from('email_templates')
        .update({
          subject,
          html_content: htmlContent,
          text_content: textContent,
        })
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Template saved successfully!' });

      // Reload templates to get updated data
      await loadTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      setMessage({ type: 'error', text: 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject);
      setHtmlContent(selectedTemplate.html_content);
      setTextContent(selectedTemplate.text_content);
      setMessage(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-viking text-white">Email Templates</h1>
        <p className="text-orange-200 mt-2">
          Customize email templates with dynamic variables
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
        {/* Template List Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Templates</CardTitle>
            <CardDescription>Select a template to edit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'bg-orange-500/20 border-orange-500 text-white'
                      : 'border-white/20 hover:bg-white/5 text-white/90'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <div>
                      <p className="font-medium">{template.template_name}</p>
                      <p className="text-xs text-white/60">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Template Editor */}
        {selectedTemplate && (
          <div className="space-y-6">
            {/* Available Variables Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-turquoise-400" />
                    <CardTitle className="text-lg">Available Variables</CardTitle>
                  </div>
                  <button
                    onClick={() => setShowVariables(!showVariables)}
                    className="text-sm text-turquoise-400 hover:text-turquoise-300"
                  >
                    {showVariables ? 'Hide' : 'Show'}
                  </button>
                </div>
                <CardDescription>
                  Use these variables in your template - they will be replaced with actual values
                </CardDescription>
              </CardHeader>
              {showVariables && (
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.available_variables.map((variable) => (
                      <code
                        key={variable}
                        className="px-3 py-1 bg-turquoise-500/10 text-turquoise-300 rounded-md text-sm font-mono border border-turquoise-500/20 cursor-pointer hover:bg-turquoise-500/20 transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${variable}}}`);
                          setMessage({ type: 'success', text: `Copied {{${variable}}} to clipboard!` });
                          setTimeout(() => setMessage(null), 2000);
                        }}
                        title="Click to copy"
                      >
                        {'{{'}
                        {variable}
                        {'}}'}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-white/60 mt-3">
                    💡 Tip: Click a variable to copy it to your clipboard
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Status Message */}
            {message && (
              <div
                className={`p-4 rounded-lg border ${
                  message.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Subject Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Email Subject</CardTitle>
                <CardDescription>Subject line supports variables</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 transition-colors"
                  placeholder="Email subject line..."
                />
              </CardContent>
            </Card>

            {/* HTML Content Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">HTML Content</CardTitle>
                <CardDescription>
                  Full HTML email content (styling will be wrapped in template)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  rows={15}
                  className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 transition-colors font-mono text-sm"
                  placeholder="HTML content with variables..."
                />
              </CardContent>
            </Card>

            {/* Text Content Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Plain Text Content</CardTitle>
                <CardDescription>
                  Fallback text content for email clients that don't support HTML
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 transition-colors font-mono text-sm"
                  placeholder="Plain text content with variables..."
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-white/20 hover:bg-white/5"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
