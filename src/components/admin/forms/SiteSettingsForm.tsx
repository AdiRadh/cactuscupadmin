import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { Upload, FileText, Download, Trash2, Image, CreditCard, AlertTriangle, Lock, Eye, EyeOff, Check, Plus, Link as LinkIcon, RefreshCw, Percent } from 'lucide-react';
import { getTaxRateConfig, syncTaxRateToStripe, type TaxRateConfig } from '@/lib/utils/stripe';
import { uploadDocument, deleteDocument, getDocumentPathFromUrl, validateDocumentFile, getFilenameFromUrl } from '@/lib/utils/documentUpload';
import { uploadSiteLogo, deleteSiteLogo, getLogoPathFromUrl, uploadHeroImage, deleteHeroImage, getHeroImagePathFromUrl, validateImageFile } from '@/lib/utils/imageUpload';
import { formatDateTime } from '@/lib/utils/dateUtils';

export interface FooterLinkData {
  label: string;
  path: string;
  enabled: boolean;
}

export type StripeEnvironment = 'qa' | 'stg' | 'prod';

export interface SiteSettingsFormData {
  siteName: string;
  contactEmail: string;
  contactPhone: string;
  eventYear: string;
  eventLocation: string;
  privacyPolicyUrl: string;
  termsConditionsUrl: string;
  rulesUrl: string;
  waiverUrl: string;
  socialFacebook: string;
  socialInstagram: string;
  socialYoutube: string;
  socialTwitter: string;
  countdownEnabled: boolean;
  countdownTargetDate: string;
  inventoryNotificationEmail: string;
  inventoryNotificationThreshold: string;
  siteLogoUrl: string;
  heroImageUrl: string;
  // Footer settings
  footerTagline: string;
  footerCopyright: string;
  // Footer links
  footerEventTitle: string;
  footerInfoTitle: string;
  footerLegalTitle: string;
  footerEventLinks: FooterLinkData[];
  footerInfoLinks: FooterLinkData[];
  footerLegalLinks: FooterLinkData[];
  // Stripe configuration
  stripeEnvironment: StripeEnvironment;
  stripePublishableKeyQa: string;
  stripePublishableKeyStg: string;
  stripePublishableKeyProd: string;
}

export interface StripeSecretsData {
  stripeSecretKeyQa: string;
  stripeSecretKeyStg: string;
  stripeSecretKeyProd: string;
  stripeWebhookSecretQa: string;
  stripeWebhookSecretStg: string;
  stripeWebhookSecretProd: string;
}

interface SiteSettingsFormProps {
  initialData?: SiteSettingsFormData;
  onSubmit: (data: SiteSettingsFormData) => void;
  onSecretsUpdate?: (secrets: StripeSecretsData) => Promise<void>;
  isLoading?: boolean;
  isUpdatingSecrets?: boolean;
}

export const SiteSettingsForm: FC<SiteSettingsFormProps> = ({
  initialData,
  onSubmit,
  onSecretsUpdate,
  isLoading = false,
  isUpdatingSecrets = false,
}) => {
  const defaultFooterEventLinks: FooterLinkData[] = [
    { label: 'Tournaments', path: '/tournaments', enabled: true },
    { label: 'Activities', path: '/activities', enabled: true },
    { label: 'Schedule', path: '/schedule', enabled: true },
    { label: 'Venue', path: '/venue', enabled: true },
  ];

  const defaultFooterInfoLinks: FooterLinkData[] = [
    { label: 'About', path: '/about', enabled: true },
    { label: 'FAQ', path: '/faq', enabled: true },
    { label: 'Rules', path: '/rules', enabled: true },
    { label: 'Contact', path: '/contact', enabled: true },
  ];

  const defaultFooterLegalLinks: FooterLinkData[] = [
    { label: 'Privacy Policy', path: '/privacy', enabled: true },
    { label: 'Terms of Service', path: '/terms', enabled: true },
    { label: 'Refund Policy', path: '/refund', enabled: true },
  ];

  const defaultFormData: SiteSettingsFormData = {
    siteName: '',
    contactEmail: '',
    contactPhone: '',
    eventYear: new Date().getFullYear().toString(),
    eventLocation: '',
    privacyPolicyUrl: '',
    termsConditionsUrl: '',
    rulesUrl: '',
    waiverUrl: '',
    socialFacebook: '',
    socialInstagram: '',
    socialYoutube: '',
    socialTwitter: '',
    countdownEnabled: false,
    countdownTargetDate: '',
    inventoryNotificationEmail: '',
    inventoryNotificationThreshold: '90',
    siteLogoUrl: '',
    heroImageUrl: '',
    footerTagline: '',
    footerCopyright: '',
    footerEventTitle: 'Event',
    footerInfoTitle: 'Information',
    footerLegalTitle: 'Legal',
    footerEventLinks: defaultFooterEventLinks,
    footerInfoLinks: defaultFooterInfoLinks,
    footerLegalLinks: defaultFooterLegalLinks,
    stripeEnvironment: 'qa',
    stripePublishableKeyQa: '',
    stripePublishableKeyStg: '',
    stripePublishableKeyProd: '',
  };

  const [formData, setFormData] = useState<SiteSettingsFormData>(initialData || defaultFormData);

  // Sync form state when initialData changes (e.g., after data loads from DB)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Secret keys state (write-only, not persisted to site_settings)
  const [secrets, setSecrets] = useState<StripeSecretsData>({
    stripeSecretKeyQa: '',
    stripeSecretKeyStg: '',
    stripeSecretKeyProd: '',
    stripeWebhookSecretQa: '',
    stripeWebhookSecretStg: '',
    stripeWebhookSecretProd: '',
  });
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [secretsUpdated, setSecretsUpdated] = useState(false);

  // Tax rate state
  const [taxRateConfig, setTaxRateConfig] = useState<TaxRateConfig | null>(null);
  const [taxRateLoading, setTaxRateLoading] = useState(true);
  const [taxRateSyncing, setTaxRateSyncing] = useState(false);
  const [taxRateSyncResult, setTaxRateSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load tax rate config on mount
  useEffect(() => {
    const loadTaxConfig = async () => {
      try {
        const config = await getTaxRateConfig();
        setTaxRateConfig(config);
      } catch (err) {
        console.error('Failed to load tax rate config:', err);
      } finally {
        setTaxRateLoading(false);
      }
    };
    loadTaxConfig();
  }, []);

  const handleTaxRateSync = async () => {
    setTaxRateSyncing(true);
    setTaxRateSyncResult(null);

    try {
      const result = await syncTaxRateToStripe();
      if (result.success) {
        setTaxRateSyncResult({
          success: true,
          message: `Tax rate synced successfully! Rate ID: ${result.taxRateId}`,
        });
        // Reload config to get updated Stripe ID
        const updatedConfig = await getTaxRateConfig();
        setTaxRateConfig(updatedConfig);
      } else {
        setTaxRateSyncResult({
          success: false,
          message: result.error || 'Failed to sync tax rate',
        });
      }
    } catch (err) {
      setTaxRateSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to sync tax rate',
      });
    } finally {
      setTaxRateSyncing(false);
    }
  };

  const handleSecretChange = (field: keyof StripeSecretsData, value: string) => {
    setSecrets((prev) => ({ ...prev, [field]: value }));
    setSecretsUpdated(false);
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSecretsSubmit = async () => {
    if (!onSecretsUpdate) return;

    try {
      await onSecretsUpdate(secrets);
      setSecretsUpdated(true);
      // Clear the fields after successful update
      setSecrets({
        stripeSecretKeyQa: '',
        stripeSecretKeyStg: '',
        stripeSecretKeyProd: '',
        stripeWebhookSecretQa: '',
        stripeWebhookSecretStg: '',
        stripeWebhookSecretProd: '',
      });
    } catch {
      // Error handling is done in parent component
    }
  };

  const hasSecretsToUpdate = Object.values(secrets).some(v => v.trim() !== '');

  const handleChange = (field: keyof SiteSettingsFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDocumentUpload = async (file: File, documentType: 'privacy-policy' | 'terms-conditions') => {
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setUploading((prev) => ({ ...prev, [documentType]: true }));

    const result = await uploadDocument(file, documentType);
    setUploading((prev) => ({ ...prev, [documentType]: false }));

    if ('error' in result) {
      alert(result.error);
      return;
    }

    const field = documentType === 'privacy-policy' ? 'privacyPolicyUrl' : 'termsConditionsUrl';
    handleChange(field, result.url);
  };

  const handleDocumentDelete = async (documentType: 'privacy-policy' | 'terms-conditions') => {
    const field = documentType === 'privacy-policy' ? 'privacyPolicyUrl' : 'termsConditionsUrl';
    const url = formData[field];

    if (!url || !confirm('Are you sure you want to delete this document?')) return;

    const path = getDocumentPathFromUrl(url);
    if (path) {
      await deleteDocument(path);
    }
    handleChange(field, '');
  };

  const handleLogoUpload = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setUploading((prev) => ({ ...prev, logo: true }));

    const result = await uploadSiteLogo(file);
    setUploading((prev) => ({ ...prev, logo: false }));

    if ('error' in result) {
      alert(result.error);
      return;
    }

    handleChange('siteLogoUrl', result.url);
  };

  const handleLogoDelete = async () => {
    const url = formData.siteLogoUrl;

    if (!url || !confirm('Are you sure you want to delete the logo?')) return;

    const path = getLogoPathFromUrl(url);
    if (path) {
      await deleteSiteLogo(path);
    }
    handleChange('siteLogoUrl', '');
  };

  const handleHeroImageUpload = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setUploading((prev) => ({ ...prev, hero: true }));

    const result = await uploadHeroImage(file);
    setUploading((prev) => ({ ...prev, hero: false }));

    if ('error' in result) {
      alert(result.error);
      return;
    }

    handleChange('heroImageUrl', result.url);
  };

  const handleHeroImageDelete = async () => {
    const url = formData.heroImageUrl;

    if (!url || !confirm('Are you sure you want to delete the hero image?')) return;

    const path = getHeroImagePathFromUrl(url);
    if (path) {
      await deleteHeroImage(path);
    }
    handleChange('heroImageUrl', '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="siteName">Site Name</Label><Input id="siteName" value={formData.siteName} onChange={(e) => handleChange('siteName', e.target.value)} /></div>
            <div><Label htmlFor="eventYear">Event Year</Label><Input id="eventYear" value={formData.eventYear} onChange={(e) => handleChange('eventYear', e.target.value)} /></div>
          </div>
          <div><Label htmlFor="eventLocation">Event Location</Label><Input id="eventLocation" value={formData.eventLocation} onChange={(e) => handleChange('eventLocation', e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Upload a custom logo to display in the navigation bar. Recommended size: 200x50px. Maximum file size: 5MB.
            </p>
          </div>

          <div>
            <Label>Logo Image</Label>
            {formData.siteLogoUrl ? (
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-4 p-4 bg-turquoise-50 rounded border border-turquoise-200">
                  <div className="flex-shrink-0 w-32 h-16 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                    <img
                      src={formData.siteLogoUrl}
                      alt="Site logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Image className="h-5 w-5 text-turquoise-600" />
                      <span className="text-sm font-medium text-turquoise-900">Logo uploaded</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This logo will appear in the navigation bar</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={formData.siteLogoUrl} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button type="button" variant="ghost" size="sm" onClick={handleLogoDelete}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]);
                  }}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading['logo']}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('logo-upload')?.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading['logo'] ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: JPEG, PNG, WebP, GIF
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hero Image</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Upload a hero background image for the homepage. Recommended size: 1920x1080px or similar 16:9 ratio. Maximum file size: 5MB.
            </p>
          </div>

          <div>
            <Label>Hero Background Image</Label>
            {formData.heroImageUrl ? (
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-4 p-4 bg-turquoise-50 rounded border border-turquoise-200">
                  <div className="flex-shrink-0 w-48 h-32 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                    <img
                      src={formData.heroImageUrl}
                      alt="Hero image preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Image className="h-5 w-5 text-turquoise-600" />
                      <span className="text-sm font-medium text-turquoise-900">Hero image uploaded</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This image will appear as the homepage hero background</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={formData.heroImageUrl} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button type="button" variant="ghost" size="sm" onClick={handleHeroImageDelete}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleHeroImageUpload(e.target.files[0]);
                  }}
                  className="hidden"
                  id="hero-upload"
                />
                <label htmlFor="hero-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading['hero']}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('hero-upload')?.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading['hero'] ? 'Uploading...' : 'Upload Hero Image'}
                  </Button>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: JPEG, PNG, WebP, GIF
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="contactEmail">Contact Email</Label><Input id="contactEmail" type="email" value={formData.contactEmail} onChange={(e) => handleChange('contactEmail', e.target.value)} /></div>
            <div><Label htmlFor="contactPhone">Contact Phone</Label><Input id="contactPhone" value={formData.contactPhone} onChange={(e) => handleChange('contactPhone', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Footer Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Customize the footer content displayed at the bottom of every page. The tagline appears under the site name,
              and the copyright text appears in the bottom bar.
            </p>
          </div>
          <div>
            <Label htmlFor="footerTagline">Footer Tagline</Label>
            <textarea
              id="footerTagline"
              value={formData.footerTagline}
              onChange={(e) => handleChange('footerTagline', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              rows={3}
              placeholder="Arizona's hottest summer HEMA tournament Bringing together sword nerds from across the region..."
            />
            <p className="text-xs text-gray-500 mt-1">
              A brief description displayed under the site name in the footer
            </p>
          </div>
          <div>
            <Label htmlFor="footerCopyright">Copyright Text</Label>
            <Input
              id="footerCopyright"
              value={formData.footerCopyright}
              onChange={(e) => handleChange('footerCopyright', e.target.value)}
              placeholder="Cactus Cup"
            />
            <p className="text-xs text-gray-500 mt-1">
              Displayed as "&copy; {new Date().getFullYear()} [Your Text]. All rights reserved."
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Footer Navigation Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              Customize the navigation links displayed in the footer. You can edit labels, paths, enable/disable links, or add new ones.
            </p>
          </div>

          {/* Event Links Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="footerEventTitle" className="font-medium">Event Section Title</Label>
            </div>
            <Input
              id="footerEventTitle"
              value={formData.footerEventTitle}
              onChange={(e) => handleChange('footerEventTitle', e.target.value)}
              placeholder="Event"
              className="max-w-xs"
            />
            <div className="space-y-2">
              {formData.footerEventLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                  <input
                    type="checkbox"
                    checked={link.enabled}
                    onChange={(e) => {
                      const newLinks = [...formData.footerEventLinks];
                      newLinks[index] = { ...link, enabled: e.target.checked };
                      setFormData(prev => ({ ...prev, footerEventLinks: newLinks }));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <Input
                    value={link.label}
                    onChange={(e) => {
                      const newLinks = [...formData.footerEventLinks];
                      newLinks[index] = { ...link, label: e.target.value };
                      setFormData(prev => ({ ...prev, footerEventLinks: newLinks }));
                    }}
                    placeholder="Label"
                    className="flex-1"
                  />
                  <Input
                    value={link.path}
                    onChange={(e) => {
                      const newLinks = [...formData.footerEventLinks];
                      newLinks[index] = { ...link, path: e.target.value };
                      setFormData(prev => ({ ...prev, footerEventLinks: newLinks }));
                    }}
                    placeholder="/path"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newLinks = formData.footerEventLinks.filter((_, i) => i !== index);
                      setFormData(prev => ({ ...prev, footerEventLinks: newLinks }));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    footerEventLinks: [...prev.footerEventLinks, { label: '', path: '/', enabled: true }]
                  }));
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Link
              </Button>
            </div>
          </div>

          {/* Information Links Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="footerInfoTitle" className="font-medium">Information Section Title</Label>
            </div>
            <Input
              id="footerInfoTitle"
              value={formData.footerInfoTitle}
              onChange={(e) => handleChange('footerInfoTitle', e.target.value)}
              placeholder="Information"
              className="max-w-xs"
            />
            <div className="space-y-2">
              {formData.footerInfoLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                  <input
                    type="checkbox"
                    checked={link.enabled}
                    onChange={(e) => {
                      const newLinks = [...formData.footerInfoLinks];
                      newLinks[index] = { ...link, enabled: e.target.checked };
                      setFormData(prev => ({ ...prev, footerInfoLinks: newLinks }));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <Input
                    value={link.label}
                    onChange={(e) => {
                      const newLinks = [...formData.footerInfoLinks];
                      newLinks[index] = { ...link, label: e.target.value };
                      setFormData(prev => ({ ...prev, footerInfoLinks: newLinks }));
                    }}
                    placeholder="Label"
                    className="flex-1"
                  />
                  <Input
                    value={link.path}
                    onChange={(e) => {
                      const newLinks = [...formData.footerInfoLinks];
                      newLinks[index] = { ...link, path: e.target.value };
                      setFormData(prev => ({ ...prev, footerInfoLinks: newLinks }));
                    }}
                    placeholder="/path"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newLinks = formData.footerInfoLinks.filter((_, i) => i !== index);
                      setFormData(prev => ({ ...prev, footerInfoLinks: newLinks }));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    footerInfoLinks: [...prev.footerInfoLinks, { label: '', path: '/', enabled: true }]
                  }));
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Link
              </Button>
            </div>
          </div>

          {/* Legal Links Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="footerLegalTitle" className="font-medium">Legal Section Title</Label>
            </div>
            <Input
              id="footerLegalTitle"
              value={formData.footerLegalTitle}
              onChange={(e) => handleChange('footerLegalTitle', e.target.value)}
              placeholder="Legal"
              className="max-w-xs"
            />
            <div className="space-y-2">
              {formData.footerLegalLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                  <input
                    type="checkbox"
                    checked={link.enabled}
                    onChange={(e) => {
                      const newLinks = [...formData.footerLegalLinks];
                      newLinks[index] = { ...link, enabled: e.target.checked };
                      setFormData(prev => ({ ...prev, footerLegalLinks: newLinks }));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <Input
                    value={link.label}
                    onChange={(e) => {
                      const newLinks = [...formData.footerLegalLinks];
                      newLinks[index] = { ...link, label: e.target.value };
                      setFormData(prev => ({ ...prev, footerLegalLinks: newLinks }));
                    }}
                    placeholder="Label"
                    className="flex-1"
                  />
                  <Input
                    value={link.path}
                    onChange={(e) => {
                      const newLinks = [...formData.footerLegalLinks];
                      newLinks[index] = { ...link, path: e.target.value };
                      setFormData(prev => ({ ...prev, footerLegalLinks: newLinks }));
                    }}
                    placeholder="/path"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newLinks = formData.footerLegalLinks.filter((_, i) => i !== index);
                      setFormData(prev => ({ ...prev, footerLegalLinks: newLinks }));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    footerLegalLinks: [...prev.footerLegalLinks, { label: '', path: '/', enabled: true }]
                  }));
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Link
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Social Media</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="socialFacebook">Facebook URL</Label><Input id="socialFacebook" value={formData.socialFacebook} onChange={(e) => handleChange('socialFacebook', e.target.value)} /></div>
            <div><Label htmlFor="socialInstagram">Instagram URL</Label><Input id="socialInstagram" value={formData.socialInstagram} onChange={(e) => handleChange('socialInstagram', e.target.value)} /></div>
            <div><Label htmlFor="socialTwitter">Twitter/X URL</Label><Input id="socialTwitter" value={formData.socialTwitter} onChange={(e) => handleChange('socialTwitter', e.target.value)} /></div>
            <div><Label htmlFor="socialYoutube">YouTube URL</Label><Input id="socialYoutube" value={formData.socialYoutube} onChange={(e) => handleChange('socialYoutube', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Legal Documents</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Privacy Policy (PDF)</Label>
            {formData.privacyPolicyUrl ? (
              <div className="flex items-center gap-2 mt-2 p-3 bg-turquoise-50 rounded">
                <FileText className="h-5 w-5 text-turquoise-600" />
                <span className="flex-1 text-sm truncate">{getFilenameFromUrl(formData.privacyPolicyUrl)}</span>
                <a href={formData.privacyPolicyUrl} target="_blank" rel="noopener noreferrer"><Button type="button" variant="outline" size="sm"><Download className="h-4 w-4" /></Button></a>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDocumentDelete('privacy-policy')}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ) : (
              <div className="mt-2">
                <input type="file" accept=".pdf" onChange={(e) => { if (e.target.files?.[0]) handleDocumentUpload(e.target.files[0], 'privacy-policy'); }} className="hidden" id="privacy-upload" />
                <label htmlFor="privacy-upload"><Button type="button" variant="outline" disabled={uploading['privacy-policy']} onClick={(e) => { e.preventDefault(); document.getElementById('privacy-upload')?.click(); }}><Upload className="h-4 w-4 mr-2" />{uploading['privacy-policy'] ? 'Uploading...' : 'Upload PDF'}</Button></label>
              </div>
            )}
          </div>

          <div>
            <Label>Terms & Conditions (PDF)</Label>
            {formData.termsConditionsUrl ? (
              <div className="flex items-center gap-2 mt-2 p-3 bg-turquoise-50 rounded">
                <FileText className="h-5 w-5 text-turquoise-600" />
                <span className="flex-1 text-sm truncate">{getFilenameFromUrl(formData.termsConditionsUrl)}</span>
                <a href={formData.termsConditionsUrl} target="_blank" rel="noopener noreferrer"><Button type="button" variant="outline" size="sm"><Download className="h-4 w-4" /></Button></a>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDocumentDelete('terms-conditions')}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ) : (
              <div className="mt-2">
                <input type="file" accept=".pdf" onChange={(e) => { if (e.target.files?.[0]) handleDocumentUpload(e.target.files[0], 'terms-conditions'); }} className="hidden" id="terms-upload" />
                <label htmlFor="terms-upload"><Button type="button" variant="outline" disabled={uploading['terms-conditions']} onClick={(e) => { e.preventDefault(); document.getElementById('terms-upload')?.click(); }}><Upload className="h-4 w-4 mr-2" />{uploading['terms-conditions'] ? 'Uploading...' : 'Upload PDF'}</Button></label>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="rulesUrl">Rules URL</Label>
            <Input
              id="rulesUrl"
              type="url"
              placeholder="https://example.com/rules"
              value={formData.rulesUrl}
              onChange={(e) => handleChange('rulesUrl', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="waiverUrl">Waiver URL</Label>
            <Input
              id="waiverUrl"
              type="url"
              placeholder="https://example.com/waiver"
              value={formData.waiverUrl}
              onChange={(e) => handleChange('waiverUrl', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              URL to the waiver document shown during event registration
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Countdown Timer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Enable a site-wide countdown timer that blocks all registration until the specified target date/time.
              This is useful for announcing when registration will open.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="countdownEnabled"
              checked={formData.countdownEnabled}
              onChange={(e) => setFormData(prev => ({ ...prev, countdownEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <Label htmlFor="countdownEnabled" className="cursor-pointer font-medium">
              Enable Countdown Timer
            </Label>
          </div>

          {formData.countdownEnabled && (
            <div>
              <Label htmlFor="countdownTargetDate">Target Date & Time</Label>
              <Input
                id="countdownTargetDate"
                type="datetime-local"
                value={formData.countdownTargetDate}
                onChange={(e) => setFormData(prev => ({ ...prev, countdownTargetDate: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Registration will be blocked until this date/time. Leave empty to disable countdown.
              </p>
              {formData.countdownTargetDate && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-800">
                    Countdown active until: {formatDateTime(formData.countdownTargetDate + 'Z')} (Arizona Time)
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Receive email notifications when tournaments, activities, or special events reach a certain capacity threshold.
              This helps you prepare for waitlists or adjust registration accordingly.
            </p>
          </div>

          <div>
            <Label htmlFor="inventoryNotificationEmail">Notification Email</Label>
            <Input
              id="inventoryNotificationEmail"
              type="email"
              placeholder="admin@cactuscup.com"
              value={formData.inventoryNotificationEmail}
              onChange={(e) => handleChange('inventoryNotificationEmail', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email address where inventory notifications will be sent
            </p>
          </div>

          <div>
            <Label htmlFor="inventoryNotificationThreshold">Threshold (%)</Label>
            <Input
              id="inventoryNotificationThreshold"
              type="number"
              min="1"
              max="100"
              value={formData.inventoryNotificationThreshold}
              onChange={(e) => handleChange('inventoryNotificationThreshold', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Send notification when event reaches this percentage of capacity (e.g., 90 means you'll be notified when 90% full)
            </p>
          </div>

          {formData.inventoryNotificationEmail && formData.inventoryNotificationThreshold && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                You will receive notifications at <span className="font-semibold">{formData.inventoryNotificationEmail}</span> when events reach <span className="font-semibold">{formData.inventoryNotificationThreshold}%</span> capacity
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              Configure Stripe payment keys for different environments. Publishable keys are stored in the database.
              Secret keys are securely stored as environment variables.
            </p>
          </div>

          <div>
            <Label htmlFor="stripeEnvironment">Active Environment</Label>
            <select
              id="stripeEnvironment"
              value={formData.stripeEnvironment}
              onChange={(e) => handleChange('stripeEnvironment', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="qa">QA (Test Mode)</option>
              <option value="stg">Staging (Test Mode)</option>
              <option value="prod">Production (Live Mode)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select which Stripe environment to use for payments
            </p>
          </div>

          {formData.stripeEnvironment === 'prod' && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Production Mode Active</p>
                <p className="text-sm text-amber-700 mt-1">
                  Real payments will be processed. Ensure your live Stripe keys are configured correctly.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-gray-900">Publishable Keys</h4>

            <div>
              <Label htmlFor="stripePublishableKeyQa">
                QA Publishable Key
                {formData.stripeEnvironment === 'qa' && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                )}
              </Label>
              <Input
                id="stripePublishableKeyQa"
                type="text"
                placeholder="pk_test_..."
                value={formData.stripePublishableKeyQa}
                onChange={(e) => handleChange('stripePublishableKeyQa', e.target.value)}
                className="mt-1 font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="stripePublishableKeyStg">
                Staging Publishable Key
                {formData.stripeEnvironment === 'stg' && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                )}
              </Label>
              <Input
                id="stripePublishableKeyStg"
                type="text"
                placeholder="pk_test_..."
                value={formData.stripePublishableKeyStg}
                onChange={(e) => handleChange('stripePublishableKeyStg', e.target.value)}
                className="mt-1 font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="stripePublishableKeyProd">
                Production Publishable Key
                {formData.stripeEnvironment === 'prod' && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                )}
              </Label>
              <Input
                id="stripePublishableKeyProd"
                type="text"
                placeholder="pk_live_..."
                value={formData.stripePublishableKeyProd}
                onChange={(e) => handleChange('stripePublishableKeyProd', e.target.value)}
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>

          {/* Secret Keys Section */}
          {onSecretsUpdate && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Secret Keys</h4>
                <span className="text-xs text-gray-500">(write-only)</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-xs text-amber-800">
                  Secret keys are stored securely and cannot be viewed after saving.
                  Leave fields empty to keep existing values unchanged.
                </p>
              </div>

              {secretsUpdated && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800">Secrets updated successfully!</p>
                </div>
              )}

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="stripeSecretKeyQa" className="flex items-center gap-2">
                    QA Secret Key
                    {formData.stripeEnvironment === 'qa' && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                    )}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="stripeSecretKeyQa"
                      type={showSecrets['stripeSecretKeyQa'] ? 'text' : 'password'}
                      placeholder="sk_test_..."
                      value={secrets.stripeSecretKeyQa}
                      onChange={(e) => handleSecretChange('stripeSecretKeyQa', e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility('stripeSecretKeyQa')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['stripeSecretKeyQa'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="stripeSecretKeyStg" className="flex items-center gap-2">
                    Staging Secret Key
                    {formData.stripeEnvironment === 'stg' && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                    )}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="stripeSecretKeyStg"
                      type={showSecrets['stripeSecretKeyStg'] ? 'text' : 'password'}
                      placeholder="sk_test_..."
                      value={secrets.stripeSecretKeyStg}
                      onChange={(e) => handleSecretChange('stripeSecretKeyStg', e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility('stripeSecretKeyStg')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['stripeSecretKeyStg'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="stripeSecretKeyProd" className="flex items-center gap-2">
                    Production Secret Key
                    {formData.stripeEnvironment === 'prod' && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                    )}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="stripeSecretKeyProd"
                      type={showSecrets['stripeSecretKeyProd'] ? 'text' : 'password'}
                      placeholder="sk_live_..."
                      value={secrets.stripeSecretKeyProd}
                      onChange={(e) => handleSecretChange('stripeSecretKeyProd', e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility('stripeSecretKeyProd')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['stripeSecretKeyProd'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 mt-4">
                <h5 className="text-sm font-medium text-gray-700">Webhook Secrets</h5>

                <div>
                  <Label htmlFor="stripeWebhookSecretQa" className="flex items-center gap-2">
                    QA Webhook Secret
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="stripeWebhookSecretQa"
                      type={showSecrets['stripeWebhookSecretQa'] ? 'text' : 'password'}
                      placeholder="whsec_..."
                      value={secrets.stripeWebhookSecretQa}
                      onChange={(e) => handleSecretChange('stripeWebhookSecretQa', e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility('stripeWebhookSecretQa')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['stripeWebhookSecretQa'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="stripeWebhookSecretStg" className="flex items-center gap-2">
                    Staging Webhook Secret
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="stripeWebhookSecretStg"
                      type={showSecrets['stripeWebhookSecretStg'] ? 'text' : 'password'}
                      placeholder="whsec_..."
                      value={secrets.stripeWebhookSecretStg}
                      onChange={(e) => handleSecretChange('stripeWebhookSecretStg', e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility('stripeWebhookSecretStg')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['stripeWebhookSecretStg'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="stripeWebhookSecretProd" className="flex items-center gap-2">
                    Production Webhook Secret
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="stripeWebhookSecretProd"
                      type={showSecrets['stripeWebhookSecretProd'] ? 'text' : 'password'}
                      placeholder="whsec_..."
                      value={secrets.stripeWebhookSecretProd}
                      onChange={(e) => handleSecretChange('stripeWebhookSecretProd', e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility('stripeWebhookSecretProd')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['stripeWebhookSecretProd'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSecretsSubmit}
                  disabled={!hasSecretsToUpdate || isUpdatingSecrets}
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {isUpdatingSecrets ? 'Updating Secrets...' : 'Update Secret Keys'}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Only non-empty fields will be updated
                </p>
              </div>
            </div>
          )}

          {/* Tax Rate Configuration */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-gray-600" />
              <h4 className="font-medium text-gray-900">Tax Rate Configuration</h4>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-800">
                Configure the sales tax rate applied to all event registrations.
                This creates a tax rate in Stripe that is applied at checkout.
              </p>
            </div>

            {taxRateLoading ? (
              <div className="text-sm text-gray-500">Loading tax configuration...</div>
            ) : taxRateConfig ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                  <div>
                    <span className="text-xs text-gray-500 block">Tax Rate</span>
                    <span className="text-lg font-semibold text-gray-900">{taxRateConfig.percentage}%</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Display Name</span>
                    <span className="text-sm font-medium text-gray-900">{taxRateConfig.displayName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Jurisdiction</span>
                    <span className="text-sm text-gray-700">{taxRateConfig.jurisdiction}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Stripe Tax Rate ID</span>
                    {taxRateConfig.stripeTaxRateId ? (
                      <span className="text-sm font-mono text-green-700">{taxRateConfig.stripeTaxRateId}</span>
                    ) : (
                      <span className="text-sm text-amber-600">Not synced</span>
                    )}
                  </div>
                </div>

                {taxRateSyncResult && (
                  <div className={`p-3 rounded-md flex items-center gap-2 ${
                    taxRateSyncResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {taxRateSyncResult.success ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm ${
                      taxRateSyncResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {taxRateSyncResult.message}
                    </span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTaxRateSync}
                  disabled={taxRateSyncing}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${taxRateSyncing ? 'animate-spin' : ''}`} />
                  {taxRateSyncing
                    ? 'Syncing to Stripe...'
                    : taxRateConfig.stripeTaxRateId
                      ? 'Re-sync Tax Rate to Stripe'
                      : 'Create Tax Rate in Stripe'}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  {taxRateConfig.stripeTaxRateId
                    ? 'Click to update the tax rate in Stripe if you have changed the percentage'
                    : 'Click to create the tax rate in Stripe for the first time'}
                </p>
              </div>
            ) : (
              <div className="text-sm text-red-500">Failed to load tax configuration</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Settings'}</Button>
      </div>
    </form>
  );
};
