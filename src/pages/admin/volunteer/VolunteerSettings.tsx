import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useList, useUpdate, useCreate } from '@refinedev/core';
import { Users, Calendar, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { DbSiteSetting } from '@/types';
import { dbToSiteSetting } from '@/types';
import type { SiteSetting } from '@/types';

interface VolunteerFormData {
  title: string;
  description: string;
  body: string;
  card1_title: string;
  card1_description: string;
  card2_title: string;
  card2_description: string;
  card3_title: string;
  card3_description: string;
  questions_header: string;
  questions_content: string;
  questions_button_text: string;
  questions_button_link: string;
}

/**
 * Admin page for editing volunteer page content
 * Manages volunteer_title, volunteer_description, and volunteer_body settings
 */
export const VolunteerSettings: FC = () => {
  const { query } = useList<DbSiteSetting>({
    resource: 'site_settings',
    pagination: { pageSize: 100 },
    filters: [
      {
        field: 'setting_key',
        operator: 'in',
        value: [
          'volunteer_title',
          'volunteer_description',
          'volunteer_body',
          'volunteer_card1_title',
          'volunteer_card1_description',
          'volunteer_card2_title',
          'volunteer_card2_description',
          'volunteer_card3_title',
          'volunteer_card3_description',
          'volunteer_questions_header',
          'volunteer_questions_content',
          'volunteer_questions_button_text',
          'volunteer_questions_button_link',
        ],
      },
    ],
  });

  const data = query.data?.data || [];
  const isLoading = query.isLoading;
  const { mutate: updateSetting } = useUpdate();
  const { mutate: createSetting } = useCreate();
  const [saving, setSaving] = useState(false);

  const settings = useMemo(() => {
    if (!data || data.length === 0) return {} as Record<string, string>;
    return data
      .map((dbSetting: DbSiteSetting) => dbToSiteSetting(dbSetting))
      .reduce((acc: Record<string, string>, setting: SiteSetting) => {
        acc[setting.settingKey] = setting.settingValue;
        return acc;
      }, {} as Record<string, string>);
  }, [data]);

  const [formData, setFormData] = useState<VolunteerFormData>({
    title: '',
    description: '',
    body: '',
    card1_title: '',
    card1_description: '',
    card2_title: '',
    card2_description: '',
    card3_title: '',
    card3_description: '',
    questions_header: '',
    questions_content: '',
    questions_button_text: '',
    questions_button_link: '',
  });

  // Update form when settings load
  useMemo(() => {
    if (Object.keys(settings).length > 0) {
      setFormData({
        title: settings['volunteer_title'] || 'Volunteer With Us',
        description: settings['volunteer_description'] || 'Help make Cactus Cup an amazing experience for everyone!',
        body: settings['volunteer_body'] || '',
        card1_title: settings['volunteer_card1_title'] || 'Join Our Team',
        card1_description: settings['volunteer_card1_description'] || 'Be part of an amazing team of volunteers who make Cactus Cup possible.',
        card2_title: settings['volunteer_card2_title'] || 'Flexible Shifts',
        card2_description: settings['volunteer_card2_description'] || 'Choose shifts that work with your schedule and still enjoy the event.',
        card3_title: settings['volunteer_card3_title'] || 'Perks & Benefits',
        card3_description: settings['volunteer_card3_description'] || 'Volunteers receive special perks as a thank you for their time.',
        questions_header: settings['volunteer_questions_header'] || 'Questions?',
        questions_content: settings['volunteer_questions_content'] || 'Have questions about volunteering? Check out our About page or reach out to the organizing team.',
        questions_button_text: settings['volunteer_questions_button_text'] || 'Contact Us',
        questions_button_link: settings['volunteer_questions_button_link'] || '/about',
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updates: Array<{ key: string; value: string }> = [
      { key: 'volunteer_title', value: formData.title },
      { key: 'volunteer_description', value: formData.description },
      { key: 'volunteer_body', value: formData.body },
      { key: 'volunteer_card1_title', value: formData.card1_title },
      { key: 'volunteer_card1_description', value: formData.card1_description },
      { key: 'volunteer_card2_title', value: formData.card2_title },
      { key: 'volunteer_card2_description', value: formData.card2_description },
      { key: 'volunteer_card3_title', value: formData.card3_title },
      { key: 'volunteer_card3_description', value: formData.card3_description },
      { key: 'volunteer_questions_header', value: formData.questions_header },
      { key: 'volunteer_questions_content', value: formData.questions_content },
      { key: 'volunteer_questions_button_text', value: formData.questions_button_text },
      { key: 'volunteer_questions_button_link', value: formData.questions_button_link },
    ];

    for (const update of updates) {
      const existingSetting = data.find((s: DbSiteSetting) => s.setting_key === update.key);
      if (existingSetting) {
        await new Promise<void>((resolve) => {
          updateSetting(
            {
              resource: 'site_settings',
              id: existingSetting.id,
              values: { setting_value: update.value },
            },
            { onSettled: () => resolve() }
          );
        });
      } else {
        await new Promise<void>((resolve) => {
          createSetting(
            {
              resource: 'site_settings',
              values: {
                setting_key: update.key,
                setting_value: update.value,
                setting_type: 'text',
              },
            },
            { onSettled: () => resolve() }
          );
        });
      }
    }

    setSaving(false);
    query.refetch();
    alert('Volunteer page content saved successfully!');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-white">Loading volunteer settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-white">Volunteer Page</h1>
        <p className="text-white/80 mt-2">
          Edit the content displayed on the public volunteer page
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-gradient-to-br from-turquoise-700 to-turquoise-800 border-turquoise-600">
          <CardHeader>
            <CardTitle className="text-white">Page Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-white">
                Page Title
              </label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Volunteer With Us"
                className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
              />
              <p className="text-xs text-white/60">
                The main heading displayed at the top of the volunteer page
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-white">
                Description
              </label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Help make Cactus Cup an amazing experience for everyone!"
                className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
              />
              <p className="text-xs text-white/60">
                Short description shown below the page title
              </p>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <label htmlFor="body" className="text-sm font-medium text-white">
                Page Body
              </label>
              <textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Enter the main content for the volunteer page..."
                rows={15}
                className="w-full rounded-md bg-turquoise-800 border border-turquoise-600 text-white placeholder:text-white/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-white/60">
                Main content of the volunteer page. Use double line breaks (press Enter twice) to separate paragraphs.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards Section */}
        <Card className="bg-gradient-to-br from-turquoise-700 to-turquoise-800 border-turquoise-600">
          <CardHeader>
            <CardTitle className="text-white">Info Cards</CardTitle>
            <p className="text-white/60 text-sm">Edit the three info cards displayed on the volunteer page</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Card 1 - Join Our Team */}
            <div className="bg-turquoise-900/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-orange-500">
                <Users className="h-5 w-5" />
                <span className="font-medium text-white">Card 1</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="card1_title" className="text-sm font-medium text-white">
                    Title
                  </label>
                  <Input
                    id="card1_title"
                    value={formData.card1_title}
                    onChange={(e) => setFormData({ ...formData, card1_title: e.target.value })}
                    placeholder="Join Our Team"
                    className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="card1_description" className="text-sm font-medium text-white">
                    Description
                  </label>
                  <Input
                    id="card1_description"
                    value={formData.card1_description}
                    onChange={(e) => setFormData({ ...formData, card1_description: e.target.value })}
                    placeholder="Be part of an amazing team..."
                    className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                  />
                </div>
              </div>
            </div>

            {/* Card 2 - Flexible Shifts */}
            <div className="bg-turquoise-900/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-orange-500">
                <Calendar className="h-5 w-5" />
                <span className="font-medium text-white">Card 2</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="card2_title" className="text-sm font-medium text-white">
                    Title
                  </label>
                  <Input
                    id="card2_title"
                    value={formData.card2_title}
                    onChange={(e) => setFormData({ ...formData, card2_title: e.target.value })}
                    placeholder="Flexible Shifts"
                    className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="card2_description" className="text-sm font-medium text-white">
                    Description
                  </label>
                  <Input
                    id="card2_description"
                    value={formData.card2_description}
                    onChange={(e) => setFormData({ ...formData, card2_description: e.target.value })}
                    placeholder="Choose shifts that work with your schedule..."
                    className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                  />
                </div>
              </div>
            </div>

            {/* Card 3 - Perks & Benefits */}
            <div className="bg-turquoise-900/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-orange-500">
                <Heart className="h-5 w-5" />
                <span className="font-medium text-white">Card 3</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="card3_title" className="text-sm font-medium text-white">
                    Title
                  </label>
                  <Input
                    id="card3_title"
                    value={formData.card3_title}
                    onChange={(e) => setFormData({ ...formData, card3_title: e.target.value })}
                    placeholder="Perks & Benefits"
                    className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="card3_description" className="text-sm font-medium text-white">
                    Description
                  </label>
                  <Input
                    id="card3_description"
                    value={formData.card3_description}
                    onChange={(e) => setFormData({ ...formData, card3_description: e.target.value })}
                    placeholder="Volunteers receive special perks..."
                    className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions Section */}
        <Card className="bg-gradient-to-br from-turquoise-700 to-turquoise-800 border-turquoise-600">
          <CardHeader>
            <CardTitle className="text-white">Questions Section</CardTitle>
            <p className="text-white/60 text-sm">Edit the sidebar "Questions" card displayed on the volunteer page</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="questions_header" className="text-sm font-medium text-white">
                Header
              </label>
              <Input
                id="questions_header"
                value={formData.questions_header}
                onChange={(e) => setFormData({ ...formData, questions_header: e.target.value })}
                placeholder="Questions?"
                className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="questions_content" className="text-sm font-medium text-white">
                Content
              </label>
              <textarea
                id="questions_content"
                value={formData.questions_content}
                onChange={(e) => setFormData({ ...formData, questions_content: e.target.value })}
                placeholder="Have questions about volunteering?..."
                rows={3}
                className="w-full rounded-md bg-turquoise-800 border border-turquoise-600 text-white placeholder:text-white/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="questions_button_text" className="text-sm font-medium text-white">
                  Button Text
                </label>
                <Input
                  id="questions_button_text"
                  value={formData.questions_button_text}
                  onChange={(e) => setFormData({ ...formData, questions_button_text: e.target.value })}
                  placeholder="Contact Us"
                  className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="questions_button_link" className="text-sm font-medium text-white">
                  Button Link
                </label>
                <Input
                  id="questions_button_link"
                  value={formData.questions_button_link}
                  onChange={(e) => setFormData({ ...formData, questions_button_link: e.target.value })}
                  placeholder="/about"
                  className="bg-turquoise-800 border-turquoise-600 text-white placeholder:text-white/50"
                />
                <p className="text-xs text-white/60">
                  Use relative paths like "/about" for internal pages or full URLs for external links
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Preview Card */}
      <Card className="bg-gradient-to-br from-turquoise-700 to-turquoise-800 border-turquoise-600">
        <CardHeader>
          <CardTitle className="text-white">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-turquoise-900/50 rounded-lg p-6 space-y-6">
            <h2 className="text-2xl font-viking text-white">{formData.title || 'Page Title'}</h2>
            <p className="text-white/80">{formData.description || 'Page description...'}</p>

            {/* Info Cards Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-turquoise-800/50 rounded-lg p-4 border border-turquoise-600">
                <Users className="h-6 w-6 text-orange-500 mb-2" />
                <h3 className="text-white font-viking text-sm mb-1">{formData.card1_title || 'Card 1 Title'}</h3>
                <p className="text-white/70 text-xs">{formData.card1_description || 'Card 1 description...'}</p>
              </div>
              <div className="bg-turquoise-800/50 rounded-lg p-4 border border-turquoise-600">
                <Calendar className="h-6 w-6 text-orange-500 mb-2" />
                <h3 className="text-white font-viking text-sm mb-1">{formData.card2_title || 'Card 2 Title'}</h3>
                <p className="text-white/70 text-xs">{formData.card2_description || 'Card 2 description...'}</p>
              </div>
              <div className="bg-turquoise-800/50 rounded-lg p-4 border border-turquoise-600">
                <Heart className="h-6 w-6 text-orange-500 mb-2" />
                <h3 className="text-white font-viking text-sm mb-1">{formData.card3_title || 'Card 3 Title'}</h3>
                <p className="text-white/70 text-xs">{formData.card3_description || 'Card 3 description...'}</p>
              </div>
            </div>

            <hr className="border-turquoise-600" />
            <div className="prose prose-sm max-w-none space-y-4">
              {formData.body.split('\n\n').filter(p => p.trim()).map((paragraph, idx) => (
                <p key={idx} className="text-white/90 leading-relaxed whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>

            <hr className="border-turquoise-600" />

            {/* Questions Section Preview */}
            <div className="bg-turquoise-800/50 rounded-lg p-4 border border-turquoise-600 max-w-xs">
              <h3 className="text-white font-viking text-lg mb-2">{formData.questions_header || 'Questions?'}</h3>
              <p className="text-white/70 text-sm mb-3">{formData.questions_content || 'Questions content...'}</p>
              <div className="bg-orange-500 text-white text-center py-2 px-4 rounded text-sm font-medium">
                {formData.questions_button_text || 'Button Text'}
              </div>
              <p className="text-white/50 text-xs mt-2">Link: {formData.questions_button_link || '/about'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
