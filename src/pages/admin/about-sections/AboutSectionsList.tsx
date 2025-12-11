import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Label } from '@/components/ui';
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, MapPin, Users, Trophy, Save } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { AboutSection } from '@/types';
import { useAdmin } from '@/hooks';
import { supabase } from '@/lib/supabase';

interface QuickInfoSettings {
  event_date: string;
  event_date_subtitle: string;
  event_venue: string;
  event_venue_city: string;
  event_attendees: string;
  event_attendees_subtitle: string;
  event_tournaments: string;
  event_tournaments_subtitle: string;
}

export const AboutSectionsList: FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<AboutSection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<AboutSection[]>([]);
  const { listAboutSections, deleteAboutSection } = useAdmin();

  // Quick Info Cards state
  const [quickInfoSettings, setQuickInfoSettings] = useState<QuickInfoSettings>({
    event_date: '',
    event_date_subtitle: '',
    event_venue: '',
    event_venue_city: '',
    event_attendees: '',
    event_attendees_subtitle: '',
    event_tournaments: '',
    event_tournaments_subtitle: '',
  });
  const [isSavingQuickInfo, setIsSavingQuickInfo] = useState(false);
  const [quickInfoLoading, setQuickInfoLoading] = useState(true);

  const fetchSections = async () => {
    setIsLoading(true);
    try {
      const data = await listAboutSections({
        sorters: [{ field: 'display_order', order: 'asc' }],
      });
      setSections(data);
    } catch (error) {
      console.error('Error fetching about sections:', error);
      alert('Failed to load about sections.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQuickInfoSettings = async () => {
    setQuickInfoLoading(true);
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'event_date', 'event_date_subtitle',
          'event_venue', 'event_venue_city',
          'event_attendees', 'event_attendees_subtitle',
          'event_tournaments', 'event_tournaments_subtitle'
        ]);

      if (data) {
        const settings = data.reduce((acc, item) => {
          acc[item.setting_key as keyof QuickInfoSettings] = item.setting_value;
          return acc;
        }, {} as QuickInfoSettings);
        setQuickInfoSettings(prev => ({ ...prev, ...settings }));
      }
    } catch (error) {
      console.error('Error fetching quick info settings:', error);
    } finally {
      setQuickInfoLoading(false);
    }
  };

  const handleQuickInfoChange = (key: keyof QuickInfoSettings, value: string) => {
    setQuickInfoSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveQuickInfoSettings = async () => {
    setIsSavingQuickInfo(true);
    try {
      const updates = Object.entries(quickInfoSettings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value || '',
        setting_type: 'text',
      }));

      for (const update of updates) {
        const { data: existing } = await supabase
          .from('site_settings')
          .select('id')
          .eq('setting_key', update.setting_key)
          .single();

        if (existing) {
          await supabase
            .from('site_settings')
            .update({ setting_value: update.setting_value })
            .eq('setting_key', update.setting_key);
        } else {
          await supabase
            .from('site_settings')
            .insert(update);
        }
      }

      alert('Quick info cards saved successfully!');
    } catch (error) {
      console.error('Error saving quick info settings:', error);
      alert('Failed to save quick info cards.');
    } finally {
      setIsSavingQuickInfo(false);
    }
  };

  useEffect(() => {
    fetchSections();
    fetchQuickInfoSettings();
  }, []);

  const handleDelete = (section: AboutSection) => {
    setDeleteItem(section);
    setDeleteId(section.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteAboutSection(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      alert('About section deleted successfully!');
      await fetchSections();
    } catch (error) {
      setIsDeleting(false);
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete about section: ${errorMessage}. Check the browser console for details.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">About Page</h1>
          <p className="text-white/80 mt-2">Manage About page content and quick info cards</p>
        </div>
        <Link to="/admin/about-sections/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </Link>
      </div>

      {/* Quick Info Cards Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-viking text-white">Quick Info Cards</CardTitle>
          <p className="text-white/70 text-sm mt-1">
            Configure the quick info cards displayed at the top of the About page
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {quickInfoLoading ? (
            <div className="text-center text-white py-4">Loading settings...</div>
          ) : (
            <>
              {/* When */}
              <div className="space-y-3 p-4 bg-turquoise-800/50 rounded-lg border border-turquoise-600">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-500" />
                  <h4 className="font-medium text-white">When</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="eventDate" className="text-white/80">Date Display</Label>
                    <Input
                      id="eventDate"
                      value={quickInfoSettings.event_date}
                      onChange={(e) => handleQuickInfoChange('event_date', e.target.value)}
                      placeholder="June 14-16, 2025"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventDateSubtitle" className="text-white/80">Subtitle</Label>
                    <Input
                      id="eventDateSubtitle"
                      value={quickInfoSettings.event_date_subtitle}
                      onChange={(e) => handleQuickInfoChange('event_date_subtitle', e.target.value)}
                      placeholder="Full weekend event"
                    />
                  </div>
                </div>
              </div>

              {/* Where */}
              <div className="space-y-3 p-4 bg-turquoise-800/50 rounded-lg border border-turquoise-600">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-orange-500" />
                  <h4 className="font-medium text-white">Where</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="eventVenue" className="text-white/80">Venue Name</Label>
                    <Input
                      id="eventVenue"
                      value={quickInfoSettings.event_venue}
                      onChange={(e) => handleQuickInfoChange('event_venue', e.target.value)}
                      placeholder="Phoenix Convention Center"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventVenueCity" className="text-white/80">City/Location</Label>
                    <Input
                      id="eventVenueCity"
                      value={quickInfoSettings.event_venue_city}
                      onChange={(e) => handleQuickInfoChange('event_venue_city', e.target.value)}
                      placeholder="Phoenix, Arizona"
                    />
                  </div>
                </div>
              </div>

              {/* Attendees */}
              <div className="space-y-3 p-4 bg-turquoise-800/50 rounded-lg border border-turquoise-600">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  <h4 className="font-medium text-white">Attendees</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="eventAttendees" className="text-white/80">Attendees Description</Label>
                    <Input
                      id="eventAttendees"
                      value={quickInfoSettings.event_attendees}
                      onChange={(e) => handleQuickInfoChange('event_attendees', e.target.value)}
                      placeholder="200+ fighters expected"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventAttendeesSubtitle" className="text-white/80">Subtitle</Label>
                    <Input
                      id="eventAttendeesSubtitle"
                      value={quickInfoSettings.event_attendees_subtitle}
                      onChange={(e) => handleQuickInfoChange('event_attendees_subtitle', e.target.value)}
                      placeholder="From 15+ schools"
                    />
                  </div>
                </div>
              </div>

              {/* Tournaments */}
              <div className="space-y-3 p-4 bg-turquoise-800/50 rounded-lg border border-turquoise-600">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-orange-500" />
                  <h4 className="font-medium text-white">Tournaments</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="eventTournaments" className="text-white/80">Tournaments Description</Label>
                    <Input
                      id="eventTournaments"
                      value={quickInfoSettings.event_tournaments}
                      onChange={(e) => handleQuickInfoChange('event_tournaments', e.target.value)}
                      placeholder="4 tournament categories"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventTournamentsSubtitle" className="text-white/80">Subtitle</Label>
                    <Input
                      id="eventTournamentsSubtitle"
                      value={quickInfoSettings.event_tournaments_subtitle}
                      onChange={(e) => handleQuickInfoChange('event_tournaments_subtitle', e.target.value)}
                      placeholder="Multiple divisions"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveQuickInfoSettings} disabled={isSavingQuickInfo}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingQuickInfo ? 'Saving...' : 'Save Quick Info'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Content Sections Header */}
      <div className="flex items-center justify-between pt-4">
        <div>
          <h2 className="text-2xl font-viking text-white">Content Sections</h2>
          <p className="text-white/70 text-sm mt-1">Manage the main content sections of the About page</p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">Loading...</div>
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">No sections found.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-viking text-white">{section.title}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{section.sectionKey}</Badge>
                      {section.isPublished ? (
                        <Badge variant="success">
                          <Eye className="h-3 w-3 mr-1" />
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Draft
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/admin/about-sections/edit/${section.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(section)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/70 line-clamp-2">{section.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteItem(null);
          }
        }}
        onConfirm={confirmDelete}
        itemName={deleteItem?.title || ''}
        itemType="About Section"
        isLoading={isDeleting}
      />
    </div>
  );
};
